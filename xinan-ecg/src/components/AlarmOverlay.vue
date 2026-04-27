<!-- ============================================================================
   ALARM OVERLAY  ——  电极脱落全屏告警
  ----------------------------------------------------------------------------
   来源:  README §"7. Alarm overlay"

   行为:
     - home 屏 mount 此组件,visible 由
         flags.enableAlarmOverlay
       AND prefs.electrodeAlarmEnabled
       AND state.status.electrode !== 0
     共同决定。
     - "我已贴好"只是 dismiss; 设备下一帧 status 若仍报脱落会再次弹出 →
       它实际是"确认"语义,不会改变设备状态。

   模板区块:
     [T1] 大圆 + 脉动光环
     [T2] 标题 + 描述
     [T3] 两个按钮("我已贴好" / "呼叫家人帮忙")

   脚本区块:
     [S1] 依赖与 props
     [S2] visible / title / body 计算
     [S3] 用户事件
============================================================================ -->

<template>
  <view v-if="visible" class="alarm-overlay">
    <!-- ============= [T1] 大圆 + 脉动光环 ============= -->
    <view class="alarm-glyph">
      <view v-if="flags.enableAlarmRingPulse" class="alarm-ring" />
      <text class="alarm-glyph-text">!</text>
    </view>

    <!-- ============= [T2] 标题 + 描述 ============= -->
    <text class="alarm-title">{{ title }}</text>
    <text class="alarm-body">{{ body }}</text>

    <!-- ============= [T3] 操作按钮 ============= -->
    <view class="alarm-buttons">
      <view class="alarm-btn alarm-btn-primary" @click="onResolved">
        <text class="alarm-btn-primary-text">我已贴好</text>
      </view>
      <view class="alarm-btn alarm-btn-outline" @click="onCallFamily">
        <text class="alarm-btn-outline-text">呼叫家人帮忙</text>
      </view>
    </view>
  </view>
</template>

<script setup>
// ============================================================================
// [S1] 依赖与 props
// ============================================================================
import { computed } from 'vue';
import { state } from '@/stores/ecg.js';
import { prefs } from '@/stores/prefs.js';
import { flags } from '@/config/featureFlags.js';

const props = defineProps({
  forceVisible: { type: Boolean, default: false },
});
const emit = defineEmits(['acknowledge']);


// ============================================================================
// [S2] visible / title / body 计算
// ============================================================================

const visible = computed(() => {
  // 总开关关掉时:无论如何都不显示
  if (!flags.enableAlarmOverlay) return false;
  // 调试 / 演示用 forceVisible 跳过条件
  if (props.forceVisible) return true;
  return prefs.electrodeAlarmEnabled && state.status.electrode !== 0;
});

const title = computed(() => '电极脱落');

const body = computed(() => {
  const which = state.status.electrode === 1 ? '左'
               : state.status.electrode === 2 ? '右'
               : '';
  return `设备已暂停记录。请将${which}贴片重新按压贴合皮肤。`;
});


// ============================================================================
// [S3] 用户事件
// ============================================================================

function onResolved() {
  emit('acknowledge');
}

function onCallFamily() {
  // 受 flags.enableEmergencyCallButton 控制 —— 演示截图时可关
  if (!flags.enableEmergencyCallButton) return;
  const emergency = (prefs.family || []).find(f => f.emergency);
  if (emergency && typeof uni !== 'undefined' && uni.makePhoneCall) {
    uni.makePhoneCall({ phoneNumber: emergency.phone });
  }
}
</script>

<style lang="scss">
@import '@/uni.scss';

.alarm-overlay {
  position: fixed; left: 0; right: 0; top: 0; bottom: 0;
  background-color: $warn;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 0 60rpx;
  z-index: 9999;
}
.alarm-glyph {
  width: 240rpx; height: 240rpx;
  display: flex; align-items: center; justify-content: center;
  position: relative;
  margin-bottom: 56rpx;
}
.alarm-ring {
  position: absolute; left: 0; top: 0; right: 0; bottom: 0;
  border-radius: 120rpx;
  background-color: rgba(255,255,255,0.2);
  animation: alarm-pulse 1.4s ease-out infinite;
}
.alarm-glyph-text {
  width: 200rpx; height: 200rpx; border-radius: 100rpx;
  background-color: #fff; color: $warn;
  font-size: 120rpx; font-weight: 700; line-height: 200rpx; text-align: center;
}
@keyframes alarm-pulse {
  0%   { transform: scale(0.9); opacity: 0.9; }
  100% { transform: scale(1.4); opacity: 0; }
}
.alarm-title { color: #fff; font-size: 64rpx; font-weight: 700; margin-bottom: 24rpx; }
.alarm-body  { color: rgba(255,255,255,0.9); font-size: 32rpx; line-height: 1.5; text-align: center; margin-bottom: 80rpx; }
.alarm-buttons { width: 100%; display: flex; flex-direction: column; gap: 24rpx; }
.alarm-btn {
  border-radius: 36rpx; padding: 36rpx 0;
  display: flex; align-items: center; justify-content: center;
}
.alarm-btn-primary { background-color: #fff; }
.alarm-btn-primary-text { color: $warn; font-size: 38rpx; font-weight: 700; }
.alarm-btn-outline { border: 2rpx solid rgba(255,255,255,0.6); }
.alarm-btn-outline-text { color: #fff; font-size: 38rpx; font-weight: 700; }
</style>
