<template>
  <view class="paper-wrap" :style="{ width: width + 'rpx', height: height + 'rpx' }">
    <canvas
      type="2d"
      :id="canvasId"
      class="paper-canvas"
      :style="{ width: width + 'rpx', height: height + 'rpx' }"
    />
  </view>
</template>

<script setup>
// Static ECG strip rendered on pink graph paper — used by the Detail screen
// (§"4. Detail" — "Sample 10s ECG strip on pink graph paper"). Unlike the live
// canvas this only redraws when the `samples` prop changes.

import { watch, onMounted, getCurrentInstance } from 'vue';

const props = defineProps({
  samples:   { type: Array,  default: () => [] },
  width:     { type: Number, default: 688 },
  height:    { type: Number, default: 320 },
  color:     { type: String, default: '#15212E' },
  paperBg:   { type: String, default: '#FBE8EE' },
  gridFine:  { type: String, default: 'rgba(193, 47, 76, 0.18)' },
  gridBold:  { type: String, default: 'rgba(193, 47, 76, 0.32)' },
  lineWidth: { type: Number, default: 2 },
});

const canvasId = 'paper-' + Math.random().toString(36).slice(2, 8);
const instance = getCurrentInstance();

let ctx = null;
let pxW = 0, pxH = 0;

function setupCanvas() {
  uni.createSelectorQuery().in(instance.proxy)
    .select('#' + canvasId)
    .fields({ node: true, size: true })
    .exec((res) => {
      if (!res || !res[0] || !res[0].node) return;
      const node = res[0].node;
      pxW = res[0].width;
      pxH = res[0].height;
      const dpr = (uni.getSystemInfoSync && uni.getSystemInfoSync().pixelRatio) || 1;
      node.width = pxW * dpr;
      node.height = pxH * dpr;
      ctx = node.getContext('2d');
      ctx.scale(dpr, dpr);
      draw();
    });
}

function draw() {
  if (!ctx) return;
  ctx.fillStyle = props.paperBg;
  ctx.fillRect(0, 0, pxW, pxH);

  // Standard ECG paper: 1mm small squares, 5mm bold squares. Render as 8px / 40px.
  const fine = 8, bold = 40;
  ctx.strokeStyle = props.gridFine;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= pxW; x += fine) { ctx.moveTo(x, 0); ctx.lineTo(x, pxH); }
  for (let y = 0; y <= pxH; y += fine) { ctx.moveTo(0, y); ctx.lineTo(pxW, y); }
  ctx.stroke();
  ctx.strokeStyle = props.gridBold;
  ctx.beginPath();
  for (let x = 0; x <= pxW; x += bold) { ctx.moveTo(x, 0); ctx.lineTo(x, pxH); }
  for (let y = 0; y <= pxH; y += bold) { ctx.moveTo(0, y); ctx.lineTo(pxW, y); }
  ctx.stroke();

  const samples = props.samples;
  if (!samples || samples.length === 0) return;

  // Auto-fit amplitude to *this* strip's largest absolute deflection — different
  // recordings can sit at very different gains and a fixed scale either clips
  // or under-uses the canvas. Center on 0 (DC) so R-peaks dominate the upper
  // half and Q/S dip into the lower half, matching standard ECG convention.
  let absMax = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i]);
    if (a > absMax) absMax = a;
  }
  if (absMax === 0) absMax = 1;
  const midY  = pxH / 2;
  const scale = (pxH * 0.42) / absMax;
  const samplesPerPx = samples.length / pxW;

  ctx.strokeStyle = props.color;
  ctx.lineWidth   = props.lineWidth;
  ctx.lineJoin    = 'round';
  ctx.lineCap     = 'round';
  ctx.beginPath();
  if (samplesPerPx <= 1) {
    // Sparse: ordinary connect-the-dots.
    for (let x = 0; x < pxW; x++) {
      const i = Math.floor(x * samplesPerPx);
      const y = midY - (samples[i] || 0) * scale;
      if (x === 0) ctx.moveTo(x, y);
      else         ctx.lineTo(x, y);
    }
  } else {
    // Dense: per-column min/max envelope. Without this, picking one sample per
    // pixel column drops most R-peaks (they're 1-2 sample wide spikes) and the
    // strip looks small and ragged. This is the standard high-density ECG /
    // audio waveform rendering technique.
    for (let x = 0; x < pxW; x++) {
      const i0 = Math.floor(x * samplesPerPx);
      const i1 = Math.min(samples.length, Math.floor((x + 1) * samplesPerPx));
      let lo = samples[i0], hi = lo;
      for (let i = i0 + 1; i < i1; i++) {
        const v = samples[i];
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      const yHi = midY - hi * scale;
      const yLo = midY - lo * scale;
      if (x === 0) ctx.moveTo(x, yHi);
      ctx.lineTo(x, yHi);
      ctx.lineTo(x, yLo);
    }
  }
  ctx.stroke();
}

watch(() => props.samples, () => draw());
onMounted(() => setupCanvas());
</script>

<style>
.paper-wrap   { display: block; border-radius: 24rpx; overflow: hidden; }
.paper-canvas { display: block; }
</style>
