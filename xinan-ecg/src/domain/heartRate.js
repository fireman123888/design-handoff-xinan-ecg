// Threshold-based R-peak detector — good enough for a live HR display on a
// clean, normalized waveform. Real cardiology should use Pan-Tompkins; this
// is intentionally simple so it stays cheap to run on every status tick.
//
// Returns 0 when the signal is too flat or there aren't enough peaks to
// estimate an interval — caller should keep showing the previous value.

export function detectHeartRate(samples, sampleRate) {
  if (samples.length < sampleRate * 2) return 0;

  let max = -Infinity, min = Infinity;
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i];
    if (v > max) max = v;
    if (v < min) min = v;
  }
  const range = max - min;
  if (range < 0.05) return 0;

  const thresh = min + range * 0.7;
  const minGap = Math.floor(sampleRate * 0.36); // ≤ 167 bpm cap
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

  let sum = 0;
  for (let i = 1; i < peaks.length; i++) sum += peaks[i] - peaks[i - 1];
  const meanGap = sum / (peaks.length - 1);
  if (meanGap <= 0) return 0;
  return Math.round((60 * sampleRate) / meanGap);
}
