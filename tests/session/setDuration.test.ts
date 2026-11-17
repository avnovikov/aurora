import { describe, expect, it } from "vitest";
import { emptyMemory } from "../../src/session/history";
import {
  elapsedSetSeconds,
  FALLBACK_SLOW_SET_CUE_DELAY_SECONDS,
  shouldArmSlowSetCue,
  slowSetCueDelaySeconds,
  SLOW_SET_SECONDS,
} from "../../src/session/setDuration";

describe("elapsedSetSeconds", () => {
  it("floors whole seconds and never goes negative", () => {
    expect(elapsedSetSeconds(1000, 4500)).toBe(3);
    expect(elapsedSetSeconds(5000, 4000)).toBe(0);
  });
});

describe("shouldArmSlowSetCue", () => {
  it("arms only when duration is strictly over two minutes", () => {
    expect(shouldArmSlowSetCue(SLOW_SET_SECONDS)).toBe(false);
    expect(shouldArmSlowSetCue(SLOW_SET_SECONDS + 1)).toBe(true);
  });
});

describe("slowSetCueDelaySeconds", () => {
  it("uses half the average once enough samples exist", () => {
    const memory = {
      ...emptyMemory("bodyweight_squat"),
      avgSetDurationSeconds: 90,
      setDurationSampleCount: 2,
    };
    expect(slowSetCueDelaySeconds(memory)).toBe(45);
  });

  it("falls back before two samples", () => {
    const memory = {
      ...emptyMemory("bodyweight_squat"),
      avgSetDurationSeconds: 90,
      setDurationSampleCount: 1,
    };
    expect(slowSetCueDelaySeconds(memory)).toBe(FALLBACK_SLOW_SET_CUE_DELAY_SECONDS);
    expect(slowSetCueDelaySeconds(undefined)).toBe(FALLBACK_SLOW_SET_CUE_DELAY_SECONDS);
  });
});
