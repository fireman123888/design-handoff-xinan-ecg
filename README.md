# Handoff: 心安心电 (Xin'an ECG) — Patient-Facing Android App

## Overview

A patient-facing Android application for an over-the-counter ECG (electrocardiogram) monitoring device. The app pairs with the device over BLE, displays a live waveform, computes heart rate, records sessions, and shares summaries with family members.

The design is **age-friendly** — large type, oversized touch targets, plain-language Chinese copy, single primary action per screen, high contrast. The target user is an elderly patient (e.g. 王奶奶 / "Grandma Wang") with their adult children configured as family contacts.

The protocol layer is **already specified** in the included PDF (`心电 APP 对接.pdf`) — UUIDs, frame format, CRC, packet structures. The design assumes that protocol.

## About the Design Files

The HTML files in this bundle are **design references** — interactive prototypes built in React+JSX that demonstrate the intended look, layout, copy, and interactions. They are **not production code to copy directly**.

Your job is to **recreate these designs in a native Android codebase** using the protocol spec in the PDF. The recommended stack (since the spec includes `gatt.requestMtu(247)` and other Android-specific APIs) is:

- **Kotlin + Jetpack Compose** for the UI
- **Android BLE APIs** (`BluetoothLeScanner`, `BluetoothGatt`) for device communication
- **Room** (or SQLite) for storing sessions
- **DataStore** for preferences (text scale, alarm thresholds)

If you're building React Native or Flutter instead, the design and protocol logic transfer directly; just use `react-native-ble-plx` or `flutter_blue_plus`.

## Fidelity

**High-fidelity.** Final colors, typography, spacing, copy, and interaction patterns. Recreate pixel-close in Compose.

## Screens

### 1. Welcome / Pairing (3 steps)

**1a. Welcome**
- Centered: 120×120 circle in `accentSoft`, large heart icon
- Title `欢迎使用 / 心安心电` (30sp, bold, accent color on the brand line)
- Subtitle: `一台贴心的心电监测设备，陪伴您每一次心跳。` (17sp)
- Primary button `开始连接设备`
- Secondary text link: `已经配对过？直接进入`

**1b. Scanning**
- Animated radar rings (3 staggered, 2.4s scale-out)
- Centered Bluetooth icon on solid accent disc (120dp)
- Title flips from `正在搜索附近设备…` to `已找到 1 台设备`
- After ~1.8s, a card appears showing the device:
  - `心安 ECG · 设备 03`
  - MAC: `5d:7f:9e:51 · 信号良好`
- CTA: `连接此设备` (disabled while scanning)

**1c. Electrode placement**
- SVG body silhouette with two electrode positions labeled L/R
- Tip card with 💡 emoji on `accentSoft` background
- Primary CTA: `已贴好，开始记录`

### 2. Home (the live screen)

Top-to-bottom:
- Greeting `下午好，王奶奶` + `今天的心跳很稳定` (24sp bold)
- **Status banner** — full-bleed rounded card (accent color when OK, warn color on electrode-off):
  - Label `设备状态`, big text `一切正常` or `需要调整电极`
  - Sub-text shows recording duration
  - Right side: 56dp circle with ✓ or ! glyph
- **HR mega card** — white card:
  - `当前心率` label
  - 116sp HR number in accent color
  - `次/分` unit + `正常` micro-label
  - Animated pulse heart on the right (scales with `60/hr` seconds)
  - Live ECG canvas (344×84, no grid, accent stroke, 2.4 lineWidth)
- 2-up tile grid: 设备电量 / 蓝牙信号 (each shows icon + label + value + hint)
- Primary record button (full width, 19sp, 20px vertical padding):
  - When recording: white bg, ink text, animated red pulse dot, label `正在记录 · 点击暂停`
  - When stopped: accent bg, white text, label `开始记录`
- 2-up shortcut row: 历史记录 / 更多操作

### 3. History

