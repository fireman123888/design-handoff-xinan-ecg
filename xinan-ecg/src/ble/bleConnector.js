/* ============================================================================
 *  BLE CONNECTOR  ——  uni-app BLE API 的薄封装,跑完整套连接流程
 * ----------------------------------------------------------------------------
 *  来源:  README §"Connection sequence" 描述的 5 步:
 *           扫描 → 连接 → MTU 247 → 发现服务 → 4 路 notify 订阅
 *           (5d7f9e52 ECG, 5d7f9e53 状态, 5d7f9e54 IMU, 5d7f9e62 命令响应)
 *
 *  对外抽象:
 *    - on('ecg' | 'status' | 'imu' | 'rsp' | 'state' | 'badFrame', fn)
 *    - 每个 payload 都已经经过 frame.decode 校验和拆封,上层拿到的是协议
 *      payload 本身,不必再做帧处理。
 *    - FixtureSource 实现了一致的接口,所以替换数据源不用改 home 页。
 *
 *  本文件区块:
 *    [1] 常量与工具
 *    [2] 类骨架 / 监听管理
 *    [3] 适配器 (openAdapter)
 *    [4] 扫描 (startScan / stopScan)
 *    [5] 连接 (connect)
 *    [6] 通知分发 (_handleNotify)
 *    [7] 写命令 (writeCommand)
 *    [8] 断开 (disconnect)
 * ========================================================================== */

import * as UU from './uuids.js';
import { decode as decodeFrame } from './frame.js';
import { flags } from '../config/featureFlags.js';


// ============================================================================
// [区块 1] 常量与工具
// ============================================================================

const sameUuid = (a, b) => a && b && a.toUpperCase() === b.toUpperCase();


// ============================================================================
// [区块 2] BleConnector 类  ——  状态机 + 事件总线
// ============================================================================

export class BleConnector {
  constructor() {
    this.deviceId = null;
    this.adapterReady = false;
    this.notifyListenerAttached = false;
    this.listeners = { ecg: [], status: [], imu: [], rsp: [], state: [], badFrame: [] };
  }

  // ── 事件管理 ──────────────────────────────────────────────────────
  on(kind, fn)        { (this.listeners[kind] ||= []).push(fn); return () => this.off(kind, fn); }
  off(kind, fn)       { this.listeners[kind] = (this.listeners[kind] || []).filter(f => f !== fn); }
  _emit(kind, ...a)   { for (const f of (this.listeners[kind] || [])) f(...a); }
  _setState(s, info)  { this._emit('state', { state: s, ...(info || {}) }); }


  // ==========================================================================
  // [区块 3] openAdapter  ——  打开蓝牙适配器(幂等)
  // ==========================================================================
  async openAdapter() {
    if (this.adapterReady) return;
    await new Promise((resolve, reject) =>
      uni.openBluetoothAdapter({ success: resolve, fail: reject })
    );
    this.adapterReady = true;
  }


  // ==========================================================================
  // [区块 4] startScan / stopScan  ——  搜索附近 ECG 设备
  // ==========================================================================
  async startScan(onFound) {
    await this.openAdapter();
    this._setState('scanning');

    uni.onBluetoothDeviceFound((res) => {
      for (const d of res.devices) onFound(d);
    });

    await new Promise((resolve, reject) => uni.startBluetoothDevicesDiscovery({
      services: [UU.ECG_DATA_SERVICE],
      allowDuplicatesKey: false,
      success: resolve, fail: reject,
    }));
  }

  async stopScan() {
    return new Promise((resolve) =>
      uni.stopBluetoothDevicesDiscovery({ success: resolve, fail: resolve })
    );
  }


