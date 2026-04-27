/* ============================================================================
 *  HEART RATE  ——  阈值法 R 波检测,估算实时心率
 * ----------------------------------------------------------------------------
 *  设计取舍:
 *    这是给"实时显示心率数字"用的,不是给医学判读用的。
 *    医学场景应当用 Pan-Tompkins 等带通+导数+移动积分的算法。
 *    这里追求的是:每秒能跑、CPU 廉价、对干净归一化波形够用。
 *
 *  返回 0 的两类情形(由调用方决定要不要保留上一次 HR):
 *    1) 信号太平   —— max-min < 0.05
 *    2) 峰太少     —— 不足以估出一个 R-R 平均间隔
 *
 *  本文件区块:
 *    [1] detectHeartRate(samples, sampleRate)  —— 主入口
 * ========================================================================== */


// ============================================================================
// [区块 1] detectHeartRate  ——  阈值 + 最小间距 + 局部极大判断
// ============================================================================

export function detectHeartRate(samples, sampleRate) {
  // 至少要 2 秒数据,否则 R-R 估计太不稳
  if (samples.length < sampleRate * 2) return 0;

  // ── 1. 扫一遍找极值,用来定阈值 ──
  let max = -Infinity, min = Infinity;
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i];
    if (v > max) max = v;
    if (v < min) min = v;
  }
  const range = max - min;
  if (range < 0.05) return 0; // 几乎一条直线

  // ── 2. 阈值 + 最小峰间距 (≤ 167 bpm 上限) ──
  const thresh = min + range * 0.7;
  const minGap = Math.floor(sampleRate * 0.36);

  // ── 3. 收集峰位:超过阈值 + 是局部极大 + 距上一个峰 ≥ minGap ──
  const peaks = [];
  let last = -minGap;
  for (let i = 1; i < samples.length - 1; i++) {
    const v = samples[i];
    if (v > thresh && v >= samples[i - 1] && v >= samples[i + 1] && i - last >= minGap) {
      peaks.push(i);
      last = i;
    }
  }
  if (peaks.length < 2) return 0;

  // ── 4. R-R 平均间隔 → bpm ──
  let sum = 0;
  for (let i = 1; i < peaks.length; i++) sum += peaks[i] - peaks[i - 1];
  const meanGap = sum / (peaks.length - 1);
  if (meanGap <= 0) return 0;

  return Math.round((60 * sampleRate) / meanGap);
}
