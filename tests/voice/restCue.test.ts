import { describe, expect, it } from "vitest";
import { cueSchedule } from "../../src/voice/restCue";

describe("cueSchedule", () => {
  it("includes Get ready when rest is at least ten seconds", () => {
    const events = cueSchedule(90);
    const getReady = events.find((event) => event.kind === "get_ready");

    expect(getReady).toEqual({
      atSecondsLeft: 10,
      kind: "get_ready",
      text: "Get ready",
    });
    expect(events.at(-1)).toEqual({
      atSecondsLeft: 0,
      kind: "go",
      text: "Go",
    });
  });

  it("skips Get ready when rest is shorter than ten seconds", () => {
    const events = cueSchedule(8);

    expect(events.some((event) => event.kind === "get_ready")).toBe(false);
    expect(events.map((event) => event.atSecondsLeft)).toEqual([5, 4, 3, 2, 1, 0]);
  });

  it("rejects negative or non-finite remaining time", () => {
    expect(() => cueSchedule(-1)).toThrow("remainingSeconds must be >= 0");
    expect(() => cueSchedule(Number.NaN)).toThrow("remainingSeconds must be >= 0");
  });
});