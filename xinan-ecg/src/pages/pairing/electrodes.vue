<template>
  <view class="screen">
    <view class="header">
      <text class="title">贴好两个电极</text>
      <text class="subtitle">按图示位置将贴片按压在皮肤上</text>
    </view>

    <view class="silhouette">
      <view class="body">
        <!-- Body silhouette built from primitives so we don't need a bundled SVG. -->
        <view class="head" />
        <view class="torso" />
        <view class="arm arm-l" />
        <view class="arm arm-r" />
        <view class="electrode electrode-l">
          <text class="electrode-text">L</text>
        </view>
        <view class="electrode electrode-r">
          <text class="electrode-text">R</text>
        </view>
      </view>
    </view>

    <view class="tip">
      <text class="tip-emoji">💡</text>
      <text class="tip-text">两个贴片都贴好后，按下方按钮开始记录。如果出现告警，按提示重新贴一次即可。</text>
    </view>

    <view class="primary-btn" @click="onDone" hover-class="btn-hover">
      <text class="primary-btn-text">已贴好，开始记录</text>
    </view>
  </view>
</template>

<script setup>
function onDone() {
  uni.reLaunch({ url: '/pages/home/home' });
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
.header { display: flex; flex-direction: column; align-items: center; margin-top: 40rpx; margin-bottom: 40rpx; }
.title    { font-size: 48rpx; font-weight: 700; color: $ink; text-align: center; }
.subtitle { font-size: 30rpx; color: $muted; margin-top: 16rpx; text-align: center; }

.silhouette {
  display: flex; align-items: center; justify-content: center;
  margin: 24rpx 0 48rpx;
}
.body { position: relative; width: 360rpx; height: 480rpx; }
.head {
  position: absolute; left: 50%; top: 0;
  width: 120rpx; height: 120rpx; border-radius: 60rpx;
  background-color: $line;
  transform: translateX(-50%);
}
.torso {
  position: absolute; left: 50%; top: 130rpx;
  width: 220rpx; height: 280rpx; border-radius: 110rpx 110rpx 60rpx 60rpx;
  background-color: $line;
  transform: translateX(-50%);
}
.arm   { position: absolute; top: 150rpx; width: 60rpx; height: 220rpx; background-color: $line; border-radius: 30rpx; }
.arm-l { left: 10rpx; }
.arm-r { right: 10rpx; }
.electrode {
  position: absolute; top: 220rpx;
  width: 80rpx; height: 80rpx; border-radius: 40rpx;
  background-color: $accent;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 8rpx 16rpx rgba(34, 169, 140, 0.35);
}
.electrode-l { left: 100rpx; }
.electrode-r { right: 100rpx; }
.electrode-text { color: #fff; font-size: 36rpx; font-weight: 700; }

.tip {
  background-color: $accent-soft;
  border-radius: 28rpx;
  padding: 28rpx;
  display: flex; flex-direction: row; gap: 16rpx;
  margin-bottom: 32rpx;
}
.tip-emoji { font-size: 36rpx; }
.tip-text  { font-size: 28rpx; color: $ink-soft; line-height: 1.6; flex: 1; }

.primary-btn {
  width: 100%; background-color: $accent;
  border-radius: 36rpx; padding: 40rpx 0;
  display: flex; align-items: center; justify-content: center;
  box-sizing: border-box;
}
.primary-btn-text { color: #fff; font-size: 38rpx; font-weight: 700; }
.btn-hover { opacity: 0.85; }
</style>
