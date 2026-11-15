import { describe, expect, it } from "vitest";
import {
  formatClock,
  sessionClockSnapshot,
} from "../../src/session/sessionClock";

describe("sessionClock", () => {
  it("formats mm:ss with zero-padded seconds", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(3600)).toBe("60:00");
  });

  it("reports elapsed and remaining from a planned total", () => {
    const start = 1_000_000;
    const snap = sessionClockSnapshot(start, 600, start + 90_000);
    expect(snap.elapsedSeconds).toBe(90);
    expect(snap.remainingSeconds).toBe(510);
    expect(snap.label).toBe("Elapsed 1:30 · left 8:30");
  });

  it("clamps remaining at zero when over the estimate", () => {
    const start = 1_000_000;
    const snap = sessionClockSnapshot(start, 60, start + 120_000);
    expect(snap.elapsedSeconds).toBe(120);
    expect(snap.remainingSeconds).toBe(0);
    expect(snap.label).toBe("Elapsed 2:00 · left 0:00");
  });
});
