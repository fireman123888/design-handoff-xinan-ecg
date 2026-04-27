// BLE UUIDs — see README §"BLE Protocol".
// All share the suffix "-6FCC-4D0D-9D1E-AD7DCE7AB472".
// uni-app's BLE APIs require uppercase, fully-formed UUIDs.

const SUFFIX = '-6FCC-4D0D-9D1E-AD7DCE7AB472';
const u = (prefix) => `${prefix.toUpperCase()}${SUFFIX}`;

export const ECG_DATA_SERVICE = u('5D7F9E51');
export const ECG_DATA_CHAR    = u('5D7F9E52'); // Notify, waveform 4 fps
export const STATUS_CHAR      = u('5D7F9E53'); // Notify+Read, 1 Hz
export const IMU_CHAR         = u('5D7F9E54'); // Notify, ~2 Hz

export const ECG_CTRL_SERVICE = u('5D7F9E60');
export const CMD_WRITE_CHAR   = u('5D7F9E61'); // Write
export const CMD_RSP_CHAR     = u('5D7F9E62'); // Notify
