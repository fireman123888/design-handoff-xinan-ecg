// JS port of the reference parser in README §"Reference parser (Kotlin)".
//
// Wire format (every frame on every characteristic):
//   [sync 4B = AA AA 55 55] [len 1B] [payload N B] [crc16 2B little-endian]
//
// CRC16-CCITT/FALSE: poly 0x1021, init 0xFFFF, no reflection, XorOut 0x0000,
// covering sync + len + payload.

const SYNC_0 = 0xAA;
const SYNC_1 = 0xAA;
const SYNC_2 = 0x55;
const SYNC_3 = 0x55;

export function decode(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (u8.length < 4 + 1 + 2) return null;
  if (u8[0] !== SYNC_0 || u8[1] !== SYNC_1 || u8[2] !== SYNC_2 || u8[3] !== SYNC_3) return null;
  const len = u8[4];
  if (u8.length !== 4 + 1 + len + 2) return null;
  // CRC bytes are little-endian on the wire: low byte then high byte.
  const crcGiven = ((u8[u8.length - 1] & 0xFF) << 8) | (u8[u8.length - 2] & 0xFF);
  const crcCalc = crc16Ccitt(u8, 0, u8.length - 2);
  if (crcGiven !== crcCalc) return null;
  return { payload: u8.slice(5, 5 + len) };
}

export function encode(payload) {
  const p = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
  const len = p.length;
  if (len > 0xFF) throw new RangeError('payload too long for u8 length field');
  const out = new Uint8Array(4 + 1 + len + 2);
  out[0] = SYNC_0; out[1] = SYNC_1; out[2] = SYNC_2; out[3] = SYNC_3;
  out[4] = len;
  out.set(p, 5);
  const crc = crc16Ccitt(out, 0, 5 + len);
  out[5 + len] = crc & 0xFF;
  out[5 + len + 1] = (crc >> 8) & 0xFF;
  return out;
}

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
