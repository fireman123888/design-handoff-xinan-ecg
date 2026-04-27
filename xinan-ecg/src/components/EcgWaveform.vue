<!-- ============================================================================
   ECG WAVEFORM  ——  实时波形 canvas (home 页用)
  ----------------------------------------------------------------------------
   行为:
     从 ecg store 暴露的 ring buffer 取最近 6s @ 250Hz 的快照,在 ringTick
     变化时重绘。

   为什么用新 canvas API (`<canvas type="2d">`):
     旧 API uni.createCanvasContext 在中低端 Android 上 4-10 fps 都吃力;
     新 API 直接拿到 Canvas Node,绘制路径与浏览器一致。

   坐标系:
     模板用 rpx 给 canvas 设尺寸 → setupCanvas 中按真实像素 + DPR 缩放,
     所以高 DPI 屏不糊。绘制几何用 rpx 像素尺寸即可。

   模板区块:
     [T1] 包裹 view + canvas

   脚本区块:
     [S1] props
     [S2] setupCanvas       —— 拿到 canvas node 后做尺寸/DPR 适配
     [S3] draw              —— 每次 ringTick 触发重绘
============================================================================ -->

<template>
  <!-- [T1] -->
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
// ============================================================================
// [S1] props
// ============================================================================
import { watch, onMounted, getCurrentInstance } from 'vue';
import { getRing, ringTick, SAMPLE_RATE_HZ, WINDOW_SECONDS } from '@/stores/ecg.js';

const props = defineProps({
  width:     { type: Number, default: 688 },     // rpx — 750-rpx 屏 31rpx 边距
  height:    { type: Number, default: 168 },     // rpx — ≈ 84dp
  color:     { type: String, default: '#22A98C' },
  lineWidth: { type: Number, default: 2.4 },
});

const canvasId = 'ecg-' + Math.random().toString(36).slice(2, 8);
const instance = getCurrentInstance();

let ctx = null;
let pxW = 0;
let pxH = 0;


// ============================================================================
// [S2] setupCanvas  ——  拿到 canvas node + 应用 pixelRatio
// ============================================================================

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


// ============================================================================
// [S3] draw  ——  从 ring 抓样本 → 沿 X 等距取点 → stroke
// ============================================================================

function draw() {
  if (!ctx) return;
  const totalSamples = SAMPLE_RATE_HZ * WINDOW_SECONDS;
  const samples      = getRing().snapshot(totalSamples);

  ctx.clearRect(0, 0, pxW, pxH);
  ctx.strokeStyle = props.color;
  ctx.lineWidth   = props.lineWidth;
  ctx.lineJoin    = 'round';
  ctx.lineCap     = 'round';

  ctx.beginPath();
  const midY         = pxH / 2;
  const scale        = pxH * 0.38;
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
