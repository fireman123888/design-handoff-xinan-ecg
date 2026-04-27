<!-- ============================================================================
   ECG PAPER CANVAS  ——  静态 ECG 片段渲染在粉色 ECG 网格纸上
  ----------------------------------------------------------------------------
   来源:  README §"4. Detail" — "Sample 10s ECG strip on pink graph paper"

   与 EcgWaveform.vue 的区别:
     - 这个是"静态"画一次,只有 props.samples 变了才重画;不订阅 ring。
     - 背景画的是 ECG 网格纸 (1mm/5mm 刻度,像素映射到 8px/40px)。
     - 高密度采样下用 min/max 包络渲染 (受 flags.paperCanvasUseEnvelopeRender
       控制),保留 R 峰;关掉则退回每列取一点的 connect-the-dots,适合稀疏数据。

   模板区块:
     [T1] 包裹 + canvas

   脚本区块:
     [S1] props 与依赖
     [S2] setupCanvas
     [S3] draw  →  分三段:[3a] 网格  [3b] 自适应纵向缩放  [3c] 描线
============================================================================ -->

<template>
  <!-- [T1] -->
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
// ============================================================================
// [S1] props 与依赖
// ============================================================================
import { watch, onMounted, getCurrentInstance } from 'vue';
import { flags } from '@/config/featureFlags.js';

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


// ============================================================================
// [S2] setupCanvas  ——  尺寸读取 + DPR 缩放 (与 EcgWaveform 同套路)
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
      node.width = pxW * dpr;
      node.height = pxH * dpr;
      ctx = node.getContext('2d');
      ctx.scale(dpr, dpr);
      draw();
    });
}


// ============================================================================
// [S3] draw  ——  网格 + 自适应缩放 + 描线
// ============================================================================

function draw() {
  if (!ctx) return;

  // -------- [3a] 背景 + ECG 网格(1mm 细 / 5mm 粗) --------
  ctx.fillStyle = props.paperBg;
  ctx.fillRect(0, 0, pxW, pxH);

  const fine = 8, bold = 40; // 1mm → 8px, 5mm → 40px (近似)
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

  // -------- [3b] 自适应纵向缩放 --------
  // 不同录制可能在不同增益下,用固定比例要么裁剪要么浪费画布。
  // 这里以本片段最大绝对值为基,把波形居中(0 = 直流),让 R 峰占用约 84% 高度。
  let absMax = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i]);
    if (a > absMax) absMax = a;
  }
  if (absMax === 0) absMax = 1;
  const midY         = pxH / 2;
  const scale        = (pxH * 0.42) / absMax;
  const samplesPerPx = samples.length / pxW;

  // -------- [3c] 描线 --------
  ctx.strokeStyle = props.color;
  ctx.lineWidth   = props.lineWidth;
  ctx.lineJoin    = 'round';
  ctx.lineCap     = 'round';
  ctx.beginPath();

  if (samplesPerPx <= 1) {
    // ── 稀疏:连点画线 ──
    for (let x = 0; x < pxW; x++) {
      const i = Math.floor(x * samplesPerPx);
      const y = midY - (samples[i] || 0) * scale;
      if (x === 0) ctx.moveTo(x, y);
      else         ctx.lineTo(x, y);
    }
  } else if (flags.paperCanvasUseEnvelopeRender) {
    // ── 密集 + 包络:每列扫一遍 min/max,先画上极值再画下极值 ──
    // 这是 ECG/音频波形的标准高密度渲染。R 峰只占 1-2 个样本,如果一列只取一个
    // 样本会大概率漏掉,显示出来就是"小而毛糙"。
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
  } else {
    // ── 密集 + 关闭包络:每列只采一个样本(可能漏 R 峰) ──
    for (let x = 0; x < pxW; x++) {
      const i = Math.floor(x * samplesPerPx);
      const y = midY - (samples[i] || 0) * scale;
      if (x === 0) ctx.moveTo(x, y);
      else         ctx.lineTo(x, y);
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
