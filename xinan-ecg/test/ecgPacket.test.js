// Verifies the two pitfalls called out in README §"Two pitfalls":
//   1. ByteOrder must be little-endian.
//   2. 24-bit DPCM anchors must be sign-extended manually.

import { test } from 'node:test';
import assert from 'node:assert';
import { parseEcgPayload } from '../src/ble/ecgPacket.js';

function makePayload({ seqNum = 0, rtcMs = 0, sampleCount, encoding, fillData }) {
  const buf = new Uint8Array(10 + 192);
  const dv = new DataView(buf.buffer);
  dv.setUint16(0, seqNum, true);
  dv.setUint32(2, rtcMs, true);
  buf[6] = 0;
  buf[7] = sampleCount;
  buf[8] = 1;
  buf[9] = encoding;
  fillData(buf, 10);
  return buf;
}

test('header fields are read as little-endian', () => {
  const buf = makePayload({
    seqNum: 0x1234,
    rtcMs:  0xDEADBEEF,
    sampleCount: 1,
    encoding: 0,
    fillData: (b, off) => { b[off] = 0; b[off+1] = 0; b[off+2] = 0; },
  });
  const pkt = parseEcgPayload(buf);
  assert.strictEqual(pkt.seqNum, 0x1234);
  assert.strictEqual(pkt.rtcMs,  0xDEADBEEF);
});

test('raw encoding sign-extends 24-bit values', () => {
  const buf = makePayload({
    sampleCount: 3,
    encoding: 0,
    fillData: (b, off) => {
      // sample 0 = -1 (0xFFFFFF)
      b[off+0] = 0xFF; b[off+1] = 0xFF; b[off+2] = 0xFF;
      // sample 1 = +1
      b[off+3] = 0x01; b[off+4] = 0x00; b[off+5] = 0x00;
      // sample 2 = -8388608 (0x800000) — most negative i24
      b[off+6] = 0x00; b[off+7] = 0x00; b[off+8] = 0x80;
    },
  });
  const pkt = parseEcgPayload(buf);
  assert.deepStrictEqual(Array.from(pkt.samples), [-1, 1, -8388608]);
});

test('DPCM encoding: 3-byte anchor + signed 16-bit deltas', () => {
  const buf = makePayload({
    sampleCount: 4,
    encoding: 1,
    fillData: (b, off) => {
      // anchor = 100
      b[off+0] = 100; b[off+1] = 0; b[off+2] = 0;
      // delta +5
      b[off+3] = 5;    b[off+4] = 0;
      // delta -10 (0xFFF6 LE)
      b[off+5] = 0xF6; b[off+6] = 0xFF;
      // delta 0
      b[off+7] = 0;    b[off+8] = 0;
    },
  });
  const pkt = parseEcgPayload(buf);
  assert.deepStrictEqual(Array.from(pkt.samples), [100, 105, 95, 95]);
});

test('DPCM with negative anchor (regression for missing sign-extend)', () => {
  // Without sign-extension, an anchor of -1 (0xFFFFFF) would parse as +16777215
  // and the waveform would jump off-screen. README §"Two pitfalls" item 2.
  const buf = makePayload({
    sampleCount: 2,
    encoding: 1,
    fillData: (b, off) => {
      b[off+0] = 0xFF; b[off+1] = 0xFF; b[off+2] = 0xFF; // anchor = -1
      b[off+3] = 0x02; b[off+4] = 0x00;                   // delta +2 → +1
    },
  });
  const pkt = parseEcgPayload(buf);
  assert.deepStrictEqual(Array.from(pkt.samples), [-1, 1]);
});
