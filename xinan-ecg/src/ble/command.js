/* ============================================================================
 *  COMMAND  ——  控制服务 (5d7f9e60) 的命令构造与响应解析
 * ----------------------------------------------------------------------------
 *  线上格式:
 *    Write (5d7f9e61):  opcode(1) + params(N)  →  再交给 frame.encode()
 *    Notify(5d7f9e62):  opcode(1) + result(1) + len(u16 LE) + payload[len]
 *
 *  本文件区块:
 *    [1] Op 常量          —— 所有支持的 opcode
 *    [2] buildCommandFrame —— 通用构造器
 *    [3] 便捷构造函数      —— powerOff / startCapture / stopCapture / syncRtc / bindUser
 *    [4] parseCommandResponse —— 响应解析
 * ========================================================================== */

import { encode } from './frame.js';


// ============================================================================
// [区块 1] opcode 字典  ——  与设备端固件保持一致
// ============================================================================

export const Op = Object.freeze({
  POWER_OFF:     0x01,
  START_CAPTURE: 0x02,
  STOP_CAPTURE:  0x03,
  SYNC_RTC:      0x04, // params: u64 LE epoch ms
  BIND_USER:     0x05, // params: u32 LE user id
});


// ============================================================================
// [区块 2] buildCommandFrame  ——  把 opcode + params 拼好后交给 frame.encode
// ============================================================================

export function buildCommandFrame(opcode, params) {
  // params 容错:既支持 Uint8Array、ArrayBuffer-like,也支持空。
  const p = params instanceof Uint8Array
    ? params
    : (params ? new Uint8Array(params) : new Uint8Array(0));

  const payload = new Uint8Array(1 + p.length);
  payload[0] = opcode & 0xFF;
  payload.set(p, 1);

  return encode(payload);
}


// ============================================================================
// [区块 3] 便捷构造函数  ——  上层只需 import 这些,不用碰 opcode 数字
// ============================================================================

export function powerOff()     { return buildCommandFrame(Op.POWER_OFF); }
export function startCapture() { return buildCommandFrame(Op.START_CAPTURE); }
export function stopCapture()  { return buildCommandFrame(Op.STOP_CAPTURE); }

export function syncRtc(epochMs) {
  // 8 字节 LE 写入 epoch (毫秒)
  const ab = new ArrayBuffer(8);
  new DataView(ab).setBigUint64(0, BigInt(epochMs), true);
  return buildCommandFrame(Op.SYNC_RTC, new Uint8Array(ab));
}

export function bindUser(userId) {
  // 4 字节 LE 用户 id  (>>> 0 强制转 u32 防负数)
  const ab = new ArrayBuffer(4);
  new DataView(ab).setUint32(0, userId >>> 0, true);
  return buildCommandFrame(Op.BIND_USER, new Uint8Array(ab));
}


// ============================================================================
// [区块 4] parseCommandResponse  ——  解析设备回的执行结果
// ============================================================================

export function parseCommandResponse(payload) {
  const u8 = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);

  const opcode = dv.getUint8(0);
  const result = dv.getUint8(1);                  // 0 = success, 非零 = 错误码
  const len    = dv.getUint16(2, true);

  return { opcode, result, len, payload: u8.subarray(4, 4 + len) };
}
