// Command builders + response parser for the Control service (5d7f9e60).
// Wire format: opcode(1) + params(N), then framed via frame.encode().
// Response on 5d7f9e62: opcode(1) + result(1) + len(u16 LE) + payload[len].

import { encode } from './frame.js';

export const Op = Object.freeze({
  POWER_OFF:     0x01,
  START_CAPTURE: 0x02,
  STOP_CAPTURE:  0x03,
  SYNC_RTC:      0x04, // param: u64 LE epoch ms
  BIND_USER:     0x05, // param: u32 LE user id
});

export function buildCommandFrame(opcode, params) {
  const p = params instanceof Uint8Array ? params : (params ? new Uint8Array(params) : new Uint8Array(0));
  const payload = new Uint8Array(1 + p.length);
  payload[0] = opcode & 0xFF;
  payload.set(p, 1);
  return encode(payload);
}

export function powerOff()     { return buildCommandFrame(Op.POWER_OFF); }
export function startCapture() { return buildCommandFrame(Op.START_CAPTURE); }
export function stopCapture()  { return buildCommandFrame(Op.STOP_CAPTURE); }

export function syncRtc(epochMs) {
  const ab = new ArrayBuffer(8);
  new DataView(ab).setBigUint64(0, BigInt(epochMs), true);
  return buildCommandFrame(Op.SYNC_RTC, new Uint8Array(ab));
}

export function bindUser(userId) {
  const ab = new ArrayBuffer(4);
  new DataView(ab).setUint32(0, userId >>> 0, true);
  return buildCommandFrame(Op.BIND_USER, new Uint8Array(ab));
}

export function parseCommandResponse(payload) {
  const u8 = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const opcode = dv.getUint8(0);
  const result = dv.getUint8(1);
  const len    = dv.getUint16(2, true);
  return { opcode, result, len, payload: u8.subarray(4, 4 + len) };
}
