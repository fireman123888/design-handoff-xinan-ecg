import { test } from 'node:test';
import assert from 'node:assert';
import { parseStatusPayload } from '../src/ble/statusPayload.js';

test('parses a single-record realtime status payload', () => {
  const buf = new Uint8Array(4 + 20);
  const dv = new DataView(buf.buffer);
  dv.setUint16(0, 7, true);          // seqNum
  dv.setUint8(2, 0);                  // flags
  dv.setUint8(3, 1);                  // count
  dv.setUint32(4, 1700000000, true);  // rtcMs
  dv.setUint32(8, 12480, true);       // storedFrameCount
  dv.setUint8(12, 2);                 // gainId
  dv.setInt8(13, -54);                // bleRssi (signed)
  dv.setUint16(14, 12480, true);      // bleTxRateBps
  dv.setUint16(16, 3940, true);       // battVoltageMv
  dv.setUint8(18, 86);                // battLevelPct
  dv.setUint8(19, 1);                 // electrodeStatus = L off
  dv.setUint8(20, 1);                 // deviceState

  const s = parseStatusPayload(buf);
  assert.strictEqual(s.seqNum, 7);
  assert.strictEqual(s.count, 1);
  assert.strictEqual(s.records.length, 1);
  const r = s.records[0];
  assert.strictEqual(r.bleRssi, -54);
  assert.strictEqual(r.battLevelPct, 86);
  assert.strictEqual(r.electrodeStatus, 1);
  assert.strictEqual(r.bleTxRateBps, 12480);
  assert.strictEqual(r.battVoltageMv, 3940);
});
