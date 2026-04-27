/* ============================================================================
 *  FIXTURE SOURCE  ——  把内置/上传的 ECG 样本回放成"伪 BLE 设备"
 * ----------------------------------------------------------------------------
 *  设计动机:
 *    没有真设备时也要能跑完整 UI;为此提供一个与 BleConnector 完全相同的接口
 *    (.on/.off, .startScan/.connect/.writeCommand/.disconnect),并主动按
 *      4 fps 发 ECG  /  1 Hz 发状态
 *    把已经 frame-decoded 后的协议 payload "推"给上层 store。
 *
 *  这同时是回归测试:每次没设备打开 app,parseEcgPayload 的两条易错路径
 *  (LE 顺序 / 24-bit 符号扩展) 都会被这条路径走一遍。
 *
 *  本文件区块:
 *    [1] 常量与归一化
 *    [2] 类骨架 / 监听管理
 *    [3] setSamples / resetSamples  —— 切换播放源
 *    [4] startScan / stopScan / connect / disconnect  —— 假设备生命周期
 *    [5] _buildEcgPayload    —— 构造 ECG 数据帧
 *    [6] _buildStatusPayload —— 构造 Status 数据帧
 *    [7] writeCommand        —— 假装设备处理命令并回 ack
 *    [8] 调试钩子 setElectrode
 * ========================================================================== */

import samples from '@/static/ecg-samples.json';


// ============================================================================
// [区块 1] 常量与归一化
// ----------------------------------------------------------------------------
//  - DEFAULT_SOURCE_SR  : 内置文件的源采样率 (来自 ecg-engine.jsx 的实测值)
//  - TARGET_SR          : 协议规定的设备出帧采样率
//  - PACKET_SAMPLES     : 每包 64 个样本 (250 Hz / 4 fps ≈ 62.5 → 取 64)
//  - PACKET_INTERVAL_MS : 4 fps
//  - INT_SCALE          : ±0.5 mV 映射到 ±500k ADC counts (能塞进 int24)
// ============================================================================

export const DEFAULT_SOURCE_SR = 545; // bundled file ≈ 545 Hz
const TARGET_SR          = 250;
const PACKET_SAMPLES     = 64;
const PACKET_INTERVAL_MS = 250;
const STATUS_INTERVAL_MS = 1000;
const INT_SCALE          = 500000;

// 在模块加载时归一化一次,让 R 峰落在 ±1.0 附近,后面播放时直接乘 INT_SCALE 就行
const PEAK = samples.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
const NORM = 1 / PEAK;


// ============================================================================
// [区块 2] FixtureSource 类骨架
// ============================================================================

export class FixtureSource {
  constructor() {
    this.listeners = { ecg: [], status: [], imu: [], rsp: [], state: [], badFrame: [] };
    this.ecgTimer = null;
    this.statusTimer = null;
    this.realIdx = 0;
    this.seq = 0;

    // 模拟状态字段
    this.battery = 86;
    this.electrode = 0;
    this.deviceState = 1; // 1 = recording

    // 当前激活的样本流 —— 默认内置文件,可通过 setSamples 替换成用户上传的
    this._activeSamples  = samples;
    this._activeNorm     = NORM;
    this._activeSourceSr = DEFAULT_SOURCE_SR;
  }

  on(kind, fn)        { (this.listeners[kind] ||= []).push(fn); return () => this.off(kind, fn); }
  off(kind, fn)       { this.listeners[kind] = (this.listeners[kind] || []).filter(f => f !== fn); }
  _emit(kind, ...a)   { for (const f of (this.listeners[kind] || [])) f(...a); }


  // ==========================================================================
  // [区块 3] setSamples / resetSamples  ——  切换正在播放的 ECG 流
  // ==========================================================================
  // arr: 扁平数字数组   sourceSampleRate: 该数组的源采样率 (Hz)
  // 返回 false 表示参数不合法 (调用方决定要不要给用户提示)
  setSamples(arr, sourceSampleRate) {
    if (!Array.isArray(arr) || arr.length === 0) return false;
    const peak = arr.reduce((m, v) => Math.max(m, Math.abs(Number(v) || 0)), 0) || 1;
    this._activeSamples  = arr;
    this._activeNorm     = 1 / peak;
    this._activeSourceSr = (Number(sourceSampleRate) > 0) ? Number(sourceSampleRate) : DEFAULT_SOURCE_SR;
    this.realIdx = 0;
    return true;
  }

  resetSamples() {
    this._activeSamples  = samples;
    this._activeNorm     = NORM;
    this._activeSourceSr = DEFAULT_SOURCE_SR;
    this.realIdx = 0;
  }


