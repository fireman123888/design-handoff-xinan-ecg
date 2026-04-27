<!-- ============================================================================
   WELCOME  ——  欢迎页 (配对流程的第 1 步)
  ----------------------------------------------------------------------------
   两个出口:
     [开始连接设备] → 进入 scanning
     [已经配对过]  → reLaunch 到 home,会用 FixtureSource 兜底

   模板区块:
     [T1] hero 视觉(粉色圆 + ♥)
     [T2] 标题 / 副标题
     [T3] 主按钮 + 跳过链接

   脚本区块:
     [S1] 依赖
     [S2] onStart / onSkip   (含可关闭的导航日志)
============================================================================ -->

<template>
  <view class="screen">
    <!-- ============= [T1][T2] hero + 文案 ============= -->
    <view class="hero">
      <view class="hero-disc">
        <text class="hero-glyph">♥</text>
      </view>
      <text class="title">欢迎使用</text>
      <text class="brand">心安心电</text>
      <text class="subtitle">一台贴心的心电监测设备，{{ '\n' }}陪伴您每一次心跳。</text>
    </view>

    <!-- ============= [T3] 主按钮 + 跳过 ============= -->
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
// ============================================================================
// [S1] 依赖
// ============================================================================
import { prefs } from '@/stores/prefs.js';
import { flags } from '@/config/featureFlags.js';


// ============================================================================
// [S2] 用户事件
// ============================================================================

function onStart() {
  if (flags.logPairingNavigations) console.log('[welcome] onStart clicked, calling uni.navigateTo');
  uni.navigateTo({
    url: '/pages/pairing/scanning',
    success: (r) => { if (flags.logPairingNavigations) console.log('[welcome] navigateTo success', r); },
    fail:    (e) => { if (flags.logPairingNavigations) console.error('[welcome] navigateTo FAILED:', e); },
  });
}

// 已配对路径:跳过整个 pairing 流程,直接打开 home。
// home 屏 onMounted 会用 FixtureSource 兜底,所以即使没真设备也不会空屏。
function onSkip() {
  if (flags.logPairingNavigations) console.log('[welcome] onSkip clicked, calling uni.reLaunch');
  uni.reLaunch({
    url: '/pages/home/home',
    success: (r) => { if (flags.logPairingNavigations) console.log('[welcome] reLaunch success', r); },
    fail:    (e) => { if (flags.logPairingNavigations) console.error('[welcome] reLaunch FAILED:', e); },
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
