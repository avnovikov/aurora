import { describe, expect, it } from "vitest";
import { cueSchedule } from "../../src/voice/restCue";

describe("cueSchedule", () => {
  it("adds mid-rest banter, Get ready at 10, and counts from five", () => {
    const events = cueSchedule(90, () => 0);
    const banter = events.find((event) => event.kind === "rest_banter");
    const getReady = events.find((event) => event.kind === "get_ready");

    expect(banter?.atSecondsLeft).toBe(45);
    expect(banter?.text).toBeTruthy();
    expect(getReady?.atSecondsLeft).toBe(10);
    expect(getReady?.text).toBe("Get ready...");
    expect(events.map((event) => event.atSecondsLeft)).toEqual([
      45, 10, 5, 4, 3, 2, 1, 0,
    ]);
    expect(events.find((event) => event.atSecondsLeft === 5)?.lineId).toBe(
      "five",
    );
    expect(events.at(-1)?.kind).toBe("go");
  });

  it("skips banter when rest is 30 seconds or less", () => {
    const events = cueSchedule(30, () => 0);

    expect(events.some((event) => event.kind === "rest_banter")).toBe(false);
    expect(events.map((event) => event.atSecondsLeft)).toEqual([
      10, 5, 4, 3, 2, 1, 0,
    ]);
  });

  it("adds banter at the first second past 30", () => {
    const events = cueSchedule(31, () => 0);
    const banter = events.find((event) => event.kind === "rest_banter");

    expect(banter?.atSecondsLeft).toBe(16);
  });

  it("skips Get ready when rest is shorter than ten seconds", () => {
    const events = cueSchedule(8, () => 0);

    expect(events.some((event) => event.kind === "get_ready")).toBe(false);
    expect(events.map((event) => event.atSecondsLeft)).toEqual([
      5, 4, 3, 2, 1, 0,
    ]);
  });

  it("truncates the count when rest is under five seconds", () => {
    const events = cueSchedule(3, () => 0);

    expect(events.some((event) => event.kind === "get_ready")).toBe(false);
    expect(events.map((event) => event.atSecondsLeft)).toEqual([3, 2, 1, 0]);
  });

  it("keeps banter and Get ready for timed next but skips the count", () => {
    const events = cueSchedule(90, { timedNext: true, random: () => 0 });

    expect(events.map((event) => event.kind)).toEqual([
      "rest_banter",
      "get_ready",
      "go",
    ]);
    expect(events.map((event) => event.atSecondsLeft)).toEqual([45, 10, 0]);
  });

  it("skips Get ready for short timed next rests", () => {
    const events = cueSchedule(9, { timedNext: true, random: () => 0 });

    expect(events.map((event) => event.kind)).toEqual(["go"]);
    expect(events.map((event) => event.atSecondsLeft)).toEqual([0]);
  });

  it("rejects negative or non-finite remaining time", () => {
    expect(() => cueSchedule(-1)).toThrow("remainingSeconds must be >= 0");
    expect(() => cueSchedule(Number.NaN)).toThrow(
      "remainingSeconds must be >= 0",
    );
  });
});
