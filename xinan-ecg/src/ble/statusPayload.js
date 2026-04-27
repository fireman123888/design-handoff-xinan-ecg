/* ============================================================================
 *  STATUS PAYLOAD  ——  Status 特征 (5d7f9e53) 的 payload 解析
 * ----------------------------------------------------------------------------
 *  来源:  README §"Status payload"
 *
 *  容器头 (4 字节) + 若干条记录 (每条 20 字节):
 *
 *  ── 容器头 ──
 *    seqNum  u16 LE  (0)
 *    flags   u8      (2)
 *    count   u8      (3)
 *
 *  ── 每条记录 (20B) ──
 *    rtcMs            u32 LE  (0)
 *    storedFrameCount u32 LE  (4)
 *    gainId           u8      (8)
 *    bleRssi          i8      (9)            ←  signed
 *    bleTxRateBps     u16 LE  (10)
 *    battVoltageMv    u16 LE  (12)
 *    battLevelPct     u8      (14)
 *    electrodeStatus  u8      (15)           ← 0=ok, 1=L off, 2=R off
 *    deviceState     u8      (16)
 *    reserved[3]     ─       (17..19)
 *
 *  本文件区块:
 *    [1] parseStatusPayload  —— 主入口
 * ========================================================================== */


// ============================================================================
// [区块 1] 解析入口:返回 { seqNum, flags, count, records: [...] }
// ============================================================================

const RECORD_SIZE = 20;

export function parseStatusPayload(payload) {
  const u8 = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);

  // ----- 容器头 -----
  const seqNum = dv.getUint16(0, true);
  const flags  = dv.getUint8(2);
  const count  = dv.getUint8(3);

  // ----- count 条记录 -----
  const records = [];
  for (let i = 0; i < count; i++) {
    const o = 4 + i * RECORD_SIZE;
    records.push({
      rtcMs:            dv.getUint32(o + 0,  true),
      storedFrameCount: dv.getUint32(o + 4,  true),
      gainId:           dv.getUint8 (o + 8),
      bleRssi:          dv.getInt8  (o + 9),         // signed!
      bleTxRateBps:     dv.getUint16(o + 10, true),
      battVoltageMv:    dv.getUint16(o + 12, true),
      battLevelPct:     dv.getUint8 (o + 14),
      electrodeStatus:  dv.getUint8 (o + 15),
      deviceState:      dv.getUint8 (o + 16),
    });
  }

  return { seqNum, flags, count, records };
}
