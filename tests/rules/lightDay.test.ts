import { describe, expect, it } from "vitest";
import { applyLightDayDose, isLightDay } from "../../src/rules/lightDay";

describe("isLightDay", () => {
  it("is true for poor sleep only", () => {
    expect(isLightDay({ painJoints: [], sleepQuality: "poor" })).toBe(true);
    expect(isLightDay({ painJoints: [], sleepQuality: "fair" })).toBe(false);
    expect(isLightDay({ painJoints: [] })).toBe(false);
  });

  it("is true when resting HR is elevated on two mornings", () => {
    expect(
      isLightDay({
        painJoints: [],
        restingHrBpm: 62,
        restingHrMedian14d: 55,
        highHrMorningCount: 2,
      }),
    ).toBe(true);
  });
});

describe("applyLightDayDose", () => {
  it("cuts sets to about 60% with a floor of one and raises RIR", () => {
    expect(
      applyLightDayDose({ sets: 4, reps: 8, targetRir: 2, addedLoadKg: 0 }),
    ).toEqual({ sets: 2, reps: 8, targetRir: 3, addedLoadKg: 0 });
  });
});
