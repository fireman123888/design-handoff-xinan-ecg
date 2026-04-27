/* ============================================================================
 *  SESSIONS STORE  ——  历史会话(每次"开始记录 → 停止记录")
 * ----------------------------------------------------------------------------
 *  Schema (与 README §"State Management" 中建议的 Room 实体对齐):
 *    {
 *      id, startTs, endTs, durationSec,
 *      avgHr, minHr, maxHr,
 *      hasAnomaly: boolean,
 *      hrTrend: number[],          // ~每秒一个的下采样,用于 Detail 24h 图
 *      ecgStripSamples: number[],  // 10s @ 250Hz,用于 Detail 的 ECG 片段
 *    }
 *
 *  存储:  uni-storage JSON。真实采集应改成 SQLite + 二进制 blob 文件
 *        (README 提到的 sampleBlobPath),demo 阶段把元数据 + 小样本数组 inline。
 *
 *  本文件区块:
 *    [1] 加载/持久化
 *    [2] seedIfEmpty   —— 首次启动注入演示数据
 *    [3] appendSession —— 录制结束后调用
 *    [4] getById       —— Detail 页查询
 *    [5] week 聚合     —— History 页的本周平均、本周柱状图
 * ========================================================================== */

import { ref } from 'vue';
import samplesRaw from '@/static/ecg-samples.json';
import { flags } from '@/config/featureFlags.js';


// ============================================================================
// [区块 1] 加载 / 持久化
// ============================================================================

const KEY = 'xinan.sessions.v1';

export const sessions = ref([]);

function safeStorage() { return typeof uni !== 'undefined' ? uni : null; }

function load() {
  const u = safeStorage();
  if (!u) return;
  try {
    const raw = u.getStorageSync(KEY);
    if (raw) sessions.value = JSON.parse(raw);
  } catch (_) {}
}

function persist() {
  const u = safeStorage();
  if (!u) return;
  try { u.setStorageSync(KEY, JSON.stringify(sessions.value)); } catch (_) {}
}

load();


// ============================================================================
// [区块 2] seedIfEmpty  ——  历史为空时注入 7 天演示数据
// ----------------------------------------------------------------------------
// 让 History/Detail 在没有任何真实记录时也能展示视觉。
// 受 flags.seedDemoSessionsWhenEmpty 控制 —— 真实生产应当关掉。
// ============================================================================

export function seedIfEmpty() {
  if (!flags.seedDemoSessionsWhenEmpty) return;
  if (sessions.value.length > 0) return;

  const now   = Date.now();
  const dayMs = 86400000;
  const seeds = [];

  // 把内置样本归一化一次,后面给每条 seed 复用
  const peak      = samplesRaw.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
  const stripBase = samplesRaw.slice(0, 2500).map(v => v / peak);

  for (let i = 0; i < 7; i++) {
    const start   = now - i * dayMs;
    const morning = new Date(start);
    morning.setHours(9, 12, 0, 0);

    const dur     = 480 + Math.round(Math.random() * 900);
    const avg     = 68  + Math.round(Math.random() * 10);

    // 24 小时趋势:正弦基线 + 噪声,让图有起伏
    const hrTrend = [];
    for (let h = 0; h < 24; h++) {
      const baseline = avg + Math.sin((h / 24) * Math.PI * 2) * 6;
      hrTrend.push(Math.round(baseline + (Math.random() - 0.5) * 4));
    }

    seeds.push({
      id: `seed-${morning.getTime()}`,
      startTs: morning.getTime(),
      endTs:   morning.getTime() + dur * 1000,
      durationSec: dur,
      avgHr: avg,
      minHr: avg - 8  - Math.round(Math.random() * 5),
      maxHr: avg + 13 + Math.round(Math.random() * 9),
      hasAnomaly: i === 1, // 让"昨天"挂个异常标记,演示 anomaly UI
      hrTrend,
      ecgStripSamples: stripBase,
    });
  }
  sessions.value = seeds;
  persist();
}


// ============================================================================
// [区块 3] appendSession  ——  录制结束后追加
// ============================================================================

export function appendSession(s) {
  sessions.value.unshift(s);
  if (sessions.value.length > 100) sessions.value.length = 100; // 截断防膨胀
  persist();
}


// ============================================================================
// [区块 4] getById  ——  Detail 页用 id 查询
// ============================================================================

export function getById(id) {
  return sessions.value.find(s => s.id === id);
}


// ============================================================================
// [区块 5] 周聚合  ——  History 页用
// ============================================================================

// 最近 7 条的平均心率
export function weekAvgHr() {
  const recent = sessions.value.slice(0, 7);
  if (recent.length === 0) return 0;
  return Math.round(recent.reduce((s, x) => s + x.avgHr, 0) / recent.length);
}

// 返回 [周一..周日] 7 个 avgHr;某天没有记录就给 0,让图表能画占位柱
export function weekBars() {
  const out = [0, 0, 0, 0, 0, 0, 0];
  const now = new Date();
  const day = now.getDay() === 0 ? 6 : now.getDay() - 1; // 周一为索引 0
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - day);
  for (const s of sessions.value) {
    const d    = new Date(s.startTs);
    const diff = Math.floor((d - monday) / 86400000);
    if (diff >= 0 && diff < 7) out[diff] = s.avgHr;
  }
  return out;
}