  // ==========================================================================
  // [区块 5] connect  ——  与设备建立连接 + MTU 协商 + 服务发现 + 4 路订阅
  // ==========================================================================
  async connect(deviceId) {
    this.deviceId = deviceId;
    this._setState('connecting', { deviceId });

    // ----- 5.1 建立 ACL 连接 (10s 超时) -----
    await new Promise((resolve, reject) => uni.createBLEConnection({
      deviceId, timeout: 10000, success: resolve, fail: reject,
    }));

    // ----- 5.2 主动 setBLEMTU(247) -----
    // 设备约 500ms 后会自己发一次,这里只是兜底 + 让连接日志更可控。
    // 非 Android 平台会忽略,所以包了 try/catch。
    if (flags.requestBleMtu247) {
      try {
        await new Promise((resolve, reject) => uni.setBLEMTU({
          deviceId, mtu: 247, success: resolve, fail: reject,
        }));
      } catch (_) { /* not supported on this platform */ }
    }

    // ----- 5.3 服务发现 -----
    await new Promise((resolve, reject) => uni.getBLEDeviceServices({
      deviceId, success: resolve, fail: reject,
    }));

    // ----- 5.4 4 路 notify 订阅 -----
    // 备注:uni-app 内部会处理 CCCD 描述符的写入,业务层不必再写 [0x01, 0x00]。
    const subs = [
      [UU.ECG_DATA_SERVICE, UU.ECG_DATA_CHAR],
      [UU.ECG_DATA_SERVICE, UU.STATUS_CHAR],
      [UU.ECG_DATA_SERVICE, UU.IMU_CHAR],
      [UU.ECG_CTRL_SERVICE, UU.CMD_RSP_CHAR],
    ];
    for (const [svc, ch] of subs) {
      // 某些平台必须先调一次 getBLEDeviceCharacteristics 让特征表填上,
      // 否则 notify 会失败。失败时容忍。
      await new Promise((resolve) => uni.getBLEDeviceCharacteristics({
        deviceId, serviceId: svc, success: resolve, fail: resolve,
      }));
      await new Promise((resolve, reject) => uni.notifyBLECharacteristicValueChange({
        deviceId, serviceId: svc, characteristicId: ch, state: true,
        success: resolve, fail: reject,
      }));
    }

    // ----- 5.5 接到通知监听器(只挂一次) -----
    if (!this.notifyListenerAttached) {
      uni.onBLECharacteristicValueChange((res) => this._handleNotify(res));
      this.notifyListenerAttached = true;
    }

    this._setState('ready', { deviceId });
  }


  // ==========================================================================
  // [区块 6] _handleNotify  ——  按特征 UUID 把 payload 派发到对应事件
  // ==========================================================================
  _handleNotify(res) {
    const decoded = decodeFrame(new Uint8Array(res.value));

    // 解帧失败 (sync 错位 / 长度不匹配 / CRC 不过)
    if (!decoded) {
      if (flags.emitBadFrameEvents) {
        this._emit('badFrame', { characteristicId: res.characteristicId, raw: res.value });
      }
      return;
    }

    const cid = res.characteristicId;
    if      (sameUuid(cid, UU.ECG_DATA_CHAR)) this._emit('ecg',    decoded.payload);
    else if (sameUuid(cid, UU.STATUS_CHAR))   this._emit('status', decoded.payload);
    else if (sameUuid(cid, UU.IMU_CHAR))      this._emit('imu',    decoded.payload);
    else if (sameUuid(cid, UU.CMD_RSP_CHAR))  this._emit('rsp',    decoded.payload);
  }


  // ==========================================================================
  // [区块 7] writeCommand  ——  向 5d7f9e61 写已封装好的命令帧
  // ==========================================================================
  async writeCommand(frameBytes) {
    if (!this.deviceId) throw new Error('not connected');

    // uni-app 需要 ArrayBuffer。Uint8Array.buffer 可能比逻辑视图大,所以
    // 用 byteOffset/byteLength 切出准确范围。
    const value = frameBytes.buffer.slice(
      frameBytes.byteOffset,
      frameBytes.byteOffset + frameBytes.byteLength
    );

    return new Promise((resolve, reject) => uni.writeBLECharacteristicValue({
      deviceId: this.deviceId,
      serviceId: UU.ECG_CTRL_SERVICE,
      characteristicId: UU.CMD_WRITE_CHAR,
      value,
      success: resolve, fail: reject,
    }));
  }


  // ==========================================================================
  // [区块 8] disconnect  ——  断开连接(总会成功,即使设备已自行下电)
  // ==========================================================================
  async disconnect() {
    if (!this.deviceId) return;
    const id = this.deviceId;
    this.deviceId = null;
    await new Promise((resolve) =>
      uni.closeBLEConnection({ deviceId: id, success: resolve, fail: resolve })
    );
    this._setState('disconnected');
  }
}
