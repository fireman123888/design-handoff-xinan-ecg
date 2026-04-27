<template>
  <view class="screen">
    <!-- Week summary card -->
    <view class="week-card">
      <view class="week-header">
        <text class="week-label">本周平均心率</text>
        <text class="week-hint">最近 7 天</text>
      </view>
      <view class="week-row">
        <view class="week-number">
          <text class="week-mega">{{ weekAvg || '--' }}</text>
          <text class="week-unit">次/分</text>
        </view>
        <view class="week-bars">
          <view
            v-for="(bar, idx) in bars"
            :key="idx"
            class="bar-col"
          >
            <view
              :class="['bar', idx === todayIdx ? 'bar-today' : '']"
              :style="{ height: barHeight(bar) }"
            />
            <text :class="['bar-label', idx === todayIdx ? 'bar-label-today' : '']">{{ dayLabels[idx] }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- Day list -->
    <text class="section-label">每日记录</text>
    <view
      v-for="s in sessions"
      :key="s.id"
      class="day-row"
      @click="onOpen(s)"
      hover-class="day-row-hover"
    >
      <view class="day-pill">
        <text class="day-pill-day">{{ dayPill(s.startTs).day }}</text>
        <text class="day-pill-month">{{ dayPill(s.startTs).month }}</text>
      </view>
      <view class="day-text">
        <text class="day-title">{{ dayTitle(s.startTs) }}</text>
        <text class="day-stats">平均 {{ s.avgHr }} · 最低 {{ s.minHr }} · 最高 {{ s.maxHr }}</text>
        <text class="day-duration">
          记录 {{ formatDuration(s.durationSec) }}
          <text v-if="s.hasAnomaly" class="day-flag"> · 有提醒</text>
        </text>
      </view>
      <text class="day-arrow">›</text>
    </view>

    <view v-if="sessions.length === 0" class="empty">
      <text class="empty-text">还没有记录。完成第一次记录后，这里会出现历史。</text>
    </view>
  </view>
</template>

<script setup>
import { onMounted, computed } from 'vue';
import { sessions, seedIfEmpty, weekAvgHr, weekBars } from '@/stores/sessions.js';

onMounted(() => { seedIfEmpty(); });

const dayLabels = ['一', '二', '三', '四', '五', '六', '日'];

const weekAvg = computed(() => weekAvgHr());
const bars    = computed(() => weekBars());

const todayIdx = computed(() => {
  const d = new Date().getDay();
  return d === 0 ? 6 : d - 1;
});

function barHeight(hr) {
  if (!hr) return '8rpx';
  // Map HR 50–110 → 16–120rpx
  const clamped = Math.max(50, Math.min(110, hr));
  const scaled = ((clamped - 50) / 60) * 104 + 16;
  return scaled + 'rpx';
}

function dayPill(ts) {
  const d = new Date(ts);
  return { day: String(d.getDate()), month: (d.getMonth() + 1) + '月' };
}

function dayTitle(ts) {
  const d = new Date(ts);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return '今天';
  const yesterday = new Date(today.getTime() - 86400000);
  if (sameDay(d, yesterday)) return '昨天';
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s} 秒`;
  return `${m} 分 ${s} 秒`;
}

function onOpen(s) {
  uni.navigateTo({ url: `/pages/detail/detail?id=${encodeURIComponent(s.id)}` });
}
</script>

<style lang="scss">
@import '@/uni.scss';

.screen { background-color: $bg; min-height: 100vh; padding: 24rpx 32rpx 80rpx; }

.week-card {
  background-color: $card;
  border-radius: 36rpx;
  padding: 36rpx;
  margin-bottom: 24rpx;
}
.week-header { display: flex; flex-direction: row; justify-content: space-between; align-items: baseline; }
.week-label { font-size: 28rpx; color: $muted; }
.week-hint  { font-size: 24rpx; color: $muted; }
.week-row {
  display: flex; flex-direction: row; align-items: flex-end; justify-content: space-between;
  margin-top: 16rpx;
}
.week-number { display: flex; flex-direction: row; align-items: baseline; }
.week-mega   { font-size: 112rpx; font-weight: 700; color: $accent; line-height: 1; }
.week-unit   { font-size: 28rpx; color: $ink-soft; margin-left: 12rpx; }
.week-bars {
  display: flex; flex-direction: row; align-items: flex-end; gap: 14rpx;
  height: 160rpx;
}
.bar-col { display: flex; flex-direction: column; align-items: center; gap: 8rpx; }
.bar {
  width: 16rpx;
  background-color: $accent-soft;
  border-radius: 8rpx;
}
.bar-today { background-color: $accent; }
.bar-label { font-size: 22rpx; color: $muted; }
.bar-label-today { color: $accent; font-weight: 700; }

.section-label {
  font-size: 26rpx; color: $muted; letter-spacing: 1rpx;
  margin: 32rpx 16rpx 16rpx;
  display: block;
}

.day-row {
  background-color: $card;
  border-radius: 28rpx;
  padding: 24rpx 28rpx;
  margin-bottom: 14rpx;
  display: flex; flex-direction: row; align-items: center; gap: 20rpx;
}
.day-row-hover { opacity: 0.85; }
.day-pill {
  width: 112rpx; height: 112rpx; border-radius: 28rpx;
  background-color: $accent-soft;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
}
.day-pill-day   { font-size: 44rpx; font-weight: 700; color: $accent; line-height: 1; }
.day-pill-month { font-size: 22rpx; color: $accent; margin-top: 4rpx; }
.day-text  { flex: 1; display: flex; flex-direction: column; }
.day-title { font-size: 32rpx; font-weight: 700; color: $ink; }
.day-stats { font-size: 26rpx; color: $ink-soft; margin-top: 6rpx; }
.day-duration { font-size: 24rpx; color: $muted; margin-top: 4rpx; }
.day-flag { color: $warn; font-weight: 700; }
.day-arrow { font-size: 40rpx; color: $muted; }

.empty { padding: 80rpx 40rpx; }
.empty-text { font-size: 28rpx; color: $muted; line-height: 1.6; text-align: center; }
</style>
