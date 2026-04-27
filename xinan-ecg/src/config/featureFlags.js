/* ============================================================================
 *  FEATURE FLAGS  ——  整个 app 的"开关总闸"
 * ----------------------------------------------------------------------------
 *  目的:
 *    - 把全 app 各处可独立开关的功能集中放在这里,代码里通过
 *      `if (flags.xxx) { ... }` 或模板里 `v-if="flags.xxx"` 来控制是否启用。
 *    - 改这里的某一项 → 不删除/不动业务代码,就能立刻关掉某个功能、某段
 *      日志或某段动画,便于排查和裁剪。
 *
 *  约定:
 *    1. 默认值都为 `true`,即"全部按现行行为运行";改成 `false` 应当只
 *       让"对应那块功能"消失,不应让 app 崩。
 *    2. 这个文件本身没有 import 业务代码,业务代码 import 它 —— 单向依赖。
 *    3. 增删 flag 时,顺手在下面注释里写清楚"它控制了哪个文件的哪块"。
 *
 *  分类:
 *    [BLE]      —— 蓝牙连接 / 协议解码
 *    [DOMAIN]   —— 领域计算 (HR、ring buffer)
 *    [STORE]    —— 状态存储 / 持久化
 *    [UI]       —— Vue 组件 / 页面 / 动画
 *    [DEV]      —— 开发期日志、模拟数据等
 * ========================================================================== */

export const flags = {
  // -------------------------- [BLE] -----------------------------------------

  // bleConnector.js — connect 流程里是否主动 setBLEMTU(247)。
  // 设备本身约 500ms 后会发一次,所以即使关掉也能跑;留着只是给非 Android 平台
  // 一个保底。关了能让连接日志更干净。
  requestBleMtu247: true,

  // frame.js — decode 时是否做 CRC16 校验。生产建议 true;调试某些被截断的包
  // 时可以临时关掉来观察原始 payload。
  verifyFrameCrc: true,

  // bleConnector.js — 出现解帧失败时是否 emit 'badFrame' 事件供上层统计。
  emitBadFrameEvents: true,

  // ecgPacket.js — 是否支持 DPCM 编码 (encoding=1)。如果设备永远只会发原始
  // 24-bit (encoding=0),可以关掉以减少代码路径。
  dpcmEncodingSupport: true,

  // -------------------------- [DOMAIN] --------------------------------------

  // ecg.js (store) — HR 检测的频率。true = 每 4 个包 (~1Hz) 算一次;false =
  // 每个 ECG 包都算 (~4Hz),CPU 略高但响应更快。
  hrRecomputeOncePerSecond: true,

  // ecg.js — 录制结束后是否把 session 写入持久化。关掉后 history 列表只剩
  // seed 数据,适合演示/调试。
  persistSessionsOnStop: true,

  // sessions.js — 历史为空时是否注入 7 天演示数据。生产/真实设备用关掉。
  seedDemoSessionsWhenEmpty: true,

  // -------------------------- [STORE] ---------------------------------------

  // prefs.js — 是否把偏好持久化到 uni-storage。关掉后每次启动恢复默认。
  persistPrefs: true,

  // -------------------------- [UI] ------------------------------------------

  // home.vue 启动时自动接入 FixtureSource。如果接的是真设备,把这个关掉,然后
  // 在 pairing 流程里自己 attach() BleConnector。
  autoStartFixtureOnHome: true,

  // home.vue — "选择文件 / 采样率"两行(允许用户用自己的 ECG JSON 替换内置数据)。
  // 关掉后这两行消失,适合给真实用户的精简版本。
  showFilePickerRow: true,
  showSampleRateRow: true,

  // home.vue 文件选择 — 是否尝试从文件头嗅探采样率 (Fs=, sample rate=...)
  enableSampleRateSniffer: true,

  // AlarmOverlay.vue — 整个全屏电极脱落告警的总开关。关掉后无论 prefs 设置如何
  // 都不显示。
  enableAlarmOverlay: true,

  // AlarmOverlay.vue — "呼叫家人帮忙"按钮真的拨号。关掉后按钮变成空动作。
  enableEmergencyCallButton: true,

  // family.vue — 是否对手机号做掩码显示 (138 **** 8001)。
  maskFamilyPhoneNumbers: true,

  // EcgPaperCanvas.vue — 高密度采样下用 min/max 包络绘制(保留尖峰)。关掉
  // 会退回简单的 connect-the-dots,小屏密集波形会丢峰。
  paperCanvasUseEnvelopeRender: true,

  // ---- 动画类(关掉后 UI 静止,适合截图、低性能机或省电场景) ----
  enableHeartPulseAnimation: true,    // home.vue 心形脉动
  enableRecDotAnimation:     true,    // home.vue 录制红点闪烁
  enableRadarAnimation:      true,    // pairing/scanning.vue 雷达扩散环
  enableAlarmRingPulse:      true,    // AlarmOverlay.vue 警告大圆扩散

  // -------------------------- [DEV] -----------------------------------------

  // 整个 app 的"开发模式日志总开关"。各模块里凡是 `if (flags.verboseLogs)
  // console.log(...)` 的地方都受它控制。关闭后控制台干净,适合提交版本。
  verboseLogs: false,

  // pages/pairing/welcome.vue — 是否打印 navigateTo 调试日志。这是早期排查
  // 路由的痕迹,平时可关。
  logPairingNavigations: false,
};

// 保护一下:防止业务代码不小心写入 flags 改运行时行为(不是预期用法)。
// 注:Object.freeze 是浅的,这里 flags 都是基本类型,够用了。
Object.freeze(flags);

export default flags;