- Top week-summary card: avg HR `74` (56sp accent), 7 mini bars labeled 一二三四五六日, today highlighted
- 8 day rows. Each row: 56dp date pill + day label (今天/昨天/月日) + avg/min/max line + duration line + chevron
- Days with anomalies show `· 有提醒` flag in warn color

### 4. Detail

- Header: date + duration
- Stats card: 平均心率 (large, accent) / 最低 / 最高
- 24h HR trend SVG with 60–90 normal-range band
- Sample 10s ECG strip on pink graph paper
- Anomaly callout if present
- Bottom: 返回 / 分享给家人

### 5. Family

- Emergency contact card: avatar + name + masked phone + 呼叫 button
- Family members list (3 rows: 管理员 / 可查看 tags)
- `分享今日报告` primary button (toggles to `✓ 已分享今日报告` on tap)
- Footer copy explaining when family gets notifications

### 6. Settings

Sections (each: muted label + grouped white card with rows):
- **显示**: text size segmented control (标准 1.0 / 加大 1.15 / 特大 1.3) — applies live via `fontSize: ${scale*100}%` on the root
- **提醒**: 3 toggles (HR out of range, electrode off, low battery)
- **设备**: status row, sync RTC button → command 0x04, rebind user → 0x05, shutdown → 0x01 (warn-styled)

### 7. Alarm overlay (full-screen)

Triggered when `electrode_status != 0`:
- Full-screen warn-color background
- 120dp circle with `!` glyph, pulsing white shadow ring
- Title `电极脱落` (32sp)
- Body: `设备已暂停记录。请将贴片重新按压贴合皮肤。`
- Two big buttons: 我已贴好 (white) / 呼叫家人帮忙 (outline)

## Design Tokens

```kotlin
// Colors (use Compose Color())
val Bg          = Color(0xFFF3F6F8)
val Card        = Color(0xFFFFFFFF)
val Ink         = Color(0xFF15212E)
val InkSoft     = Color(0xFF3A4856)
val Muted       = Color(0xFF6A7A8C)
val Line        = Color(0xFFE3EAF0)
val Accent      = Color(0xFF22A98C) // ≈ oklch(0.55 0.13 165)
val AccentSoft  = Color(0xFFE7F5F0) // ≈ oklch(0.94 0.04 165)
val Warn        = Color(0xFFD96A3F) // ≈ oklch(0.62 0.18 35)
val WarnSoft    = Color(0xFFFCEEE6)
val Danger      = Color(0xFFB1242B)
```

**Typography:** PingFang SC / system. Body 16sp, button 19sp, mega HR 116sp.
**Radii:** card 18–22dp, banner 22dp, buttons 16–18dp, pills 14dp.
**Spacing:** screen edge 14–22dp, between cards 12dp.
**Touch targets:** minimum 56dp, primary buttons 60dp.

## BLE Protocol — Implementation Spec

All UUIDs share suffix `-6fcc-4d0d-9d1e-ad7dce7ab472`.

| Service / Characteristic | UUID prefix | Properties | Purpose |
|---|---|---|---|
| ECG Data Service | `5d7f9e51` | — | Container |
| ↳ ECG Data | `5d7f9e52` | Notify | Waveform, 4 frames/sec |
| ↳ Status | `5d7f9e53` | Notify + Read | 1 Hz status |
| ↳ IMU Data | `5d7f9e54` | Notify | Motion, ~2 Hz |
| ECG Control Service | `5d7f9e60` | — | Container |
| ↳ Command Write | `5d7f9e61` | Write / WriteNoRsp | App→device commands |
| ↳ Command Response | `5d7f9e62` | Notify | Device→app responses |

### Connection sequence

```
1. BluetoothLeScanner.startScan(filter Service UUID 5d7f9e51-…)
2. onScanResult → BluetoothDevice.connectGatt(...)
3. onConnectionStateChange(STATE_CONNECTED)
4. After 500ms the device requests MTU=247.
   ALSO call gatt.requestMtu(247) yourself.
5. onMtuChanged → gatt.discoverServices()
6. onServicesDiscovered → enable notifications on:
     5d7f9e52, 5d7f9e53, 5d7f9e54, 5d7f9e62
   (write [0x01,0x00] to each CCCD descriptor)
7. App is ready. Send commands by writing to 5d7f9e61.
```

