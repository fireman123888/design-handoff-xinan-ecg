// Reactive state store for the home screen. No Pinia — a plain Vue `reactive()`
// object is enough since this app has a single live screen subscribing to it.
//
// `attach(source)` binds either a real BleConnector or a FixtureSource (both
// expose the same .on('ecg'|'status'|'rsp', payload) surface) and translates
// payloads into UI state + a ring buffer of waveform samples.

import { reactive, ref } from 'vue';
import { RingBuffer } from '@/domain/ringBuffer.js';
import { detectHeartRate } from '@/domain/heartRate.js';
import { parseEcgPayload } from '@/ble/ecgPacket.js';
import { parseStatusPayload } from '@/ble/statusPayload.js';
import { parseCommandResponse, startCapture, stopCapture } from '@/ble/command.js';
import { FixtureSource } from '@/ble/fixtureSource.js';
import { appendSession } from '@/stores/sessions.js';

export const SAMPLE_RATE_HZ  = 250;
export const WINDOW_SECONDS  = 6;
const HR_WINDOW_SECONDS      = 4;

// Inverse of FixtureSource.INT_SCALE — for a real device this should come from
// gainId via a calibration table, but using a constant keeps the fixture and the
// real-device path on the same display scale until calibration data is available.
const COUNTS_PER_UNIT = 500000;

export const state = reactive({
  connection: 'disconnected',  // disconnected | scanning | connecting | ready | error
  device: null,
  hr: 0,
  status: {
    battery:          0,
    rssi:             0,
    bleTxRateBps:     0,
    storedFrameCount: 0,
    electrode:        0,       // 0=ok, 1=L off, 2=R off
    deviceState:      0,
  },
  recording:    false,
  startedAt:    0,
  durationSec:  0,
  events:       [],
});

const ring = new RingBuffer(SAMPLE_RATE_HZ * WINDOW_SECONDS);
export function getRing() { return ring; }

// Bumped each ECG packet so the canvas can `watch()` it and redraw.
// We don't make the ring itself reactive — that would force Vue to proxy 1500 floats
// per packet, which is wasted work for a buffer the canvas reads imperatively.
export const ringTick = ref(0);

let source = null;
let durationTimer = null;

// Per-session aggregates collected while recording — emitted into a Session
// record on stopRecording().
let sessionAgg = null;

function newAgg() {
  return {
    startTs: Date.now(),
    hrSamples: [],          // one HR reading per second (rough)
    minHr: Infinity,
    maxHr: -Infinity,
    firstStrip: [],         // first ~10s @ 250Hz, captured for the Detail screen
    sampleCounter: 0,
  };
}

export function attach(srcInstance) {
  source = srcInstance;

  source.on('state', ({ state: s, deviceId }) => {
    state.connection = s;
    if (deviceId) state.device = { id: deviceId };
  });

  source.on('ecg', (payload) => {
    const pkt = parseEcgPayload(payload);
    const inv = 1 / COUNTS_PER_UNIT;
    for (let i = 0; i < pkt.sampleCount; i++) {
      const v = pkt.samples[i] * inv;
      ring.push(v);
      if (sessionAgg && sessionAgg.firstStrip.length < SAMPLE_RATE_HZ * 10) {
        sessionAgg.firstStrip.push(v);
      }
    }
    ringTick.value = (ringTick.value + 1) | 0;

    // Recompute HR roughly once per second (every 4th packet at 4 fps).
    if ((pkt.seqNum & 0x03) === 0) {
      const snap = ring.snapshot(SAMPLE_RATE_HZ * HR_WINDOW_SECONDS);
      const hr = detectHeartRate(snap, SAMPLE_RATE_HZ);
      if (hr > 0) {
        state.hr = hr;
        if (sessionAgg) {
          sessionAgg.hrSamples.push(hr);
          if (hr < sessionAgg.minHr) sessionAgg.minHr = hr;
          if (hr > sessionAgg.maxHr) sessionAgg.maxHr = hr;
        }
      }
    }
  });

  source.on('status', (payload) => {
    const s = parseStatusPayload(payload);
    if (s.records.length === 0) return;
    const r = s.records[0];
    state.status.battery          = r.battLevelPct;
    state.status.rssi             = r.bleRssi;
    state.status.bleTxRateBps     = r.bleTxRateBps;
    state.status.storedFrameCount = r.storedFrameCount;
    state.status.electrode        = r.electrodeStatus;
    state.status.deviceState      = r.deviceState;
  });

  source.on('rsp', (payload) => {
    const r = parseCommandResponse(payload);
    pushEvent('rsp', `op 0x${r.opcode.toString(16).padStart(2, '0')} ${r.result === 0 ? '✓' : `✗ (${r.result})`}`);
  });
}

function pushEvent(kind, text) {
  state.events.unshift({ t: Date.now(), kind, text });
  if (state.events.length > 20) state.events.pop();
}

export function getSource() { return source; }

// Convenience entry point used by the home screen when there's no real device.
export async function startWithFixture() {
  if (source) return;
  const src = new FixtureSource();
  attach(src);
  await src.startScan(() => {});
  await src.connect('fixture:01');
  await startRecording();
}

export async function startRecording() {
  if (!source) return;
  await source.writeCommand(startCapture());
  state.recording = true;
  state.startedAt = Date.now();
  state.durationSec = 0;
  sessionAgg = newAgg();
  if (!durationTimer) {
    durationTimer = setInterval(() => {
      if (state.recording) state.durationSec = Math.floor((Date.now() - state.startedAt) / 1000);
    }, 1000);
  }
}

export async function stopRecording() {
  if (!source) return;
  await source.writeCommand(stopCapture());
  state.recording = false;

  // Persist the session if we collected enough to be useful (≥ 5 seconds of HR).
  if (sessionAgg && sessionAgg.hrSamples.length >= 5) {
    const a = sessionAgg;
    const endTs = Date.now();
    const durationSec = Math.max(1, Math.floor((endTs - a.startTs) / 1000));
    const avg = Math.round(a.hrSamples.reduce((s, x) => s + x, 0) / a.hrSamples.length);
    // Downsample HR samples to 24 buckets so the detail trend chart has a fixed shape.
    const hrTrend = downsample(a.hrSamples, 24, avg);
    appendSession({
      id: `sess-${a.startTs}`,
      startTs:    a.startTs,
      endTs,
      durationSec,
      avgHr:      avg,
      minHr:      isFinite(a.minHr) ? a.minHr : avg,
      maxHr:      isFinite(a.maxHr) ? a.maxHr : avg,
      hasAnomaly: a.maxHr > 100 || a.minHr < 50,
      hrTrend,
      ecgStripSamples: a.firstStrip.slice(),
    });
  }
  sessionAgg = null;
}

function downsample(arr, buckets, fallback) {
  if (arr.length === 0) return new Array(buckets).fill(fallback);
  const out = new Array(buckets);
  for (let i = 0; i < buckets; i++) {
    const start = Math.floor((i / buckets) * arr.length);
    const end   = Math.floor(((i + 1) / buckets) * arr.length);
    let sum = 0, n = 0;
    for (let j = start; j < end; j++) { sum += arr[j]; n++; }
    out[i] = n > 0 ? Math.round(sum / n) : fallback;
  }
  return out;
}
