// Recorded sessions — see README §"State Management".
//
// Schema mirrors the suggested Room entity:
//   { id, startTs, endTs, durationSec, avgHr, minHr, maxHr, hasAnomaly,
//     hrTrend: number[],          // ~1-per-second downsample for the detail 24h chart
//     ecgStripSamples: number[] } // 10s @ 250Hz capture for the detail strip
//
// Storage is uni-storage JSON. For real device captures you'd want SQLite +
// blob files (the README's `sampleBlobPath` field), but for the demo we keep
// metadata + tiny representative arrays inline.

import { ref } from 'vue';
import samplesRaw from '@/static/ecg-samples.json';

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

// Seed with a week of demo sessions on first launch so History/Detail aren't empty
// before any real recording exists.
export function seedIfEmpty() {
  if (sessions.value.length > 0) return;
  const now = Date.now();
  const dayMs = 86400000;
  const seeds = [];
  // Normalize the bundled samples once for the strip.
  const peak = samplesRaw.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
  const stripBase = samplesRaw.slice(0, 2500).map(v => v / peak);

  for (let i = 0; i < 7; i++) {
    const start = now - i * dayMs;
    const morning = new Date(start);
    morning.setHours(9, 12, 0, 0);
    const dur = 480 + Math.round(Math.random() * 900);
    const avg = 68 + Math.round(Math.random() * 10);
    const hrTrend = [];
    for (let h = 0; h < 24; h++) {
      const baseline = avg + Math.sin((h / 24) * Math.PI * 2) * 6;
      hrTrend.push(Math.round(baseline + (Math.random() - 0.5) * 4));
    }
    seeds.push({
      id: `seed-${morning.getTime()}`,
      startTs: morning.getTime(),
      endTs: morning.getTime() + dur * 1000,
      durationSec: dur,
      avgHr: avg,
      minHr: avg - 8 - Math.round(Math.random() * 5),
      maxHr: avg + 13 + Math.round(Math.random() * 9),
      hasAnomaly: i === 1, // yesterday flagged
      hrTrend,
      ecgStripSamples: stripBase,
    });
  }
  sessions.value = seeds;
  persist();
}

export function appendSession(s) {
  sessions.value.unshift(s);
  if (sessions.value.length > 100) sessions.value.length = 100;
  persist();
}

export function getById(id) {
  return sessions.value.find(s => s.id === id);
}

// Helpers for the History week summary.
export function weekAvgHr() {
  const recent = sessions.value.slice(0, 7);
  if (recent.length === 0) return 0;
  return Math.round(recent.reduce((s, x) => s + x.avgHr, 0) / recent.length);
}

// Returns 7 entries [Mon..Sun] with avgHr for each weekday in the current week.
// Days with no session show 0 so the chart can render a stub.
export function weekBars() {
  const out = [0, 0, 0, 0, 0, 0, 0];
  const now = new Date();
  const day = now.getDay() === 0 ? 6 : now.getDay() - 1; // Mon-indexed
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - day);
  for (const s of sessions.value) {
    const d = new Date(s.startTs);
    const diff = Math.floor((d - monday) / 86400000);
    if (diff >= 0 && diff < 7) out[diff] = s.avgHr;
  }
  return out;
}