### Frame format

Every frame on every characteristic:

```
[sync 4B = AA AA 55 55] [len 1B] [payload N B] [crc 2B = CRC16-CCITT]
```

CRC16-CCITT: `Poly=0x1021, Init=0xFFFF, RefIn=False, RefOut=False, XorOut=0x0000`,
covering `sync + len + payload`.

### Reference parser (Kotlin)

```kotlin
import java.nio.ByteBuffer
import java.nio.ByteOrder

object EcgFrame {
    private val SYNC = byteArrayOf(0xAA.toByte(), 0xAA.toByte(), 0x55, 0x55)

    data class Decoded(val payload: ByteArray)

    fun decode(bytes: ByteArray): Decoded? {
        if (bytes.size < 4 + 1 + 2) return null
        if (bytes[0] != SYNC[0] || bytes[1] != SYNC[1] ||
            bytes[2] != SYNC[2] || bytes[3] != SYNC[3]) return null
        val len = bytes[4].toInt() and 0xFF
        if (bytes.size != 4 + 1 + len + 2) return null
        val crcGiven = ((bytes[bytes.size-1].toInt() and 0xFF) shl 8) or
                        (bytes[bytes.size-2].toInt() and 0xFF) // little-endian
        val crcCalc = crc16Ccitt(bytes, 0, bytes.size - 2)
        if (crcGiven != crcCalc) return null
        return Decoded(bytes.copyOfRange(5, 5 + len))
    }

    private fun crc16Ccitt(b: ByteArray, off: Int, len: Int): Int {
        var crc = 0xFFFF
        for (i in off until off + len) {
            crc = crc xor ((b[i].toInt() and 0xFF) shl 8)
            repeat(8) {
                crc = if (crc and 0x8000 != 0) ((crc shl 1) xor 0x1021) and 0xFFFF
                      else (crc shl 1) and 0xFFFF
            }
        }
        return crc
    }
}

// ECG Data payload (5d7f9e52)
data class EcgPacket(
    val seqNum: Int, val rtcMs: Long, val flags: Int,
    val sampleCount: Int, val gainId: Int, val encoding: Int,
    val samples: IntArray  // micro-volts or raw ADC counts
)

fun parseEcgPayload(p: ByteArray): EcgPacket {
    val bb = ByteBuffer.wrap(p).order(ByteOrder.LITTLE_ENDIAN)  // ⚠️ MUST be LE
    val seqNum = bb.short.toInt() and 0xFFFF
    val rtcMs = bb.int.toLong() and 0xFFFFFFFFL
    val flags = bb.get().toInt() and 0xFF
    val sampleCount = bb.get().toInt() and 0xFF
    val gainId = bb.get().toInt() and 0xFF
    val encoding = bb.get().toInt() and 0xFF
    val data = ByteArray(192).also { bb.get(it) }
    val samples = if (encoding == 0) decodeRaw(data, sampleCount)
                  else decodeDpcm(data, sampleCount)
    return EcgPacket(seqNum, rtcMs, flags, sampleCount, gainId, encoding, samples)
}

private fun decodeRaw(d: ByteArray, n: Int): IntArray {
    val out = IntArray(n)
    for (i in 0 until n) {
        out[i] = read24LE(d, i * 3)
    }
    return out
}

private fun decodeDpcm(d: ByteArray, n: Int): IntArray {
    val out = IntArray(n)
    var v = read24LE(d, 0)            // first sample is 3-byte anchor
    out[0] = v
    var off = 3
    for (i in 1 until n) {
        val delta = read16LE(d, off)  // signed 16-bit delta
        v += delta
        out[i] = v
        off += 2
    }
    return out
}

// ⚠️ 24-bit sign-extension — bit 23 must extend through bits 24..31
private fun read24LE(b: ByteArray, off: Int): Int {
    val v = (b[off].toInt() and 0xFF) or
            ((b[off+1].toInt() and 0xFF) shl 8) or
            ((b[off+2].toInt() and 0xFF) shl 16)
    return if (v and 0x800000 != 0) v or 0xFF000000.toInt() else v
}
private fun read16LE(b: ByteArray, off: Int): Int {
    val v = (b[off].toInt() and 0xFF) or ((b[off+1].toInt() and 0xFF) shl 8)
    return v.toShort().toInt()  // Short conversion sign-extends
}
```

