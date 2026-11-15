import { describe, expect, it } from "vitest";
import { cueSchedule } from "../../src/voice/restCue";

describe("cueSchedule", () => {
  it("says Get ready at five seconds instead of Five", () => {
    const events = cueSchedule(90, () => 0);
    const getReady = events.find((event) => event.kind === "get_ready");

    expect(getReady?.atSecondsLeft).toBe(5);
    expect(getReady?.text).toBe("Get ready...");
    expect(getReady?.assetKey).toBeTruthy();
    expect(events.map((event) => event.atSecondsLeft)).toEqual([
      5, 4, 3, 2, 1, 0,
    ]);
    expect(events.some((event) => event.lineId === "five")).toBe(false);
    expect(events.at(-1)?.kind).toBe("go");
  });

  it("skips Get ready when rest is shorter than five seconds", () => {
    const events = cueSchedule(4, () => 0);

    expect(events.some((event) => event.kind === "get_ready")).toBe(false);
    expect(events.map((event) => event.atSecondsLeft)).toEqual([4, 3, 2, 1, 0]);
  });

  it("stops the countdown for timed next exercises", () => {
    const events = cueSchedule(90, { timedNext: true, random: () => 0 });

    expect(events.map((event) => event.kind)).toEqual(["get_ready", "go"]);
    expect(events.map((event) => event.atSecondsLeft)).toEqual([5, 0]);
  });

  it("rejects negative or non-finite remaining time", () => {
    expect(() => cueSchedule(-1)).toThrow("remainingSeconds must be >= 0");
    expect(() => cueSchedule(Number.NaN)).toThrow("remainingSeconds must be >= 0");
  });
});
