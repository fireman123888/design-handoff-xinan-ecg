// JS port of the ECG payload parser in README §"Reference parser (Kotlin)".
// Pitfalls preserved verbatim from the spec:
//   1. Multi-byte fields are little-endian.
//   2. 24-bit DPCM anchors are sign-extended manually (bit 23 → bits 24..31).
//
// Payload layout (after frame is unwrapped):
//   seqNum       u16 LE  (offset 0)
//   rtcMs        u32 LE  (offset 2)
//   flags        u8      (offset 6)
//   sampleCount  u8      (offset 7)
//   gainId       u8      (offset 8)
//   encoding     u8      (offset 9)         // 0 = raw 24-bit, 1 = DPCM
//   data[192]            (offset 10..201)

export function parseEcgPayload(payload) {
  const u8 = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const seqNum      = dv.getUint16(0, true);
  const rtcMs       = dv.getUint32(2, true);
  const flags       = dv.getUint8(6);
  const sampleCount = dv.getUint8(7);
  const gainId      = dv.getUint8(8);
  const encoding    = dv.getUint8(9);
  const data        = u8.subarray(10, 10 + 192);
  const samples = encoding === 0
    ? decodeRaw(data, sampleCount)
    : decodeDpcm(data, sampleCount);
  return { seqNum, rtcMs, flags, sampleCount, gainId, encoding, samples };
}

function decodeRaw(d, n) {
  const out = new Int32Array(n);
  for (let i = 0; i < n; i++) out[i] = read24LE(d, i * 3);
  return out;
}

function decodeDpcm(d, n) {
  const out = new Int32Array(n);
  let v = read24LE(d, 0);     // first sample is a 3-byte signed anchor
  out[0] = v;
  let off = 3;
  for (let i = 1; i < n; i++) {
    v += read16LE(d, off);    // signed 16-bit delta
    out[i] = v;
    off += 2;
  }
  return out;
}

// Sign-extend a 24-bit unsigned little-endian value to a JS i32.
// Trick: (u << 8) >> 8 — left-shift to put bit 23 at bit 31, then arithmetic right-shift.
function read24LE(b, off) {
  const u = (b[off] & 0xFF) | ((b[off + 1] & 0xFF) << 8) | ((b[off + 2] & 0xFF) << 16);
  return (u << 8) >> 8;
}

function read16LE(b, off) {
  const u = (b[off] & 0xFF) | ((b[off + 1] & 0xFF) << 8);
  return (u << 16) >> 16;
}
