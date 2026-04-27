/* ============================================================================
 *  ECG PACKET  ——  ECG 数据特征 (5d7f9e52) 的 payload 解析
 * ----------------------------------------------------------------------------
 *  来源:  README §"Reference parser (Kotlin)"  的 JS 移植
 *
 *  ⚠️ 两个易错点(从规范原样保留):
 *    1) 多字节字段统一小端序 (LE)
 *    2) 24-bit DPCM 锚点要手动符号扩展 (bit 23 → bits 24..31)
 *
 *  payload 布局(已剥掉 frame 的 sync/len/crc):
 *  ┌─────────────┬──────┬──────┬──────────────────────────────────────────┐
 *  │  字段        │ 偏移 │ 大小 │  说明                                    │
 *  ├─────────────┼──────┼──────┼──────────────────────────────────────────┤
 *  │  seqNum     │  0   │ u16  │ LE                                       │
 *  │  rtcMs      │  2   │ u32  │ LE                                       │
 *  │  flags      │  6   │ u8   │                                          │
 *  │  sampleCount│  7   │ u8   │ 实际样本数 (设备保证 ≤ 64)                  │
 *  │  gainId     │  8   │ u8   │ 增益档位 (校准表里查具体倍数)                │
 *  │  encoding   │  9   │ u8   │ 0=raw 24-bit, 1=DPCM(锚点+16bit delta)   │
 *  │  data[192]  │ 10   │ ──   │ 编码后的样本                              │
 *  └─────────────┴──────┴──────┴──────────────────────────────────────────┘
 *
 *  本文件区块:
 *    [1] parseEcgPayload   —— 主入口
 *    [2] decodeRaw         —— encoding=0 路径
 *    [3] decodeDpcm        —— encoding=1 路径 (受 flags.dpcmEncodingSupport 控制)
 *    [4] read24LE/read16LE —— 带符号扩展的小端读取工具
 * ========================================================================== */

import { flags } from '../config/featureFlags.js';


// ============================================================================
// [区块 1] 主入口:解一个 ECG payload → { 头部字段..., samples: Int32Array }
// ============================================================================

export function parseEcgPayload(payload) {
  const u8 = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);

  // ----- header (10 字节) -----
  const seqNum      = dv.getUint16(0, true);
  const rtcMs       = dv.getUint32(2, true);
  const flagsByte   = dv.getUint8(6);
  const sampleCount = dv.getUint8(7);
  const gainId      = dv.getUint8(8);
  const encoding    = dv.getUint8(9);

  // ----- data block (固定 192 字节窗口,实际有效区由 sampleCount + encoding 决定) -----
  const data = u8.subarray(10, 10 + 192);

  // ----- 解码 -----
  let samples;
  if (encoding === 0) {
    samples = decodeRaw(data, sampleCount);
  } else if (flags.dpcmEncodingSupport) {
    samples = decodeDpcm(data, sampleCount);
  } else {
    // DPCM 路径关闭时降级为 raw,避免抛错
    samples = decodeRaw(data, sampleCount);
  }

  return { seqNum, rtcMs, flags: flagsByte, sampleCount, gainId, encoding, samples };
}


// ============================================================================
// [区块 2] decodeRaw  ——  整段 24-bit 原始样本
// ============================================================================

function decodeRaw(d, n) {
  const out = new Int32Array(n);
  for (let i = 0; i < n; i++) out[i] = read24LE(d, i * 3);
  return out;
}


// ============================================================================
// [区块 3] decodeDpcm  ——  3-byte 锚点 + (n-1) 个 16-bit 带符号 delta
// ============================================================================

function decodeDpcm(d, n) {
  const out = new Int32Array(n);
  let v = read24LE(d, 0);     // 第一个样本是 3 字节带符号锚点
  out[0] = v;
  let off = 3;
  for (let i = 1; i < n; i++) {
    v += read16LE(d, off);    // 16-bit 带符号 delta
    out[i] = v;
    off += 2;
  }
  return out;
}


// ============================================================================
// [区块 4] read24LE / read16LE  ——  带符号扩展的小端读取
// ----------------------------------------------------------------------------
// 24→32 的符号扩展技巧:(u << 8) >> 8
//   左移把 bit 23 顶到 bit 31,再算术右移就能让符号位铺到高 8 位。
// ============================================================================

function read24LE(b, off) {
  const u = (b[off] & 0xFF)
          | ((b[off + 1] & 0xFF) <<  8)
          | ((b[off + 2] & 0xFF) << 16);
  return (u << 8) >> 8;
}

function read16LE(b, off) {
  const u = (b[off] & 0xFF) | ((b[off + 1] & 0xFF) << 8);
  return (u << 16) >> 16;
}
