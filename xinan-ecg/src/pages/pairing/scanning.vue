<!-- ============================================================================
   SCANNING  ——  配对流程第 2 步:雷达扩散动画 + 模拟搜索到一台设备
  ----------------------------------------------------------------------------
   说明:
     真实建包应当驱动一个 BleConnector 并展示真扫描结果。Demo 阶段按设计稿
     固定 ~1.8s 后显示"已找到 1 台设备",给雷达动画时间被看清。

   雷达环动画受 flags.enableRadarAnimation 控制,关掉后只剩静态蓝色圆盘。

   模板区块:
     [T1] 标题区
     [T2] 雷达 (3 圈扩散环 + 中央蓝牙图标)
     [T3] 设备结果卡 (found 时显示)
     [T4] 主按钮 (未找到时禁用)

   脚本区块:
     [S1] 依赖与 ref
     [S2] 1.8s 定时器
     [S3] 连接事件
============================================================================ -->

<template>
  <view class="screen">
    <!-- [T1] -->
    <view class="header">
      <text class="title">{{ found ? '已找到 1 台设备' : '正在搜索附近设备…' }}</text>
      <text class="subtitle">请确保设备已开机并在 1 米内</text>
    </view>

    <!-- [T2] 雷达 -->
    <view class="radar">
      <view v-if="flags.enableRadarAnimation" class="ring ring-1" />
      <view v-if="flags.enableRadarAnimation" class="ring ring-2" />
      <view v-if="flags.enableRadarAnimation" class="ring ring-3" />
      <view class="bt-disc">
        <text class="bt-glyph">⌬</text>
      </view>
    </view>

    <!-- [T3] 找到的设备(占位高度防止 layout 跳动) -->
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

    <!-- [T4] 主按钮 -->
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
// ============================================================================
// [S1] 依赖与 ref
// ============================================================================
import { ref, onMounted, onUnmounted } from 'vue';
import { setKnownDevice } from '@/stores/prefs.js';
import { flags } from '@/config/featureFlags.js';

const found = ref(false);
let timer = null;


// ============================================================================
// [S2] mount 后 1.8s 显示"已找到"
// ============================================================================

onMounted(() => {
  timer = setTimeout(() => { found.value = true; }, 1800);
});
onUnmounted(() => { if (timer) clearTimeout(timer); });


// ============================================================================
// [S3] 连接事件:写入 knownDeviceId,跳到 electrodes 步骤
// ============================================================================

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
