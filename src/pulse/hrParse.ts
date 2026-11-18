/** Reject absurd BLE values (uint16 can be tens of thousands). */
const MAX_PLAUSIBLE_BPM = 250;

/**
 * Parse Bluetooth Heart Rate Measurement (characteristic 0x2A37).
 * Flags bit0: 0 = uint8 BPM at offset 1; 1 = uint16 LE BPM at offset 1.
 */
export function parseHeartRateMeasurement(view: DataView): number | null {
  if (view.byteLength < 2) {
    return null;
  }
  const flags = view.getUint8(0);
  const usesUint16 = (flags & 0x01) !== 0;
  if (usesUint16) {
    if (view.byteLength < 3) {
      return null;
    }
    return saneBpm(view.getUint16(1, true));
  }
  return saneBpm(view.getUint8(1));
}

function saneBpm(bpm: number): number | null {
  if (!Number.isFinite(bpm) || bpm <= 0 || bpm > MAX_PLAUSIBLE_BPM) {
    return null;
  }
  return bpm;
}
