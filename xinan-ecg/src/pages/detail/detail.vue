<template>
  <view class="screen" v-if="session">
    <view class="header">
      <text class="header-date">{{ headerDate }}</text>
      <text class="header-duration">记录时长 {{ formatDuration(session.durationSec) }}</text>
    </view>

    <!-- Stats card -->
    <view class="card stats-card">
      <view class="stat-main">
        <text class="stat-label">平均心率</text>
        <view class="stat-mega-row">
          <text class="stat-mega">{{ session.avgHr }}</text>
          <text class="stat-unit">次/分</text>
        </view>
      </view>
      <view class="stat-side">
        <view class="stat-side-row">
          <text class="stat-side-label">最低</text>
          <text class="stat-side-value">{{ session.minHr }}</text>
        </view>
        <view class="stat-side-divider" />
        <view class="stat-side-row">
          <text class="stat-side-label">最高</text>
          <text class="stat-side-value">{{ session.maxHr }}</text>
        </view>
      </view>
    </view>

    <!-- 24h trend -->
    <text class="section-label">24 小时心率趋势</text>
    <view class="card trend-card">
      <view class="trend-axis">
        <text class="trend-axis-label">110</text>
        <text class="trend-axis-label">85</text>
        <text class="trend-axis-label">60</text>
      </view>
      <view class="trend-plot">
        <view class="trend-band" />
        <view class="trend-line">
          <view
            v-for="(hr, idx) in session.hrTrend"
            :key="idx"
            class="trend-dot"
            :style="{
              left: ((idx / (session.hrTrend.length - 1)) * 100) + '%',
              bottom: trendDotBottom(hr),
            }"
          />
        </view>
        <view class="trend-hours">
          <text class="trend-hour">0</text>
          <text class="trend-hour">6</text>
          <text class="trend-hour">12</text>
          <text class="trend-hour">18</text>
          <text class="trend-hour">24</text>
        </view>
      </view>
    </view>

    <!-- 10s ECG strip on graph paper -->
    <text class="section-label">10 秒 ECG 片段</text>
    <ecg-paper-canvas :samples="session.ecgStripSamples" :width="688" :height="420" />

    <!-- Anomaly callout -->
    <view v-if="session.hasAnomaly" class="anomaly">
      <text class="anomaly-glyph">!</text>
      <view class="anomaly-text">
        <text class="anomaly-title">检测到 1 次心率异常</text>
        <text class="anomaly-body">建议向家人或医生咨询。</text>
      </view>
    </view>

    <view class="footer">
      <view class="footer-btn footer-btn-ghost" @click="onBack">
        <text class="footer-btn-ghost-text">返回</text>
      </view>
      <view class="footer-btn footer-btn-primary" @click="onShare">
        <text class="footer-btn-primary-text">分享给家人</text>
      </view>
    </view>
  </view>

  <view v-else class="screen">
    <text class="empty-text">未找到此条记录。</text>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { getById, seedIfEmpty } from '@/stores/sessions.js';
import EcgPaperCanvas from '@/components/EcgPaperCanvas.vue';

const session = ref(null);
const idQuery = ref('');

onMounted(() => {
  // uni-app passes query into onLoad — but for <script setup> we read it from
  // the page's instance options at mount time.
  const pages = getCurrentPages ? getCurrentPages() : [];
  const top = pages[pages.length - 1];
  const id = (top && top.options && top.options.id) ? decodeURIComponent(top.options.id) : '';
  idQuery.value = id;
  seedIfEmpty();
  if (id) session.value = getById(id);
});

const headerDate = computed(() => {
  if (!session.value) return '';
  const d = new Date(session.value.startTs);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
});

function pad(n) { return String(n).padStart(2, '0'); }

