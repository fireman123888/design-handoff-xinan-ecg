<template>
  <view class="screen">
    <view class="header">
      <text class="title">{{ found ? '已找到 1 台设备' : '正在搜索附近设备…' }}</text>
      <text class="subtitle">请确保设备已开机并在 1 米内</text>
    </view>

    <view class="radar">
      <view class="ring ring-1" />
      <view class="ring ring-2" />
      <view class="ring ring-3" />
      <view class="bt-disc">
        <text class="bt-glyph">⌬</text>
      </view>
    </view>

    <view class="device-area">
      <view v-if="found" class="device-card">
        <view class="device-icon">
          <text class="device-icon-text">♥</text>
        </view>
        <view class="device-text">
          <text class="device-name">心安 ECG · 设备 03</text>
          <text class="device-meta">5d:7f:9e:51 · 信号良好</text>
        </view>
      </view>
    </view>

    <view
      :class="['primary-btn', found ? '' : 'primary-btn-disabled']"
      @click="onConnect"
      hover-class="btn-hover"
    >
      <text class="primary-btn-text">{{ found ? '连接此设备' : '正在搜索…' }}</text>
    </view>
  </view>
</template>

<script setup>
// In a real build this screen drives a `BleConnector` and surfaces real scan
// results. For the handoff we fake the timing the design specifies: ~1.8s
// before "found", which gives the radar animation time to read.

import { ref, onMounted, onUnmounted } from 'vue';
import { setKnownDevice } from '@/stores/prefs.js';

const found = ref(false);
let timer = null;

onMounted(() => {
  timer = setTimeout(() => { found.value = true; }, 1800);
});
onUnmounted(() => { if (timer) clearTimeout(timer); });

function onConnect() {
  if (!found.value) return;
  setKnownDevice('fixture:01');
  uni.navigateTo({ url: '/pages/pairing/electrodes' });
}
</script>

<style lang="scss">
@import '@/uni.scss';

.screen {
  background-color: $bg; min-height: 100vh;
  padding: 80rpx 56rpx 80rpx;
  display: flex; flex-direction: column;
  box-sizing: border-box;
}
.header { display: flex; flex-direction: column; align-items: center; margin-top: 40rpx; }
.title    { font-size: 48rpx; font-weight: 700; color: $ink; text-align: center; }
.subtitle { font-size: 30rpx; color: $muted; margin-top: 16rpx; text-align: center; }

.radar {
  position: relative;
  width: 100%; height: 480rpx;
  display: flex; align-items: center; justify-content: center;
  margin: 60rpx 0;
}
.ring {
  position: absolute;
  width: 240rpx; height: 240rpx;
  border-radius: 120rpx;
  border: 2rpx solid $accent;
  opacity: 0;
  animation: radar-pulse 2.4s ease-out infinite;
}
.ring-1 { animation-delay: 0s; }
.ring-2 { animation-delay: 0.8s; }
.ring-3 { animation-delay: 1.6s; }
@keyframes radar-pulse {
  0%   { transform: scale(0.4); opacity: 0.9; }
  100% { transform: scale(2.0); opacity: 0; }
}
.bt-disc {
  width: 240rpx; height: 240rpx; border-radius: 120rpx;
  background-color: $accent;
  display: flex; align-items: center; justify-content: center;
  z-index: 2;
}
.bt-glyph { color: #fff; font-size: 96rpx; }

.device-area { min-height: 180rpx; margin-bottom: 24rpx; }
.device-card {
  background-color: $card; border-radius: 32rpx;
  padding: 32rpx; display: flex; flex-direction: row; align-items: center; gap: 24rpx;
}
.device-icon {
  width: 88rpx; height: 88rpx; border-radius: 44rpx;
  background-color: $accent-soft;
  display: flex; align-items: center; justify-content: center;
}
.device-icon-text { color: $accent; font-size: 44rpx; }
.device-text { display: flex; flex-direction: column; flex: 1; }
.device-name { font-size: 34rpx; font-weight: 700; color: $ink; }
.device-meta { font-size: 26rpx; color: $muted; margin-top: 6rpx; }

.primary-btn {
  width: 100%;
  background-color: $accent;
  border-radius: 36rpx;
  padding: 40rpx 0;
  display: flex; align-items: center; justify-content: center;
  box-sizing: border-box;
}
.primary-btn-disabled { background-color: $line; }
.primary-btn-text { color: #fff; font-size: 38rpx; font-weight: 700; }
.btn-hover { opacity: 0.85; }
</style>
