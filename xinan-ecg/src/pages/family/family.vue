<template>
  <view class="screen">
    <text class="section-label">紧急联系人</text>
    <view class="card emergency-card">
      <view class="avatar">
        <text class="avatar-text">{{ emergencyContact ? emergencyContact.name.slice(-1) : '—' }}</text>
      </view>
      <view class="contact-text">
        <text class="contact-name">{{ emergencyContact ? emergencyContact.name : '未设置' }}</text>
        <text class="contact-phone">{{ emergencyContact ? maskPhone(emergencyContact.phone) : '请在设置中添加' }}</text>
      </view>
      <view
        v-if="emergencyContact"
        class="call-btn"
        @click="onCall(emergencyContact)"
        hover-class="btn-hover"
      >
        <text class="call-btn-text">呼叫</text>
      </view>
    </view>

    <text class="section-label">家人列表</text>
    <view class="card">
      <view
        v-for="(m, idx) in prefs.family"
        :key="m.phone"
        class="member"
      >
        <view class="member-avatar">
          <text class="member-avatar-text">{{ m.name.slice(-1) }}</text>
        </view>
        <view class="member-text">
          <text class="member-name">{{ m.name }}</text>
          <text class="member-phone">{{ maskPhone(m.phone) }}</text>
        </view>
        <text :class="['member-tag', m.role === 'admin' ? 'tag-admin' : 'tag-viewer']">
          {{ m.role === 'admin' ? '管理员' : '可查看' }}
        </text>
        <view v-if="idx < prefs.family.length - 1" class="member-divider" />
      </view>
    </view>

    <view
      :class="['share-btn', shared ? 'share-btn-done' : '']"
      @click="onShare"
      hover-class="btn-hover"
    >
      <text :class="['share-btn-text', shared ? 'share-btn-text-done' : '']">
        {{ shared ? '✓ 已分享今日报告' : '分享今日报告' }}
      </text>
    </view>

    <view class="footer">
      <text class="footer-text">
        当心率出现异常或电极脱落超过 30 秒，已开启提醒的家人会收到推送。
      </text>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue';
import { prefs } from '@/stores/prefs.js';
import { sessions } from '@/stores/sessions.js';

const emergencyContact = computed(() =>
  (prefs.family || []).find(f => f.emergency) || (prefs.family || [])[0]
);

const shared = ref(false);

function maskPhone(p) {
  if (!p || p.length < 7) return p || '';
  return p.slice(0, 3) + ' **** ' + p.slice(-4);
}

function onCall(contact) {
  if (typeof uni !== 'undefined' && uni.makePhoneCall) {
    uni.makePhoneCall({ phoneNumber: contact.phone });
  }
}

function onShare() {
  // Build a one-line summary of today's session and stash it (real builds would
  // post to a backend; the toggle is enough to demo the affordance).
  const today = sessions.value[0];
  const summary = today
    ? `今日记录 ${today.durationSec}s · 平均心率 ${today.avgHr}`
    : '今日暂无记录';
  uni.showToast({ title: summary, icon: 'none' });
  shared.value = true;
  setTimeout(() => { shared.value = false; }, 4000);
}
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

.emergency-card {
  padding: 32rpx;
  display: flex; flex-direction: row; align-items: center; gap: 24rpx;
}
.avatar {
  width: 96rpx; height: 96rpx; border-radius: 48rpx;
  background-color: $accent-soft;
  display: flex; align-items: center; justify-content: center;
}
.avatar-text { color: $accent; font-size: 40rpx; font-weight: 700; }
.contact-text { flex: 1; display: flex; flex-direction: column; }
.contact-name  { font-size: 36rpx; font-weight: 700; color: $ink; }
.contact-phone { font-size: 28rpx; color: $muted; margin-top: 6rpx; }
.call-btn {
  background-color: $accent;
  padding: 18rpx 40rpx;
  border-radius: 28rpx;
}
.call-btn-text { color: #fff; font-size: 30rpx; font-weight: 700; }

.member {
  position: relative;
  padding: 28rpx 32rpx;
  display: flex; flex-direction: row; align-items: center; gap: 20rpx;
}
.member-avatar {
  width: 72rpx; height: 72rpx; border-radius: 36rpx;
  background-color: $bg;
  display: flex; align-items: center; justify-content: center;
}
.member-avatar-text { color: $ink-soft; font-size: 32rpx; font-weight: 700; }
.member-text { flex: 1; display: flex; flex-direction: column; }
.member-name  { font-size: 32rpx; color: $ink; font-weight: 600; }
.member-phone { font-size: 26rpx; color: $muted; margin-top: 4rpx; }
.member-tag {
  font-size: 24rpx;
  padding: 6rpx 16rpx;
  border-radius: 14rpx;
}
.tag-admin  { background-color: $accent-soft; color: $accent; }
.tag-viewer { background-color: $bg; color: $muted; }
.member-divider {
  position: absolute; left: 32rpx; right: 32rpx; bottom: 0;
  height: 2rpx; background-color: $line;
}

.share-btn {
  margin-top: 40rpx;
  background-color: $accent;
  border-radius: 36rpx;
  padding: 36rpx 0;
  display: flex; align-items: center; justify-content: center;
}
.share-btn-done { background-color: $accent-soft; }
.share-btn-text { color: #fff; font-size: 36rpx; font-weight: 700; }
.share-btn-text-done { color: $accent; }
.btn-hover { opacity: 0.85; }

.footer { margin-top: 24rpx; padding: 0 24rpx; }
.footer-text { font-size: 26rpx; color: $muted; line-height: 1.6; }
</style>
