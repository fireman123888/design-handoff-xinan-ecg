<template>
  <view class="ecg-canvas-wrap" :style="{ width: width + 'rpx', height: height + 'rpx' }">
    <canvas
      type="2d"
      :id="canvasId"
      class="ecg-canvas"
      :style="{ width: width + 'rpx', height: height + 'rpx' }"
    />
  </view>
</template>

<script setup>
// Live ECG canvas — reads the shared ring buffer and redraws on every `ringTick`
// bump. Uses the new uni-app `<canvas type="2d">` (returns a real Canvas node)
// because the legacy `uni.createCanvasContext` API is too slow at 4–10 fps on
// older Android phones.
//
// Coordinate system: the canvas is sized in rpx in the template; we read the
// actual pixel size back from the node and apply pixelRatio so the line is
// crisp on high-DPI screens. Draw geometry uses the rpx-pixel size.

import { ref, watch, onMounted, getCurrentInstance } from 'vue';
import { getRing, ringTick, SAMPLE_RATE_HZ, WINDOW_SECONDS } from '@/stores/ecg.js';

const props = defineProps({
  width:     { type: Number, default: 688 },     // rpx — fits 750-rpx screen with 31rpx margins
  height:    { type: Number, default: 168 },     // rpx — ≈ 84dp from spec
  color:     { type: String, default: '#22A98C' },
  lineWidth: { type: Number, default: 2.4 },
});

const canvasId = 'ecg-' + Math.random().toString(36).slice(2, 8);
const instance = getCurrentInstance();

let ctx = null;
let pxW = 0;
let pxH = 0;

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
      node.width  = pxW * dpr;
      node.height = pxH * dpr;
      ctx = node.getContext('2d');
      ctx.scale(dpr, dpr);
      draw();
    });
}

function draw() {
  if (!ctx) return;
  const totalSamples = SAMPLE_RATE_HZ * WINDOW_SECONDS;
  const samples = getRing().snapshot(totalSamples);

  ctx.clearRect(0, 0, pxW, pxH);
  ctx.strokeStyle = props.color;
  ctx.lineWidth   = props.lineWidth;
  ctx.lineJoin    = 'round';
  ctx.lineCap     = 'round';

  ctx.beginPath();
  const midY  = pxH / 2;
  const scale = pxH * 0.38;
  const samplesPerPx = samples.length / pxW;
  for (let x = 0; x < pxW; x++) {
    const i = Math.floor(x * samplesPerPx);
    const v = samples[i] || 0;
    const y = midY - v * scale;
    if (x === 0) ctx.moveTo(x, y);
    else         ctx.lineTo(x, y);
  }
  ctx.stroke();
}

watch(ringTick, () => draw());
onMounted(() => setupCanvas());
</script>

<style>
.ecg-canvas-wrap { display: block; }
.ecg-canvas { display: block; }
</style>
