import { describe, expect, it } from "vitest";
import { parseHeartRateMeasurement } from "../../src/pulse/hrParse";

function viewFrom(...bytes: number[]): DataView {
  return new DataView(Uint8Array.from(bytes).buffer);
}

describe("parseHeartRateMeasurement", () => {
  it("returns null for empty or truncated buffers", () => {
    expect(parseHeartRateMeasurement(viewFrom())).toBeNull();
    expect(parseHeartRateMeasurement(viewFrom(0x00))).toBeNull();
    expect(parseHeartRateMeasurement(viewFrom(0x01))).toBeNull();
  });

  it("reads uint8 heart rate when format flag is clear", () => {
    expect(parseHeartRateMeasurement(viewFrom(0x00, 72))).toBe(72);
    expect(parseHeartRateMeasurement(viewFrom(0x04, 88, 0x10, 0x00))).toBe(88);
  });

  it("reads little-endian uint16 heart rate when format flag is set", () => {
    expect(parseHeartRateMeasurement(viewFrom(0x01, 0x2c, 0x01))).toBe(300);
  });
});
