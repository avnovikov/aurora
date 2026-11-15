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
    const bpm = view.getUint16(1, true);
    return bpm > 0 ? bpm : null;
  }
  const bpm = view.getUint8(1);
  return bpm > 0 ? bpm : null;
}
