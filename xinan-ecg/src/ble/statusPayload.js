// Parser for the Status characteristic (5d7f9e53). See README §"Status payload".
// Container header:
//   seqNum u16 LE  (0)
//   flags  u8      (2)
//   count  u8      (3)
// Then `count` records (20 bytes each):
//   rtcMs            u32 LE  (offset 0)
//   storedFrameCount u32 LE  (offset 4)
//   gainId           u8      (offset 8)
//   bleRssi          i8      (offset 9)
//   bleTxRateBps     u16 LE  (offset 10)
//   battVoltageMv    u16 LE  (offset 12)
//   battLevelPct     u8      (offset 14)
//   electrodeStatus  u8      (offset 15)   0=ok, 1=L off, 2=R off
//   deviceState      u8      (offset 16)
//   reserved[3]              (17..19)

const RECORD_SIZE = 20;

export function parseStatusPayload(payload) {
  const u8 = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const seqNum = dv.getUint16(0, true);
  const flags  = dv.getUint8(2);
  const count  = dv.getUint8(3);
  const records = [];
  for (let i = 0; i < count; i++) {
    const o = 4 + i * RECORD_SIZE;
    records.push({
      rtcMs:            dv.getUint32(o + 0, true),
      storedFrameCount: dv.getUint32(o + 4, true),
      gainId:           dv.getUint8(o + 8),
      bleRssi:          dv.getInt8(o + 9),
      bleTxRateBps:     dv.getUint16(o + 10, true),
      battVoltageMv:    dv.getUint16(o + 12, true),
      battLevelPct:     dv.getUint8(o + 14),
      electrodeStatus:  dv.getUint8(o + 15),
      deviceState:      dv.getUint8(o + 16),
    });
  }
  return { seqNum, flags, count, records };
}
