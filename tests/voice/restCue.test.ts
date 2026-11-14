import { describe, expect, it } from "vitest";
import { cueSchedule } from "../../src/voice/restCue";

describe("cueSchedule", () => {
  it("includes Get ready when rest is at least ten seconds", () => {
    const events = cueSchedule(90, () => 0);
    const getReady = events.find((event) => event.kind === "get_ready");

    expect(getReady?.atSecondsLeft).toBe(10);
    expect(getReady?.kind).toBe("get_ready");
    expect(getReady?.text).toMatch(/mate|Get ready/i);
    expect(getReady?.assetKey).toBeTruthy();
    expect(events.at(-1)?.kind).toBe("go");
    expect(events.at(-1)?.text).toMatch(/mate|Go|pop/i);
  });

  it("skips Get ready when rest is shorter than ten seconds", () => {
    const events = cueSchedule(8, () => 0);

    expect(events.some((event) => event.kind === "get_ready")).toBe(false);
    expect(events.map((event) => event.atSecondsLeft)).toEqual([5, 4, 3, 2, 1, 0]);
  });

  it("rejects negative or non-finite remaining time", () => {
    expect(() => cueSchedule(-1)).toThrow("remainingSeconds must be >= 0");
    expect(() => cueSchedule(Number.NaN)).toThrow("remainingSeconds must be >= 0");
  });
});
