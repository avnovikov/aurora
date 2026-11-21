import { describe, expect, it } from "vitest";
import {
  formatSetLabel,
  stationSetProgress,
  warmupStationSetLabel,
} from "../../src/ui/sessionStationSet";
import type { WarmupStep } from "../../src/rules/warmupPlan";

function step(
  stationId: string,
  side?: WarmupStep["side"],
): Pick<WarmupStep, "stationId" | "side"> {
  return side ? { stationId, side } : { stationId };
}

describe("formatSetLabel", () => {
  it("formats Set X of Y", () => {
    expect(formatSetLabel(2, 3)).toBe("Set 2 of 3");
  });

  it("rejects impossible ranges", () => {
    expect(() => formatSetLabel(0, 2)).toThrow(/1 ≤ current ≤ total/);
    expect(() => formatSetLabel(3, 2)).toThrow(/1 ≤ current ≤ total/);
  });
});

describe("warmupStationSetLabel", () => {
  it("returns a label only for multi-set runs", () => {
    expect(warmupStationSetLabel([step("a")], 0)).toBeUndefined();
    expect(warmupStationSetLabel([step("h"), step("h")], 1)).toBe("Set 2 of 2");
  });
});

describe("stationSetProgress", () => {
  it("returns null for a single step of a station", () => {
    const steps = [step("a"), step("b")];
    expect(stationSetProgress(steps, 0)).toBeNull();
    expect(stationSetProgress(steps, 1)).toBeNull();
  });

  it("counts consecutive same-station rounds (no sides)", () => {
    const steps = [step("a"), step("hollow"), step("hollow"), step("b")];
    expect(stationSetProgress(steps, 1)).toEqual({ current: 1, total: 2 });
    expect(stationSetProgress(steps, 2)).toEqual({ current: 2, total: 2 });
  });

  it("treats left+right of one round as one set", () => {
    const steps = [
      step("plank", "left"),
      step("plank", "right"),
      step("plank", "left"),
      step("plank", "right"),
    ];
    expect(stationSetProgress(steps, 0)).toEqual({ current: 1, total: 2 });
    expect(stationSetProgress(steps, 1)).toEqual({ current: 1, total: 2 });
    expect(stationSetProgress(steps, 2)).toEqual({ current: 2, total: 2 });
    expect(stationSetProgress(steps, 3)).toEqual({ current: 2, total: 2 });
  });

  it("returns null for one round of left+right only", () => {
    const steps = [step("plank", "left"), step("plank", "right")];
    expect(stationSetProgress(steps, 0)).toBeNull();
    expect(stationSetProgress(steps, 1)).toBeNull();
  });

  it("returns null for an out-of-range index", () => {
    expect(stationSetProgress([step("a")], 3)).toBeNull();
  });
});