function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s} 秒`;
  return `${m} 分 ${s} 秒`;
}

function trendDotBottom(hr) {
  // Plot area shows HR 60..110; clamp + map to 0..100%.
  const clamped = Math.max(60, Math.min(110, hr));
  return ((clamped - 60) / 50) * 100 + '%';
}

function onBack() { uni.navigateBack({ delta: 1 }); }
function onShare() { uni.navigateTo({ url: '/pages/family/family' }); }
</script>

<style lang="scss">
@import '@/uni.scss';

.screen { background-color: $bg; min-height: 100vh; padding: 24rpx 32rpx 80rpx; }

.header { padding: 16rpx 16rpx 24rpx; }
.header-date     { font-size: 40rpx; font-weight: 700; color: $ink; }
.header-duration { font-size: 26rpx; color: $muted; margin-top: 6rpx; }

.card { background-color: $card; border-radius: 32rpx; }

.stats-card {
  padding: 32rpx;
  display: flex; flex-direction: row; align-items: center; gap: 32rpx;
  margin-bottom: 24rpx;
}
.stat-main { flex: 1; display: flex; flex-direction: column; }
.stat-label    { font-size: 26rpx; color: $muted; }
.stat-mega-row { display: flex; flex-direction: row; align-items: baseline; margin-top: 8rpx; }
.stat-mega     { font-size: 144rpx; font-weight: 700; color: $accent; line-height: 1; }
.stat-unit     { font-size: 26rpx; color: $ink-soft; margin-left: 12rpx; }
.stat-side {
  display: flex; flex-direction: column; gap: 16rpx;
  padding-left: 24rpx;
  border-left: 2rpx solid $line;
}
.stat-side-row { display: flex; flex-direction: column; }
.stat-side-label { font-size: 24rpx; color: $muted; }
.stat-side-value { font-size: 44rpx; font-weight: 700; color: $ink; }
.stat-side-divider { height: 2rpx; background-color: $line; }

.section-label {
  font-size: 26rpx; color: $muted; letter-spacing: 1rpx;
  margin: 32rpx 16rpx 16rpx;
  display: block;
}

.trend-card { padding: 24rpx; }
.trend-axis {
  display: flex; flex-direction: column; justify-content: space-between;
  position: absolute; height: 280rpx; padding: 8rpx 0;
}
.trend-axis-label { font-size: 22rpx; color: $muted; }
.trend-plot {
  position: relative;
  margin-left: 56rpx;
  height: 280rpx;
}
.trend-band {
  position: absolute; left: 0; right: 0;
  /* Normal range 60–90 inside HR plot 60..110 → bottom 0%..60% */
  bottom: 0; height: 60%;
  background-color: $accent-soft;
  border-radius: 16rpx;
  opacity: 0.5;
}
.trend-line  { position: absolute; left: 0; right: 0; bottom: 0; top: 0; }
.trend-dot {
  position: absolute;
  width: 12rpx; height: 12rpx; border-radius: 6rpx;
  background-color: $accent;
  transform: translate(-6rpx, 6rpx);
}
.trend-hours {
  position: absolute; bottom: -32rpx; left: 0; right: 0;
  display: flex; flex-direction: row; justify-content: space-between;
}
.trend-hour { font-size: 22rpx; color: $muted; }

.anomaly {
  background-color: $warn-soft;
  border-radius: 28rpx;
  padding: 28rpx;
  margin-top: 32rpx;
  display: flex; flex-direction: row; align-items: flex-start; gap: 20rpx;
}
.anomaly-glyph {
  width: 56rpx; height: 56rpx; border-radius: 28rpx;
  background-color: $warn; color: #fff;
  font-size: 32rpx; font-weight: 700;
  text-align: center; line-height: 56rpx;
}
.anomaly-text  { flex: 1; display: flex; flex-direction: column; }
.anomaly-title { font-size: 30rpx; font-weight: 700; color: $warn; }
.anomaly-body  { font-size: 26rpx; color: $ink-soft; margin-top: 6rpx; }

.footer { display: flex; flex-direction: row; gap: 20rpx; margin-top: 40rpx; }
.footer-btn {
  flex: 1;
  border-radius: 36rpx;
  padding: 36rpx 0;
  display: flex; align-items: center; justify-content: center;
}
.footer-btn-ghost   { background-color: $card; border: 2rpx solid $line; }
.footer-btn-primary { background-color: $accent; }
.footer-btn-ghost-text   { color: $ink; font-size: 34rpx; font-weight: 700; }
.footer-btn-primary-text { color: #fff; font-size: 34rpx; font-weight: 700; }

.empty-text { font-size: 28rpx; color: $muted; padding: 80rpx 40rpx; text-align: center; }
</style>
