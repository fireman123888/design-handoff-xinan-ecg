// Tests the framing layer against the README spec.
// Run with `node --test test`.

import { test } from 'node:test';
import assert from 'node:assert';
import { encode, decode, crc16Ccitt } from '../src/ble/frame.js';

test('crc16-ccitt/false on "123456789" = 0x29B1 (industry check vector)', () => {
  const s = new TextEncoder().encode('123456789');
  assert.strictEqual(crc16Ccitt(s, 0, s.length), 0x29B1);
});

test('encode produces correct sync + len header', () => {
  const framed = encode(new Uint8Array([1, 2, 3, 4, 5]));
  assert.deepStrictEqual(Array.from(framed.slice(0, 4)), [0xAA, 0xAA, 0x55, 0x55]);
  assert.strictEqual(framed[4], 5);
});

test('encode → decode round-trips the payload', () => {
  const payload = new Uint8Array([0x01, 0xFF, 0xAA, 0x00, 0x55, 0x42]);
  const decoded = decode(encode(payload));
  assert.ok(decoded, 'decoded should not be null');
  assert.deepStrictEqual(Array.from(decoded.payload), Array.from(payload));
});

test('decode rejects bad sync', () => {
  const bad = new Uint8Array([0xBB, 0xAA, 0x55, 0x55, 0, 0, 0]);
  assert.strictEqual(decode(bad), null);
});

test('decode rejects wrong length field', () => {
  const framed = encode(new Uint8Array([1, 2, 3]));
  framed[4] = 99;
  assert.strictEqual(decode(framed), null);
});

test('decode rejects payload corruption (CRC mismatch)', () => {
  const framed = encode(new Uint8Array([1, 2, 3]));
  framed[5] ^= 0xFF;
  assert.strictEqual(decode(framed), null);
});

test('decode rejects truncated frames', () => {
  const framed = encode(new Uint8Array([1, 2, 3]));
  assert.strictEqual(decode(framed.slice(0, framed.length - 1)), null);
});

test('CRC bytes are little-endian on the wire', () => {
  const framed = encode(new Uint8Array([0]));
  // Recompute and confirm low byte sits before high byte
  const crc = crc16Ccitt(framed, 0, framed.length - 2);
  assert.strictEqual(framed[framed.length - 2], crc & 0xFF);
  assert.strictEqual(framed[framed.length - 1], (crc >> 8) & 0xFF);
});
