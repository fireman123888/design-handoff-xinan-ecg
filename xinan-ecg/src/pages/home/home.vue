<template>
  <view class="screen">
    <view class="header">
      <text class="greeting">{{ greeting }}，王奶奶</text>
      <text class="subgreeting">今天的心跳很稳定</text>
    </view>

    <view :class="['banner', isElectrodeOff ? 'banner-warn' : 'banner-ok']">
      <view class="banner-text">
        <text class="banner-label">设备状态</text>
        <text class="banner-title">{{ isElectrodeOff ? '需要调整电极' : '一切正常' }}</text>
        <text class="banner-sub">{{ recordingLabel }}</text>
      </view>
      <view class="banner-glyph">
        <text class="banner-glyph-text">{{ isElectrodeOff ? '!' : '✓' }}</text>
      </view>
    </view>

    <view class="hr-card">
      <view class="hr-row">
        <view class="hr-numbers">
          <text class="hr-label">当前心率</text>
          <text class="hr-mega">{{ state.hr || '--' }}</text>
          <view class="hr-unit-row">
            <text class="hr-unit">次/分</text>
            <text class="hr-tag">正常</text>
          </view>
        </view>
        <view
          class="heart-pulse"
          :style="{ animationDuration: heartPulseDuration + 's' }"
        >
          <text class="heart-glyph">♥</text>
        </view>
      </view>
      <ecg-waveform class="hr-canvas" :width="608" :height="168" />
    </view>

    <view class="tile-row">
      <view class="tile">
        <text class="tile-icon">🔋</text>
        <text class="tile-label">设备电量</text>
        <text class="tile-value">{{ state.status.battery }}%</text>
        <text class="tile-hint">{{ batteryHint }}</text>
      </view>
      <view class="tile">
        <text class="tile-icon">📶</text>
        <text class="tile-label">蓝牙信号</text>
        <text class="tile-value">{{ rssiLabel }}</text>
        <text class="tile-hint">{{ state.status.rssi }} dBm</text>
      </view>
    </view>

    <view
      :class="['record-btn', state.recording ? 'record-btn-on' : 'record-btn-off']"
      @click="toggleRecording"
      hover-class="record-btn-hover"
    >
      <view v-if="state.recording" class="rec-dot" />
      <text :class="['record-label', state.recording ? 'record-label-on' : 'record-label-off']">
        {{ state.recording ? '正在记录 · 点击暂停' : '开始记录' }}
      </text>
    </view>

    <view class="shortcut-row">
      <view class="shortcut" @click="onHistory" hover-class="shortcut-hover">
        <text class="shortcut-label">历史记录</text>
        <text class="shortcut-hint">查看过往 7 天</text>
      </view>
      <view class="shortcut" @click="onSettings" hover-class="shortcut-hover">
        <text class="shortcut-label">更多操作</text>
        <text class="shortcut-hint">同步时间 / 设置</text>
      </view>
    </view>

    <view class="source-row">
      <view class="source-text">
        <text class="source-label">模拟数据</text>
        <text class="source-name">{{ sourceName }}</text>
      </view>
      <view class="source-actions">
        <view class="source-btn" @click="onPickFile" hover-class="shortcut-hover">
          <text class="source-btn-text">选择文件</text>
        </view>
        <view
          v-if="customLoaded"
          class="source-btn source-btn-ghost"
          @click="onResetSource"
          hover-class="shortcut-hover"
        >
          <text class="source-btn-ghost-text">恢复</text>
        </view>
      </view>
    </view>

    <view class="sr-row">
      <text class="sr-label">采样率</text>
      <input
        class="sr-input"
        type="number"
        :value="sampleRate"
        @input="onSrInput"
        placeholder="545"
      />
      <text class="sr-unit">Hz</text>
      <text class="sr-hint">{{ srHint }}</text>
    </view>

    <alarm-overlay />
  </view>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { state, startWithFixture, startRecording, stopRecording, getSource } from '@/stores/ecg.js';
import { seedIfEmpty } from '@/stores/sessions.js';
import EcgWaveform from '@/components/EcgWaveform.vue';
import AlarmOverlay from '@/components/AlarmOverlay.vue';

const customLoaded = ref(false);
const customName = ref('');
const sampleRate = ref(545);
const srSniffed = ref(false);

const sourceName = computed(() => {
  if (customLoaded.value) return customName.value;
  return '内置 ecg-samples.json';
});
const srHint = computed(() => srSniffed.value ? '从文件嗅探到' : '默认值，可手动修改');

function onSrInput(e) {
  const v = Number(e.detail ? e.detail.value : e.target.value);
  if (Number.isFinite(v) && v > 0) {
    sampleRate.value = v;
    srSniffed.value = false;
  }
}