### Status payload (5d7f9e53)

Container holds `seq_num(2) flags(1) count(1) records[count]`. Each record (count=1 in realtime, count=11 in batch):

```
rtc_ms (u32, 0)         stored_frame_count (u32, 4)
gain_id (u8, 8)         ble_rssi (i8, 9)
ble_tx_rate_bps (u16, 10) batt_voltage_mv (u16, 12)
batt_level_pct (u8, 14)   electrode_status (u8, 15)
device_state (u8, 16)     reserved[3] (17..19)
```

Drive the home screen banner from `electrode_status` (0=ok, 1=L off, 2=R off).

### Commands (write to 5d7f9e61)

`opcode(1) + params(N)` then framed with sync/len/crc on the wire.

| Command | opcode |
|---|---|
| Power off | 0x01 |
| Start capture | 0x02 |
| Stop capture | 0x03 |
| Sync RTC | 0x04 (param: u64 epoch ms LE) |
| Bind user ID | 0x05 (param: u32 user id LE) |

Response on `5d7f9e62`: `opcode(1) + result(1) + len(u16) + payload[len]`. `result==0` means success.

### Two pitfalls (from spec)

1. **Always use `ByteOrder.LITTLE_ENDIAN`** when wrapping a `ByteBuffer`. Java's default is big-endian and will silently mis-parse every multi-byte field.
2. **Sign-extend 24-bit DPCM anchors manually** (see `read24LE` above). Without this, negative ECG samples decode as huge positive values and the waveform jumps off-screen.

## State Management

Suggested ViewModel state:
- `connectionState: Disconnected | Scanning | Connecting | Ready | Error`
- `device: BleDeviceInfo?`
- `liveWaveform: RingBuffer<Float>` (~6s × sample rate)
- `hr: Int` (computed from R-peak intervals)
- `status: DeviceStatus` (battery, rssi, electrode, ...)
- `isRecording: Boolean`
- `events: List<Event>` (alarms, command results)
- `prefs: { textScale, hrAlarmHi, hrAlarmLo, batteryAlarm, family[], ... }`

Persist sessions to Room: `Session(id, startTs, endTs, avgHr, minHr, maxHr, sampleBlobPath)`.

## Files in this Bundle

- `心电 APP 对接.pdf` — original BLE protocol spec from device manufacturer
- `elderly.html` — full interactive design reference (open in a browser)
- `index.html` — comparison of 5 design directions (the elderly one was chosen)
- `elderly-app.jsx` — all elderly-app screens in JSX (Pairing, Home, History, Detail, Family, Settings, Alarm)
- `ecg-engine.jsx` — simulation engine + ECG canvas renderer; useful as reference for how the live waveform is drawn
- `variants.jsx` — the other 4 design directions (clinical/wellness/dark/paper) in case the team wants to revisit
- `ecg-samples.json` — ~30,000 real ECG samples (normalized to ±1.0). Use these as test fixtures when developing without a real device.

## Build Order Recommendation

1. **BLE layer** first (no UI). Implement scan → connect → MTU → discover → notify on a clean class. Verify in Logcat that frames decode and CRCs pass.
2. **Live ECG canvas** Compose component. Feed it the ring buffer; draw with `Canvas { drawPath(...) }`.
3. **Home screen** with hardcoded fake state, then wire to the BLE layer.
4. **Pairing flow** (it gates onto Home).
5. **Persistence** — record sessions to Room, build History/Detail from them.
6. **Settings + Family** last; they're mostly static UI.
