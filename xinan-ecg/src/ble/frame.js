/* ============================================================================
 *  FRAME  ——  通用帧封装/解析  (sync + len + payload + crc16)
 * ----------------------------------------------------------------------------
 *  线上格式 (所有特征上的所有数据帧统一):
 *
 *     ┌──────────┬─────┬──────────────┬──────────┐
 *     │ sync 4B  │ len │  payload N B │  crc 2B  │
 *     │AA AA 5555│ 1B  │              │  LE      │
 *     └──────────┴─────┴──────────────┴──────────┘
 *
 *  CRC16-CCITT/FALSE: poly 0x1021, init 0xFFFF, 不反转, XorOut 0x0000,
 *                     覆盖范围 = sync + len + payload (不含 crc 自己)
 *
 *  来源:  README §"Reference parser (Kotlin)" 的 JS 翻译
 *
 *  本文件区块:
 *    [1] 同步字节常量
 *    [2] decode    —— 收到的字节 → payload (校验失败返回 null)
 *    [3] encode    —— payload → 完整帧字节
 *    [4] crc16     —— 单独导出供测试和命令构造调用
 * ========================================================================== */

import { flags } from '../config/featureFlags.js';


// ============================================================================
// [区块 1] 同步字节常量
// ============================================================================

const SYNC_0 = 0xAA;
const SYNC_1 = 0xAA;
const SYNC_2 = 0x55;
const SYNC_3 = 0x55;


// ============================================================================
// [区块 2] decode  ——  解一帧;失败返回 null,成功返回 { payload }
// ============================================================================

export function decode(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

  // 长度兜底:至少要够 sync(4) + len(1) + crc(2) = 7
  if (u8.length < 4 + 1 + 2) return null;

  // 同步头匹配
  if (u8[0] !== SYNC_0 || u8[1] !== SYNC_1 || u8[2] !== SYNC_2 || u8[3] !== SYNC_3) return null;

  // 长度字段一致性
  const len = u8[4];
  if (u8.length !== 4 + 1 + len + 2) return null;

  // ----- CRC 校验区 (可由 flags.verifyFrameCrc 关掉以便调试) -----
  if (flags.verifyFrameCrc) {
    // 线上 CRC 是小端序:低字节在前
    const crcGiven = ((u8[u8.length - 1] & 0xFF) << 8) | (u8[u8.length - 2] & 0xFF);
    const crcCalc  = crc16Ccitt(u8, 0, u8.length - 2);
    if (crcGiven !== crcCalc) return null;
  }

  return { payload: u8.slice(5, 5 + len) };
}


// ============================================================================
// [区块 3] encode  ——  把 payload 包成完整帧字节
// ============================================================================

export function encode(payload) {
  const p = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
  const len = p.length;
  if (len > 0xFF) throw new RangeError('payload too long for u8 length field');

  const out = new Uint8Array(4 + 1 + len + 2);

  // sync + len
  out[0] = SYNC_0; out[1] = SYNC_1; out[2] = SYNC_2; out[3] = SYNC_3;
  out[4] = len;

  // payload
  out.set(p, 5);

  // crc16 小端写入
  const crc = crc16Ccitt(out, 0, 5 + len);
  out[5 + len]     =  crc        & 0xFF;
  out[5 + len + 1] = (crc >>  8) & 0xFF;

  return out;
}


// ============================================================================
// [区块 4] crc16Ccitt  ——  按位实现,不依赖查表;够快也够小
// ============================================================================

export function crc16Ccitt(b, off, len) {
  let crc = 0xFFFF;
  for (let i = off; i < off + len; i++) {
    crc = (crc ^ ((b[i] & 0xFF) << 8)) & 0xFFFF;
    for (let k = 0; k < 8; k++) {
      crc = (crc & 0x8000) !== 0
        ? ((crc << 1) ^ 0x1021) & 0xFFFF
        : (crc << 1) & 0xFFFF;
    }
  }
  return crc;
}
