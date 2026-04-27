/* ============================================================================
 *  ECG STORE  ——  实时 ECG 状态总线 (home 页 + 录制聚合)
 * ----------------------------------------------------------------------------
 *  设计:
 *    没有用 Pinia,因为这个 app 实际只有 home 一个屏在订阅这块状态;
 *    一个 reactive() 对象 + 一些纯函数就够。
 *
 *  attach(source) 接受任意"协议事件源":真实的 BleConnector 或者
 *  FixtureSource。两者都暴露同样的 .on('ecg' | 'status' | 'rsp', payload) 接口,
 *  本模块负责把这些字节级 payload → UI 状态 + ring buffer 样本。
 *
 *  本文件区块:
 *    [1] 常量与单位换算
 *    [2] reactive state
 *    [3] ring buffer 与 ringTick
 *    [4] sessionAgg —— 录制期间聚合
 *    [5] attach     —— 绑定数据源 + 三类事件订阅
 *    [6] events 工具
 *    [7] startWithFixture —— home 页 onMounted 用的便捷入口
 *    [8] startRecording / stopRecording
 *    [9] downsample 工具
 * ========================================================================== */

import { reactive, ref } from 'vue';
import { RingBuffer }            from '@/domain/ringBuffer.js';
import { detectHeartRate }       from '@/domain/heartRate.js';
import { parseEcgPayload }       from '@/ble/ecgPacket.js';
import { parseStatusPayload }    from '@/ble/statusPayload.js';
import { parseCommandResponse, startCapture, stopCapture } from '@/ble/command.js';
import { FixtureSource }         from '@/ble/fixtureSource.js';
import { appendSession }         from '@/stores/sessions.js';
import { flags }                 from '@/config/featureFlags.js';


// ============================================================================
// [区块 1] 常量与单位换算
// ----------------------------------------------------------------------------
//  COUNTS_PER_UNIT: ADC counts → 显示单位 的逆比例。
//  正经做法应当根据 gainId 查校准表;这里写常数让 fixture 与真设备路径
//  公用同一个显示比例,直到校准数据可用。
// ============================================================================

export const SAMPLE_RATE_HZ = 250;
export const WINDOW_SECONDS = 6;
const HR_WINDOW_SECONDS     = 4;
const COUNTS_PER_UNIT       = 500000;


// ============================================================================
// [区块 2] reactive state  ——  home 屏直接消费的字段
// ============================================================================

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


// ============================================================================
// [区块 3] ring buffer + ringTick  ——  画布订阅波形重绘的触发器
// ----------------------------------------------------------------------------
// 不把 ring 自身做成 reactive: 那会让 Vue 给 1500 个 float 都装代理,
// 每包白白跑一次 trigger。改成"每包 +1 计数",canvas watch(ringTick) 重绘。
// ============================================================================

const ring = new RingBuffer(SAMPLE_RATE_HZ * WINDOW_SECONDS);
export function getRing() { return ring; }
export const ringTick = ref(0);

let source = null;
let durationTimer = null;


// ============================================================================
// [区块 4] sessionAgg  ——  录制期内的最小-平均-最大、HR 时间序列等聚合
// ============================================================================

let sessionAgg = null;

function newAgg() {
  return {
    startTs: Date.now(),
    hrSamples:     [],   // 每秒一个 HR 读数(粗略)
    minHr:  Infinity,
    maxHr: -Infinity,
    firstStrip: [],      // 前 ~10s @ 250Hz 的样本,给 Detail 页画 strip
    sampleCounter: 0,
  };
}


// ============================================================================
// [区块 5] attach  ——  把数据源(真实 BLE 或 fixture)的事件接到 store
// ============================================================================

export function attach(srcInstance) {
  source = srcInstance;

  // ----- 5.1 状态变化:transmit 给 UI -----
  source.on('state', ({ state: s, deviceId }) => {
    state.connection = s;
    if (deviceId) state.device = { id: deviceId };
  });

  // ----- 5.2 ECG 包:解码 → 入 ring → 周期算 HR → 录制时也喂 sessionAgg -----
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

    // HR 重算节奏:默认每秒一次 (4fps × 4 包) ⇄ 关闭后改为每包都算
    const shouldRecomputeHr = flags.hrRecomputeOncePerSecond
      ? ((pkt.seqNum & 0x03) === 0)
      : true;

    if (shouldRecomputeHr) {
      const snap = ring.snapshot(SAMPLE_RATE_HZ * HR_WINDOW_SECONDS);
      const hr   = detectHeartRate(snap, SAMPLE_RATE_HZ);
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

  // ----- 5.3 Status 包:把第一条记录映射到 state.status -----
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

  // ----- 5.4 命令响应:进事件流(留给将来的"最近活动"侧栏) -----
  source.on('rsp', (payload) => {
    const r = parseCommandResponse(payload);
    pushEvent('rsp', `op 0x${r.opcode.toString(16).padStart(2, '0')} ${r.result === 0 ? '✓' : `✗ (${r.result})`}`);
  });
}


// ============================================================================
// [区块 6] events 工具
// ============================================================================

function pushEvent(kind, text) {
  state.events.unshift({ t: Date.now(), kind, text });
  if (state.events.length > 20) state.events.pop();
}

export function getSource() { return source; }


// ============================================================================
// [区块 7] startWithFixture  ——  home 页 onMounted 时若没接真设备,就用模拟源
// ============================================================================

export async function startWithFixture() {
  if (source) return;
  const src = new FixtureSource();
  attach(src);
  await src.startScan(() => {});
  await src.connect('fixture:01');
  await startRecording();
}


// ============================================================================
// [区块 8] startRecording / stopRecording  ——  下发 0x02 / 0x03 命令并管理聚合
// ============================================================================

export async function startRecording() {
  if (!source) return;
  await source.writeCommand(startCapture());
  state.recording   = true;
  state.startedAt   = Date.now();
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

  // ── 持久化区段(可关) ──
  // 关闭 flags.persistSessionsOnStop 时,history 列表只剩 seed 数据
  if (flags.persistSessionsOnStop && sessionAgg && sessionAgg.hrSamples.length >= 5) {
    const a   = sessionAgg;
    const endTs       = Date.now();
    const durationSec = Math.max(1, Math.floor((endTs - a.startTs) / 1000));
    const avg         = Math.round(a.hrSamples.reduce((s, x) => s + x, 0) / a.hrSamples.length);

    // hrSamples 下采样到 24 桶,Detail 页趋势图固定形状
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


// ============================================================================
// [区块 9] downsample  ——  数组等距分桶平均
// ============================================================================

function downsample(arr, buckets, fallback) {
  if (arr.length === 0) return new Array(buckets).fill(fallback);
  const out = new Array(buckets);
  for (let i = 0; i < buckets; i++) {
    const start = Math.floor((i        / buckets) * arr.length);
    const end   = Math.floor(((i + 1) / buckets) * arr.length);
    let sum = 0, n = 0;
    for (let j = start; j < end; j++) { sum += arr[j]; n++; }
    out[i] = n > 0 ? Math.round(sum / n) : fallback;
  }
  return out;
}
