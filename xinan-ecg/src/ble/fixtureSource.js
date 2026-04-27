// FixtureSource — replays ecg-samples.json as if it were a live device.
// Surface matches BleConnector exactly (.on/.off, .startScan/.connect/.writeCommand/.disconnect),
// so the home screen consumer can swap implementations without code changes.
//
// Each "ECG" event carries a fully-formed protocol payload (10-byte header + 192 bytes of
// 24-bit raw samples), so the same parseEcgPayload() path that runs against the real device
// also exercises the fixture path. The two pitfalls (LE order, 24-bit sign extension) get
// tested every time you launch the app without a device.

import samples from '@/static/ecg-samples.json';

// Default source rate of the bundled file. This is just a default — every
// uploaded file can declare its own rate via setSamples(arr, sr) so playback
// timing matches the captured ECG (otherwise R-R intervals warp).
export const DEFAULT_SOURCE_SR = 545; // see ecg-engine.jsx — bundled file ≈ 545 Hz
const TARGET_SR = 250;      // device sample rate per spec
const PACKET_SAMPLES = 64;  // 250 / 4 fps ≈ 62.5 → use 64
const PACKET_INTERVAL_MS = 250; // 4 fps per spec
const STATUS_INTERVAL_MS = 1000;
const INT_SCALE = 500000;   // ±0.5 mV mapped to ±500k ADC counts (arbitrary, fits int24)

// Normalize once at module load so the R-peak sits near ±1.0.
const PEAK = samples.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
const NORM = 1 / PEAK;

export class FixtureSource {
  constructor() {
    this.listeners = { ecg: [], status: [], imu: [], rsp: [], state: [], badFrame: [] };
    this.ecgTimer = null;
    this.statusTimer = null;
    this.realIdx = 0;
    this.seq = 0;
    this.battery = 86;
    this.electrode = 0;
    this.deviceState = 1; // 1 = recording
    // Active sample stream — defaults to the bundled file but can be swapped
    // at runtime via setSamples() so the user can drop in their own JSON.
    this._activeSamples  = samples;
    this._activeNorm     = NORM;
    this._activeSourceSr = DEFAULT_SOURCE_SR;
  }

  // Replace the active sample stream. Accepts a flat number array and an optional
  // source sample rate (Hz) so playback step math stays accurate when a user
  // uploads ECG captured at a rate different from the bundled file.
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

  on(kind, fn)  { (this.listeners[kind] ||= []).push(fn); return () => this.off(kind, fn); }
  off(kind, fn) { this.listeners[kind] = (this.listeners[kind] || []).filter(f => f !== fn); }
  _emit(kind, ...a) { for (const f of (this.listeners[kind] || [])) f(...a); }

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
    this.ecgTimer = setInterval(() => {
      this._emit('ecg', this._buildEcgPayload(PACKET_SAMPLES));
    }, PACKET_INTERVAL_MS);
    this.statusTimer = setInterval(() => {
      this._emit('status', this._buildStatusPayload());
    }, STATUS_INTERVAL_MS);
  }

  _buildEcgPayload(n) {
    // Layout matches parseEcgPayload exactly: 10-byte header + 192-byte data block.
    const out = new Uint8Array(10 + 192);
    const dv = new DataView(out.buffer);
    this.seq = (this.seq + 1) & 0xFFFF;
    dv.setUint16(0, this.seq, true);
    dv.setUint32(2, Date.now() & 0xFFFFFFFF, true);
    dv.setUint8(6, 0);   // flags
    dv.setUint8(7, n);   // sampleCount
    dv.setUint8(8, 2);   // gainId (arbitrary)
    dv.setUint8(9, 0);   // encoding = raw
    const src = this._activeSamples;
    const norm = this._activeNorm;
    const step = this._activeSourceSr / TARGET_SR; // source samples per emitted sample
    for (let i = 0; i < n; i++) {
      this.realIdx = (this.realIdx + step) % src.length;
      const v = (Number(src[Math.floor(this.realIdx)]) || 0) * norm;
      const s = Math.max(-0x800000, Math.min(0x7FFFFF, Math.round(v * INT_SCALE)));
      const off = 10 + i * 3;
      out[off]     =  s        & 0xFF;
      out[off + 1] = (s >> 8)  & 0xFF;
      out[off + 2] = (s >> 16) & 0xFF;
    }
    return out;
  }

  _buildStatusPayload() {
    // Container (4) + 1 record (20) = 24 bytes.
    const out = new Uint8Array(4 + 20);
    const dv = new DataView(out.buffer);
    dv.setUint16(0, this.seq, true);
    dv.setUint8(2, 0);   // flags
    dv.setUint8(3, 1);   // count = 1 (realtime)
    const o = 4;
    dv.setUint32(o + 0, Date.now() & 0xFFFFFFFF, true);
    dv.setUint32(o + 4, this.seq * PACKET_SAMPLES, true);
    dv.setUint8(o + 8, 2);              // gainId
    dv.setInt8(o + 9, -54);             // bleRssi
    dv.setUint16(o + 10, 12480, true);  // bleTxRateBps
    dv.setUint16(o + 12, 3940, true);   // battVoltageMv
    dv.setUint8(o + 14, this.battery);  // battLevelPct
    dv.setUint8(o + 15, this.electrode);
    dv.setUint8(o + 16, this.deviceState);
    return out;
  }

  async writeCommand(frameBytes) {
    // Synthesize a success response after a small delay. We peek the opcode out
    // of the framed bytes (sync 4 + len 1 + opcode 1 = byte index 5).
    const opcode = frameBytes[5];
    setTimeout(() => {
      const rsp = new Uint8Array(4);
      rsp[0] = opcode;
      rsp[1] = 0;       // result = success
      rsp[2] = 0;       // len lo
      rsp[3] = 0;       // len hi
      this._emit('rsp', rsp);
      if (opcode === 0x02) this.deviceState = 1; // start
      if (opcode === 0x03) this.deviceState = 0; // stop
    }, 280);
  }

  async disconnect() {
    if (this.ecgTimer) { clearInterval(this.ecgTimer); this.ecgTimer = null; }
    if (this.statusTimer) { clearInterval(this.statusTimer); this.statusTimer = null; }
    this._emit('state', { state: 'disconnected' });
  }

  // Dev affordance: flip electrode_status to test the warn banner / alarm overlay.
  setElectrode(s) { this.electrode = s & 0xFF; }
}
