// uni-app wrapper around the BLE flow described in README §"Connection sequence":
//   scan → connect → MTU 247 → discoverServices → enable notifies on
//   5d7f9e52 (ECG), 5d7f9e53 (status), 5d7f9e54 (IMU), 5d7f9e62 (cmd response).
//
// Emits events with already-unwrapped payloads (i.e. after frame.decode passes
// the CRC and strips sync/len/crc), so consumers only see protocol payloads.

import * as UU from './uuids.js';
import { decode as decodeFrame } from './frame.js';

const sameUuid = (a, b) => a && b && a.toUpperCase() === b.toUpperCase();

export class BleConnector {
  constructor() {
    this.deviceId = null;
    this.adapterReady = false;
    this.notifyListenerAttached = false;
    this.listeners = { ecg: [], status: [], imu: [], rsp: [], state: [], badFrame: [] };
  }

  on(kind, fn)  { (this.listeners[kind] ||= []).push(fn); return () => this.off(kind, fn); }
  off(kind, fn) { this.listeners[kind] = (this.listeners[kind] || []).filter(f => f !== fn); }
  _emit(kind, ...a) { for (const f of (this.listeners[kind] || [])) f(...a); }
  _setState(s, info) { this._emit('state', { state: s, ...(info || {}) }); }

  async openAdapter() {
    if (this.adapterReady) return;
    await new Promise((resolve, reject) =>
      uni.openBluetoothAdapter({ success: resolve, fail: reject })
    );
    this.adapterReady = true;
  }

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

  async connect(deviceId) {
    this.deviceId = deviceId;
    this._setState('connecting', { deviceId });

    await new Promise((resolve, reject) => uni.createBLEConnection({
      deviceId, timeout: 10000, success: resolve, fail: reject,
    }));

    // Per spec step 4: device requests MTU=247 ~500ms after connect.
    // We also request it ourselves so we don't depend on the device-side timing.
    // (App-PLUS only — wrapped in try/catch because non-Android targets ignore it.)
    try {
      await new Promise((resolve, reject) => uni.setBLEMTU({
        deviceId, mtu: 247, success: resolve, fail: reject,
      }));
    } catch (_) { /* not supported on this platform */ }

    await new Promise((resolve, reject) => uni.getBLEDeviceServices({
      deviceId, success: resolve, fail: reject,
    }));

    // Enable notify on the four characteristics. uni-app handles the CCCD
    // descriptor write internally — we don't need to write [0x01, 0x00] ourselves.
    const subs = [
      [UU.ECG_DATA_SERVICE, UU.ECG_DATA_CHAR],
      [UU.ECG_DATA_SERVICE, UU.STATUS_CHAR],
      [UU.ECG_DATA_SERVICE, UU.IMU_CHAR],
      [UU.ECG_CTRL_SERVICE, UU.CMD_RSP_CHAR],
    ];
    for (const [svc, ch] of subs) {
      // Some platforms need getBLEDeviceCharacteristics first to populate the
      // characteristic table; harmless if it errors.
      await new Promise((resolve) => uni.getBLEDeviceCharacteristics({
        deviceId, serviceId: svc, success: resolve, fail: resolve,
      }));
      await new Promise((resolve, reject) => uni.notifyBLECharacteristicValueChange({
        deviceId, serviceId: svc, characteristicId: ch, state: true,
        success: resolve, fail: reject,
      }));
    }

    if (!this.notifyListenerAttached) {
      uni.onBLECharacteristicValueChange((res) => this._handleNotify(res));
      this.notifyListenerAttached = true;
    }

    this._setState('ready', { deviceId });
  }

  _handleNotify(res) {
    const decoded = decodeFrame(new Uint8Array(res.value));
    if (!decoded) {
      this._emit('badFrame', { characteristicId: res.characteristicId, raw: res.value });
      return;
    }
    const cid = res.characteristicId;
    if (sameUuid(cid, UU.ECG_DATA_CHAR)) this._emit('ecg', decoded.payload);
    else if (sameUuid(cid, UU.STATUS_CHAR)) this._emit('status', decoded.payload);
    else if (sameUuid(cid, UU.IMU_CHAR)) this._emit('imu', decoded.payload);
    else if (sameUuid(cid, UU.CMD_RSP_CHAR)) this._emit('rsp', decoded.payload);
  }

  async writeCommand(frameBytes) {
    if (!this.deviceId) throw new Error('not connected');
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
