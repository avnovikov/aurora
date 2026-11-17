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

  it("reports wall-clock elapsed and the given theoretical remaining", () => {
    const start = 1_000_000;
    const snap = sessionClockSnapshot(start, start + 90_000, 510);
    expect(snap.elapsedSeconds).toBe(90);
    expect(snap.remainingSeconds).toBe(510);
    expect(snap.label).toBe("Elapsed 1:30 · left 8:30");
  });

  it("keeps theoretical remaining even when wall-clock is ahead of the plan", () => {
    const start = 1_000_000;
    const snap = sessionClockSnapshot(start, start + 120_000, 45);
    expect(snap.elapsedSeconds).toBe(120);
    expect(snap.remainingSeconds).toBe(45);
    expect(snap.label).toBe("Elapsed 2:00 · left 0:45");
  });

  it("clamps negative remaining at zero", () => {
    const start = 1_000_000;
    const snap = sessionClockSnapshot(start, start + 1_000, -3);
    expect(snap.remainingSeconds).toBe(0);
  });
});
