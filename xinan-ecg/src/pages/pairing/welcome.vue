<template>
  <view class="screen">
    <view class="hero">
      <view class="hero-disc">
        <text class="hero-glyph">♥</text>
      </view>
      <text class="title">欢迎使用</text>
      <text class="brand">心安心电</text>
      <text class="subtitle">一台贴心的心电监测设备，{{ '\n' }}陪伴您每一次心跳。</text>
    </view>

    <view class="actions">
      <view class="primary-btn" @click="onStart" hover-class="btn-hover">
        <text class="primary-btn-text">开始连接设备</text>
      </view>
      <view class="link" @click="onSkip">
        <text class="link-text">已经配对过？直接进入</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { prefs } from '@/stores/prefs.js';

function onStart() {
  console.log('[welcome] onStart clicked, calling uni.navigateTo');
  uni.navigateTo({
    url: '/pages/pairing/scanning',
    success: (r) => console.log('[welcome] navigateTo success', r),
    fail:    (e) => console.error('[welcome] navigateTo FAILED:', e),
  });
}

function onSkip() {
  // Bypass pairing for users who've already bound a device. Goes straight to
  // home, which will fall back to the FixtureSource if no real BLE source has
  // been attached yet.
  console.log('[welcome] onSkip clicked, calling uni.reLaunch');
  uni.reLaunch({
    url: '/pages/home/home',
    success: (r) => console.log('[welcome] reLaunch success', r),
    fail:    (e) => console.error('[welcome] reLaunch FAILED:', e),
  });
}
</script>

<style lang="scss">
@import '@/uni.scss';

.screen {
  background-color: $bg;
  min-height: 100vh;
  padding: 120rpx 56rpx 80rpx;
  display: flex; flex-direction: column; justify-content: space-between;
  box-sizing: border-box;
}
.hero { display: flex; flex-direction: column; align-items: center; margin-top: 80rpx; }
.hero-disc {
  width: 240rpx; height: 240rpx; border-radius: 120rpx;
  background-color: $accent-soft;
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 60rpx;
}
.hero-glyph { color: $accent; font-size: 120rpx; }

.title    { font-size: 60rpx; font-weight: 700; color: $ink; }
.brand    { font-size: 60rpx; font-weight: 700; color: $accent; margin-top: 8rpx; }
.subtitle { font-size: 34rpx; color: $ink-soft; margin-top: 32rpx; line-height: 1.5; text-align: center; white-space: pre-line; }

.actions { display: flex; flex-direction: column; align-items: center; gap: 32rpx; margin-bottom: 40rpx; }
.primary-btn {
  width: 100%;
  background-color: $accent;
  border-radius: 36rpx;
  padding: 40rpx 0;
  display: flex; align-items: center; justify-content: center;
  box-sizing: border-box;
}
.primary-btn-text { color: #fff; font-size: 38rpx; font-weight: 700; }
.btn-hover { opacity: 0.85; }
.link { padding: 16rpx 0; }
.link-text { color: $ink-soft; font-size: 30rpx; text-decoration: underline; }
</style>