  // ==========================================================================
  // [区块 4] 假设备生命周期  ——  startScan / stopScan / connect / disconnect
  // ==========================================================================
  async startScan(onFound) {
    this._emit('state', { state: 'scanning' });
    setTimeout(() => onFound({
      deviceId: 'fixture:01', name: '心安 ECG · 设备 03', RSSI: -54,
    }), 600);
  }
  async stopScan() {}

  async connect(deviceId) {
    this._emit('state', { state: 'connecting', deviceId });
    await new Promise(r => setTimeout(r, 200));
    this._emit('state', { state: 'ready', deviceId });
    this._startStream();
  }

  _startStream() {
    if (this.ecgTimer) return;
    this.ecgTimer    = setInterval(() => this._emit('ecg',    this._buildEcgPayload(PACKET_SAMPLES)), PACKET_INTERVAL_MS);
    this.statusTimer = setInterval(() => this._emit('status', this._buildStatusPayload()),            STATUS_INTERVAL_MS);
  }

  async disconnect() {
    if (this.ecgTimer)    { clearInterval(this.ecgTimer);    this.ecgTimer    = null; }
    if (this.statusTimer) { clearInterval(this.statusTimer); this.statusTimer = null; }
    this._emit('state', { state: 'disconnected' });
  }


  // ==========================================================================
  // [区块 5] _buildEcgPayload  ——  构造一帧 ECG (10 字节头 + 192 字节数据)
  // ==========================================================================
  _buildEcgPayload(n) {
    const out = new Uint8Array(10 + 192);
    const dv  = new DataView(out.buffer);

    // ----- 10 字节头(布局必须与 parseEcgPayload 完全对齐) -----
    this.seq = (this.seq + 1) & 0xFFFF;
    dv.setUint16(0, this.seq, true);
    dv.setUint32(2, Date.now() & 0xFFFFFFFF, true);
    dv.setUint8 (6, 0);   // flags
    dv.setUint8 (7, n);   // sampleCount
    dv.setUint8 (8, 2);   // gainId (任意演示值)
    dv.setUint8 (9, 0);   // encoding = raw

    // ----- 192 字节数据:把源样本按 source/target 比例采样并写入 -----
    const src  = this._activeSamples;
    const norm = this._activeNorm;
    const step = this._activeSourceSr / TARGET_SR; // 源样本步长
    for (let i = 0; i < n; i++) {
      this.realIdx = (this.realIdx + step) % src.length;
      const v = (Number(src[Math.floor(this.realIdx)]) || 0) * norm;
      const s = Math.max(-0x800000, Math.min(0x7FFFFF, Math.round(v * INT_SCALE)));
      const off = 10 + i * 3;
      out[off]     =  s        & 0xFF;
      out[off + 1] = (s >>  8) & 0xFF;
      out[off + 2] = (s >> 16) & 0xFF;
    }
    return out;
  }


  // ==========================================================================
  // [区块 6] _buildStatusPayload  ——  构造一帧 Status (4 字节头 + 1 条 20 字节记录)
  // ==========================================================================
  _buildStatusPayload() {
    const out = new Uint8Array(4 + 20);
    const dv  = new DataView(out.buffer);

    // ----- 容器头 -----
    dv.setUint16(0, this.seq, true);
    dv.setUint8 (2, 0);    // flags
    dv.setUint8 (3, 1);    // count = 1 (单条实时)

    // ----- 单条记录 -----
    const o = 4;
    dv.setUint32(o + 0,  Date.now() & 0xFFFFFFFF, true);
    dv.setUint32(o + 4,  this.seq * PACKET_SAMPLES, true);
    dv.setUint8 (o + 8,  2);                      // gainId
    dv.setInt8  (o + 9,  -54);                    // bleRssi
    dv.setUint16(o + 10, 12480, true);            // bleTxRateBps
    dv.setUint16(o + 12, 3940, true);             // battVoltageMv
    dv.setUint8 (o + 14, this.battery);
    dv.setUint8 (o + 15, this.electrode);
    dv.setUint8 (o + 16, this.deviceState);

    return out;
  }


  // ==========================================================================
  // [区块 7] writeCommand  ——  小延迟后发出 success 响应,并模拟设备状态变化
  // ==========================================================================
  async writeCommand(frameBytes) {
    // 帧字节里 opcode 在 sync(4) + len(1) 之后,即偏移 5
    const opcode = frameBytes[5];
    setTimeout(() => {
      const rsp = new Uint8Array(4);
      rsp[0] = opcode;
      rsp[1] = 0; // result = success
      rsp[2] = 0; // len lo
      rsp[3] = 0; // len hi
      this._emit('rsp', rsp);
      if (opcode === 0x02) this.deviceState = 1; // start
      if (opcode === 0x03) this.deviceState = 0; // stop
    }, 280);
  }


  // ==========================================================================
  // [区块 8] 调试钩子 setElectrode  ——  开发时用来手工触发电极脱落告警
  // ==========================================================================
  setElectrode(s) { this.electrode = s & 0xFF; }
}
