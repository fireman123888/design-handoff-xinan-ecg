// Persisted preferences — see README §"6. Settings".
//
// Lives in uni-storage (sync, ~25KB cap on App-PLUS) under one key. We hydrate
// once at module load and write through on every mutation. No batching: the
// settings screen mutations are user-driven, so writes are rare.

import { reactive, watch } from 'vue';

const KEY = 'xinan.prefs.v1';

const defaults = {
  textScale: 1.0,             // 1.0 | 1.15 | 1.3 — applies on next page mount
  hrAlarmHi: 100,
  hrAlarmLo: 55,
  hrAlarmEnabled: true,
  electrodeAlarmEnabled: true,
  batteryAlarmEnabled: true,
  // Demo seed for the family screen. Real builds should sync this from a backend
  // or an in-app contact picker; for the handoff it's static.
  family: [
    { name: '王女士',  role: 'admin',  phone: '13800138001', emergency: true  },
    { name: '王先生',  role: 'viewer', phone: '13800138002', emergency: false },
    { name: '李医生',  role: 'viewer', phone: '13800138003', emergency: false },
  ],
  knownDeviceId: '',           // set after a successful pairing
};

export const prefs = reactive({ ...defaults });

function safeStorage() {
  return typeof uni !== 'undefined' ? uni : null;
}

function load() {
  const u = safeStorage();
  if (!u) return;
  try {
    const raw = u.getStorageSync(KEY);
    if (raw) Object.assign(prefs, JSON.parse(raw));
  } catch (_) { /* corrupt or missing — keep defaults */ }
}
function persist() {
  const u = safeStorage();
  if (!u) return;
  try { u.setStorageSync(KEY, JSON.stringify(prefs)); } catch (_) {}
}

load();
watch(prefs, persist, { deep: true });

// Setters — kept narrow so the settings screen doesn't reach into prefs raw.
export function setTextScale(v) { prefs.textScale = v; }
export function setHrAlarm(enabled) { prefs.hrAlarmEnabled = !!enabled; }
export function setElectrodeAlarm(enabled) { prefs.electrodeAlarmEnabled = !!enabled; }
export function setBatteryAlarm(enabled) { prefs.batteryAlarmEnabled = !!enabled; }
export function setKnownDevice(id) { prefs.knownDeviceId = id || ''; }