onMounted(() => {
  startWithFixture();
  seedIfEmpty();
});

const greeting = computed(() => {
  const h = new Date().getHours();
  if (h < 5)  return '夜深了';
  if (h < 11) return '早上好';
  if (h < 13) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
});

const isElectrodeOff = computed(() => state.status.electrode !== 0);

const recordingLabel = computed(() => {
  if (!state.recording) return '设备已暂停';
  const m = Math.floor(state.durationSec / 60);
  const s = state.durationSec % 60;
  return `已记录 ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
});

const heartPulseDuration = computed(() => state.hr > 0 ? (60 / state.hr).toFixed(2) : '1.00');

const batteryHint = computed(() => {
  const b = state.status.battery;
  if (b >= 60) return '电量充足';
  if (b >= 25) return '可继续使用';
  return '请尽快充电';
});

const rssiLabel = computed(() => {
  const r = state.status.rssi;
  if (r >= -55) return '信号良好';
  if (r >= -75) return '信号一般';
  return '信号较弱';
});

function toggleRecording() {
  if (state.recording) stopRecording();
  else startRecording();
}

function onHistory()  { uni.navigateTo({ url: '/pages/history/history' }); }
function onSettings() { uni.navigateTo({ url: '/pages/settings/settings' }); }

// Lets the user drop in their own ECG sample JSON/CSV/TXT. Tries the canonical
// uni.chooseFile API first (so App-PLUS and WeChat MP work without DOM); falls
// back to a raw <input type="file"> on H5 if chooseFile is missing or fails.
function onPickFile() {
  if (typeof uni !== 'undefined' && typeof uni.chooseFile === 'function') {
    uni.chooseFile({
      count: 1,
      extension: ['.json', '.txt', '.csv'],
      success: (res) => {
        const tf = res.tempFiles && res.tempFiles[0];
        if (!tf) {
          uni.showToast({ title: '未选择文件', icon: 'none' });
          return;
        }
        // H5: tempFiles[i] is a real File/Blob with .text(). App-PLUS / WeChat MP:
        // it's `{ path, name, size }` and reading needs the platform's file API.
        if (typeof tf.text === 'function') {
          tf.text()
            .then((text) => handleText(text, tf.name || 'data'))
            .catch(() => uni.showToast({ title: '读取文件失败', icon: 'none' }));
        } else if (tf.path) {
          readPlatformPath(tf.path, tf.name || 'data');
        } else {
          uni.showToast({ title: '当前平台读取未实现', icon: 'none' });
        }
      },
      fail: (e) => {
        const msg = (e && e.errMsg) || '';
        if (msg.indexOf('cancel') !== -1) return;
        // chooseFile reported failure (often "not supported on this platform" in dev).
        // Fall through to the DOM picker — it's our H5 fallback.
        domFallback();
      },
    });
    return;
  }
  domFallback();
}

function domFallback() {
  if (typeof document === 'undefined') {
    uni.showToast({ title: '当前平台暂不支持选择文件', icon: 'none' });
    return;
  }
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,.txt,.csv,application/json,text/plain,text/csv';
  input.onchange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload  = () => handleText(reader.result, file.name);
    reader.onerror = () => uni.showToast({ title: '读取文件失败', icon: 'none' });
    reader.readAsText(file);
  };
  input.click();
}

// App-PLUS / WeChat MP path. Resolves a platform path into a File and reads as
// text. plus.io is the App-PLUS HTML5+ filesystem API; on WeChat MP we'd use
// wx.getFileSystemManager().readFile — guarded so dev under H5 doesn't trip it.
function readPlatformPath(path, name) {
  if (typeof plus !== 'undefined' && plus.io && plus.io.resolveLocalFileSystemURL) {
    plus.io.resolveLocalFileSystemURL(path, (entry) => {
      entry.file((file) => {
        const reader = new plus.io.FileReader();
        reader.onloadend = (ev) => handleText(ev.target.result, name);
        reader.onerror   = () => uni.showToast({ title: '读取文件失败', icon: 'none' });
        reader.readAsText(file, 'utf-8');
      }, () => uni.showToast({ title: '读取文件失败', icon: 'none' }));
    }, () => uni.showToast({ title: '解析路径失败', icon: 'none' }));
    return;
  }
  if (typeof wx !== 'undefined' && wx.getFileSystemManager) {
    wx.getFileSystemManager().readFile({
      filePath: path,
      encoding: 'utf-8',
      success: (r) => handleText(r.data, name),
      fail:    () => uni.showToast({ title: '读取文件失败', icon: 'none' }),
    });
    return;
  }
  uni.showToast({ title: '当前平台读取未实现', icon: 'none' });
}

function handleText(text, fileName) {
  // Try to sniff the source sample rate before parsing the data — many ECG
  // exports prefix a header like "Fs=250" or "sample rate: 500". If found we
  // override the UI value; otherwise keep whatever the user set.
  const sniffed = sniffSampleRate(text);
  if (sniffed) {
    sampleRate.value = sniffed;
    srSniffed.value = true;
  }

  const numeric = parseSamples(text);
  if (!numeric || numeric.length < 100) {
    uni.showToast({ title: '解析失败或样本太少 (< 100)', icon: 'none' });
    return;
  }
  const src = getSource();
  if (!src || !src.setSamples) {
    uni.showToast({ title: '当前数据源不支持替换', icon: 'none' });
    return;
  }
  src.setSamples(numeric, sampleRate.value);
  customLoaded.value = true;
  customName.value = `${fileName} · ${numeric.length} 样本 @ ${sampleRate.value} Hz`;
  uni.showToast({ title: '已切换到上传数据', icon: 'success' });
}

// Header sniffer — looks at the first ~512 chars for common sample-rate keys
// (Fs, fs, SR, sr, sample rate, samplerate, sampling rate). Returns null if
// nothing recognizable is found. Intentionally narrow so we don't false-positive
// on integers that happen to appear in actual sample data.
function sniffSampleRate(text) {
  if (typeof text !== 'string') return null;
  const head = text.slice(0, 512);
  const m = head.match(/(?:^|[^a-zA-Z])(?:fs|sr|sample[\s_-]*rate|sampling[\s_-]*rate|samplerate)\s*[:=]\s*(\d{2,5})/i);
  if (!m) return null;
  const v = parseInt(m[1], 10);
  return (v >= 50 && v <= 50000) ? v : null;
}

// Best-effort parser. Tries JSON first (array or { samples|ecg|data: [...] });
// falls back to scanning the text for signed decimals — handles plain CSV
// (`-0.151,-0.161,...`), one-per-line, tab-separated, mixed whitespace, etc.
function parseSamples(text) {
  if (typeof text !== 'string' || text.length === 0) return null;
  try {
    const parsed = JSON.parse(text);
    const arr = Array.isArray(parsed) ? parsed : (parsed.samples || parsed.ecg || parsed.data);
    if (Array.isArray(arr)) {
      const out = arr.map(Number).filter(Number.isFinite);
      if (out.length > 0) return out;
    }
  } catch (_) { /* not JSON, fall through */ }
  const tokens = text.match(/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g);
  if (!tokens) return null;
  return tokens.map(Number).filter(Number.isFinite);
}

function onResetSource() {
  const src = getSource();
  if (src && src.resetSamples) {
    src.resetSamples();
    customLoaded.value = false;
    customName.value = '';
    sampleRate.value = 545;
    srSniffed.value = false;
    uni.showToast({ title: '已恢复内置数据', icon: 'success' });
  }
}
</script>

<style lang="scss">
@import '@/uni.scss';

.screen {
  background-color: $bg;
  padding: 32rpx 44rpx 80rpx;
  min-height: 100vh;
}

.header { margin-top: 24rpx; margin-bottom: 28rpx; }
.greeting    { font-size: 48rpx; font-weight: 700; color: $ink; line-height: 1.3; }
.subgreeting { display: block; font-size: 34rpx; color: $ink-soft; margin-top: 8rpx; }

.banner {
  display: flex; flex-direction: row; align-items: center; justify-content: space-between;
  padding: 36rpx 36rpx;
  border-radius: 44rpx;
  margin-bottom: 24rpx;
}
.banner-ok   { background-color: $accent; }
.banner-warn { background-color: $warn; }
.banner-text  { display: flex; flex-direction: column; flex: 1; }
.banner-label { font-size: 26rpx; color: rgba(255,255,255,0.85); letter-spacing: 1rpx; }
.banner-title { font-size: 44rpx; font-weight: 700; color: #fff; margin-top: 6rpx; }
.banner-sub   { font-size: 28rpx; color: rgba(255,255,255,0.85); margin-top: 6rpx; }
.banner-glyph {
  width: 112rpx; height: 112rpx; border-radius: 56rpx;
  background-color: rgba(255,255,255,0.22);
  display: flex; align-items: center; justify-content: center;
}
.banner-glyph-text { color: #fff; font-size: 56rpx; font-weight: 700; }

.hr-card {
  background-color: $card;
  border-radius: 40rpx;
  padding: 36rpx;
  margin-bottom: 24rpx;
}
.hr-row     { display: flex; flex-direction: row; align-items: flex-end; justify-content: space-between; }
.hr-numbers { display: flex; flex-direction: column; }
.hr-label   { font-size: 28rpx; color: $muted; }
.hr-mega    { font-size: 232rpx; font-weight: 700; color: $accent; line-height: 1; margin-top: 4rpx; }
.hr-unit-row{ display: flex; flex-direction: row; align-items: center; margin-top: 12rpx; }
.hr-unit    { font-size: 30rpx; color: $ink-soft; margin-right: 16rpx; }
.hr-tag     {
  font-size: 24rpx; color: $accent; background-color: $accent-soft;
  padding: 4rpx 14rpx; border-radius: 14rpx;
}
.heart-pulse {
  width: 120rpx; height: 120rpx; border-radius: 60rpx;
  background-color: $accent-soft;
  display: flex; align-items: center; justify-content: center;
  animation: heart-pulse 1s ease-in-out infinite;
}
.heart-glyph { color: $accent; font-size: 64rpx; }
@keyframes heart-pulse {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.12); }
}
.hr-canvas { margin-top: 24rpx; }

.tile-row {
  display: flex; flex-direction: row; gap: 24rpx; margin-bottom: 24rpx;
}
.tile {
  flex: 1;
  background-color: $card;
  border-radius: 36rpx;
  padding: 28rpx;
  display: flex; flex-direction: column;
}
.tile-icon  { font-size: 40rpx; margin-bottom: 8rpx; }
.tile-label { font-size: 26rpx; color: $muted; }
.tile-value { font-size: 44rpx; font-weight: 700; color: $ink; margin-top: 8rpx; }
.tile-hint  { font-size: 24rpx; color: $muted; margin-top: 4rpx; }

.record-btn {
  width: 100%;
  border-radius: 36rpx;
  padding: 40rpx 0;
  display: flex; align-items: center; justify-content: center;
  flex-direction: row;
  margin-bottom: 24rpx;
  box-sizing: border-box;
}
.record-btn-off  { background-color: $accent; }
.record-btn-on   { background-color: #fff; }
.record-btn-hover { opacity: 0.85; }
.record-label    { font-size: 38rpx; font-weight: 700; }
.record-label-off { color: #fff; }
.record-label-on  { color: $ink; }
.rec-dot {
  width: 22rpx; height: 22rpx; border-radius: 11rpx;
  background-color: $danger; margin-right: 16rpx;
  animation: rec-pulse 1.2s ease-in-out infinite;
}
@keyframes rec-pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.3; }
}

.shortcut-row { display: flex; flex-direction: row; gap: 24rpx; }
.shortcut {
  flex: 1;
  background-color: $card;
  border-radius: 36rpx;
  padding: 28rpx;
  display: flex; flex-direction: column;
}
.shortcut-hover { opacity: 0.85; }
.shortcut-label { font-size: 32rpx; font-weight: 700; color: $ink; }
.shortcut-hint  { font-size: 24rpx; color: $muted; margin-top: 6rpx; }

.source-row {
  margin-top: 24rpx;
  background-color: $card;
  border-radius: 28rpx;
  padding: 24rpx 28rpx;
  display: flex; flex-direction: row; align-items: center; gap: 16rpx;
}
.source-text { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.source-label { font-size: 22rpx; color: $muted; letter-spacing: 1rpx; }
.source-name {
  font-size: 26rpx; color: $ink; margin-top: 4rpx;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.source-actions { display: flex; flex-direction: row; gap: 12rpx; flex-shrink: 0; }
.source-btn {
  background-color: $accent-soft;
  border-radius: 22rpx;
  padding: 16rpx 28rpx;
}
.source-btn-text { color: $accent; font-size: 26rpx; font-weight: 700; }
.source-btn-ghost { background-color: transparent; border: 2rpx solid $line; }
.source-btn-ghost-text { color: $muted; font-size: 26rpx; font-weight: 700; }

.sr-row {
  margin-top: 12rpx;
  background-color: $card;
  border-radius: 28rpx;
  padding: 20rpx 28rpx;
  display: flex; flex-direction: row; align-items: center; gap: 16rpx;
}
.sr-label { font-size: 26rpx; color: $muted; }
.sr-input {
  width: 140rpx; height: 56rpx;
  background-color: $bg;
  border-radius: 14rpx;
  padding: 0 16rpx;
  font-size: 28rpx; color: $ink;
}
.sr-unit { font-size: 26rpx; color: $ink-soft; }
.sr-hint {
  font-size: 22rpx; color: $muted; margin-left: auto;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
</style>
