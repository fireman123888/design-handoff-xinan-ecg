/* ============================================================================
 *  PREFS STORE  ——  用户偏好(字号、告警开关、家人列表、已知设备 ID)
 * ----------------------------------------------------------------------------
 *  来源:  README §"6. Settings"
 *
 *  存储:  uni-storage 同步 KV (App-PLUS 上单 key 上限 ~25KB,够用)。
 *         模块加载时一次性 load,之后任意修改都通过 watch 写回。
 *         不做 batch —— 用户改设置是低频事件。
 *
 *  本文件区块:
 *    [1] 默认值
 *    [2] reactive prefs + 持久化绑定
 *    [3] load / persist
 *    [4] 对外的 setter (避免页面直接乱改 prefs)
 * ========================================================================== */

import { reactive, watch } from 'vue';
import { flags } from '@/config/featureFlags.js';


// ============================================================================
// [区块 1] 存储 key + 默认值
// ============================================================================

const KEY = 'xinan.prefs.v1';

const defaults = {
  textScale: 1.0,                 // 1.0 | 1.15 | 1.3 — 下个页面挂载时生效
  hrAlarmHi: 100,
  hrAlarmLo: 55,
  hrAlarmEnabled:        true,
  electrodeAlarmEnabled: true,
  batteryAlarmEnabled:   true,

  // family —— 演示种子。生产应当从后端同步或用 in-app 联系人选择器。
  family: [
    { name: '王女士',  role: 'admin',  phone: '13800138001', emergency: true  },
    { name: '王先生',  role: 'viewer', phone: '13800138002', emergency: false },
    { name: '李医生',  role: 'viewer', phone: '13800138003', emergency: false },
  ],

  knownDeviceId: '',              // 配对成功后写入
};


// ============================================================================
// [区块 2] reactive prefs + watch 持久化
// ============================================================================

export const prefs = reactive({ ...defaults });

function safeStorage() {
  // SSR / 单测环境没有 uni 全局 —— 返回 null,各 IO 函数自动转空动作
  return typeof uni !== 'undefined' ? uni : null;
}


// ============================================================================
// [区块 3] load / persist  ——  IO 读写
// ============================================================================

function load() {
  if (!flags.persistPrefs) return;
  const u = safeStorage();
  if (!u) return;
  try {
    const raw = u.getStorageSync(KEY);
    if (raw) Object.assign(prefs, JSON.parse(raw));
  } catch (_) { /* 损坏或没有存过 → 保持默认值 */ }
}

function persist() {
  if (!flags.persistPrefs) return;
  const u = safeStorage();
  if (!u) return;
  try { u.setStorageSync(KEY, JSON.stringify(prefs)); } catch (_) {}
}

load();
watch(prefs, persist, { deep: true });


// ============================================================================
// [区块 4] 对外 setter  ——  保持窄接口
// ============================================================================

export function setTextScale(v)         { prefs.textScale = v; }
export function setHrAlarm(enabled)     { prefs.hrAlarmEnabled        = !!enabled; }
export function setElectrodeAlarm(en)   { prefs.electrodeAlarmEnabled = !!en; }
export function setBatteryAlarm(en)     { prefs.batteryAlarmEnabled   = !!en; }
export function setKnownDevice(id)      { prefs.knownDeviceId         = id || ''; }
