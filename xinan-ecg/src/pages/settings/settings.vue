<template>
  <view class="screen">
    <!-- 显示 -->
    <text class="section-label">显示</text>
    <view class="card">
      <view class="row row-stack">
        <text class="row-label">字号大小</text>
        <view class="seg">
          <view
            v-for="opt in textSizeOptions"
            :key="opt.value"
            :class="['seg-item', prefs.textScale === opt.value ? 'seg-item-active' : '']"
            @click="setTextScale(opt.value)"
          >
            <text :class="['seg-text', prefs.textScale === opt.value ? 'seg-text-active' : '']">
              {{ opt.label }}
            </text>
          </view>
        </view>
      </view>
    </view>

    <!-- 提醒 -->
    <text class="section-label">提醒</text>
    <view class="card">
      <view class="row" @click="toggleHr">
        <view class="row-text">
          <text class="row-label">心率超出范围</text>
          <text class="row-hint">{{ prefs.hrAlarmLo }}–{{ prefs.hrAlarmHi }} 次/分</text>
        </view>
        <view :class="['toggle', prefs.hrAlarmEnabled ? 'toggle-on' : '']">
          <view class="toggle-knob" />
        </view>
      </view>
      <view class="divider" />
      <view class="row" @click="toggleElectrode">
        <view class="row-text">
          <text class="row-label">电极脱落</text>
          <text class="row-hint">脱落时显示全屏提醒</text>
        </view>
        <view :class="['toggle', prefs.electrodeAlarmEnabled ? 'toggle-on' : '']">
          <view class="toggle-knob" />
        </view>
      </view>
      <view class="divider" />
      <view class="row" @click="toggleBattery">
        <view class="row-text">
          <text class="row-label">设备低电量</text>
          <text class="row-hint">电量低于 20% 时提醒</text>
        </view>
        <view :class="['toggle', prefs.batteryAlarmEnabled ? 'toggle-on' : '']">
          <view class="toggle-knob" />
        </view>
      </view>
    </view>

    <!-- 设备 -->
    <text class="section-label">设备</text>
    <view class="card">
      <view class="row">
        <view class="row-text">
          <text class="row-label">连接状态</text>
          <text class="row-hint">{{ connectionLabel }}</text>
        </view>
        <text class="row-tag">{{ deviceIdShort }}</text>
      </view>
      <view class="divider" />
      <view class="row" @click="onSyncRtc">
        <view class="row-text">
          <text class="row-label">同步设备时间</text>
          <text class="row-hint">命令 0x04 · 将设备 RTC 对齐手机</text>
        </view>
        <text class="row-arrow">›</text>
      </view>
      <view class="divider" />
      <view class="row" @click="onBindUser">
        <view class="row-text">
          <text class="row-label">重新绑定账户</text>
          <text class="row-hint">命令 0x05 · 将后续记录归属当前账户</text>
        </view>
        <text class="row-arrow">›</text>
      </view>
      <view class="divider" />
      <view class="row" @click="onShutdown">
        <view class="row-text">
          <text class="row-label row-warn">关机</text>
          <text class="row-hint">命令 0x01 · 设备将断开并下电</text>
        </view>
        <text class="row-arrow row-warn">›</text>
      </view>
    </view>

    <view class="footer">
      <view class="link" @click="onFamily">
        <text class="link-text">家人与紧急联系</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue';
import {
  prefs, setTextScale,
  setHrAlarm, setElectrodeAlarm, setBatteryAlarm,
} from '@/stores/prefs.js';
import { state, getSource } from '@/stores/ecg.js';
import { syncRtc, bindUser, powerOff } from '@/ble/command.js';

const textSizeOptions = [
  { label: '标准', value: 1.0 },
  { label: '加大', value: 1.15 },
  { label: '特大', value: 1.3 },
];

const connectionLabel = computed(() => ({
  disconnected: '未连接',
  scanning:     '正在搜索…',
  connecting:   '正在连接…',
  ready:        '已连接',
  error:        '连接异常',
}[state.connection] || state.connection));

const deviceIdShort = computed(() => {
  const id = (state.device && state.device.id) || prefs.knownDeviceId || '—';
  return id.length > 14 ? id.slice(-12) : id;
});

function toggleHr()        { setHrAlarm(!prefs.hrAlarmEnabled); }
function toggleElectrode() { setElectrodeAlarm(!prefs.electrodeAlarmEnabled); }
function toggleBattery()   { setBatteryAlarm(!prefs.batteryAlarmEnabled); }

async function send(frameBytes, label) {
  const src = getSource();
  if (!src) {
    uni.showToast({ title: '设备未连接', icon: 'none' });
    return;
  }
  try {
    await src.writeCommand(frameBytes);
    uni.showToast({ title: `${label} 已发送`, icon: 'success' });
  } catch (e) {
    uni.showToast({ title: `${label} 失败`, icon: 'none' });
  }
}

function onSyncRtc()  { send(syncRtc(Date.now()),       '同步时间'); }
function onBindUser() { send(bindUser(20260427),        '绑定账户'); }
function onShutdown() {
  uni.showModal({
    title: '关机',
    content: '确定关闭设备？关机后将断开连接。',
    confirmText: '确定关机',
    confirmColor: '#B1242B',
    success: (r) => { if (r.confirm) send(powerOff(), '关机'); },
  });
}
function onFamily() { uni.navigateTo({ url: '/pages/family/family' }); }
</script>

<style lang="scss">
@import '@/uni.scss';

.screen { background-color: $bg; min-height: 100vh; padding: 32rpx 32rpx 80rpx; }

.section-label {
  font-size: 26rpx; color: $muted; letter-spacing: 1rpx;
  margin: 32rpx 16rpx 16rpx;
  display: block;
}
.card { background-color: $card; border-radius: 28rpx; }
.row {
  padding: 28rpx 32rpx;
  display: flex; flex-direction: row; align-items: center; justify-content: space-between;
}
.row-stack { flex-direction: column; align-items: stretch; gap: 20rpx; }
.row-text  { display: flex; flex-direction: column; flex: 1; }
.row-label { font-size: 32rpx; color: $ink; font-weight: 600; }
.row-hint  { font-size: 26rpx; color: $muted; margin-top: 6rpx; }
.row-tag   { font-size: 26rpx; color: $muted; }
.row-arrow { font-size: 40rpx; color: $muted; }
.row-warn  { color: $danger !important; }
.divider   { height: 2rpx; background-color: $line; margin: 0 32rpx; }

.seg {
  display: flex; flex-direction: row;
  background-color: $bg;
  border-radius: 24rpx;
  padding: 6rpx;
}
.seg-item {
  flex: 1;
  border-radius: 20rpx;
  padding: 20rpx 0;
  display: flex; align-items: center; justify-content: center;
}
.seg-item-active { background-color: $card; box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.05); }
.seg-text        { font-size: 30rpx; color: $muted; }
.seg-text-active { color: $accent; font-weight: 700; }

.toggle {
  width: 88rpx; height: 48rpx; border-radius: 24rpx;
  background-color: $line;
  position: relative;
  transition: background-color 0.2s;
}
.toggle-on { background-color: $accent; }
.toggle-knob {
  position: absolute; top: 4rpx; left: 4rpx;
  width: 40rpx; height: 40rpx; border-radius: 20rpx;
  background-color: #fff;
  transition: transform 0.2s;
}
.toggle-on .toggle-knob { transform: translateX(40rpx); }

.footer { margin-top: 40rpx; display: flex; align-items: center; justify-content: center; }
.link { padding: 16rpx 0; }
.link-text { color: $accent; font-size: 30rpx; }
</style>
