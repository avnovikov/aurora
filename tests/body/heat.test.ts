import { describe, expect, it } from "vitest";
import { formatLoadScore, heatOpacity, MIN_HEAT_OPACITY } from "../../src/body/heat";

describe("heatOpacity", () => {
  it("is 0 for an untrained muscle", () => {
    expect(heatOpacity(0, 10)).toBe(0);
  });

  it("is 0 when nothing was trained at all", () => {
    expect(heatOpacity(0, 0)).toBe(0);
  });

  it("gives the hardest-worked group full opacity", () => {
    expect(heatOpacity(10, 10)).toBe(1);
  });

  it("keeps a tiny load visible at the floor and scales linearly above it", () => {
    expect(heatOpacity(0.0001, 10)).toBeGreaterThanOrEqual(MIN_HEAT_OPACITY);
    const half = heatOpacity(5, 10);
    expect(half).toBeCloseTo(MIN_HEAT_OPACITY + (1 - MIN_HEAT_OPACITY) / 2, 10);
  });

  it("clamps a score above the stated max", () => {
    expect(heatOpacity(12, 10)).toBe(1);
  });

  it("throws on non-finite input", () => {
    expect(() => heatOpacity(Number.NaN, 10)).toThrow(/finite/);
    expect(() => heatOpacity(1, Number.POSITIVE_INFINITY)).toThrow(/finite/);
  });
});

describe("formatLoadScore", () => {
  it.each([
    [4, "4"],
    [2.5, "2.5"],
    [0.75, "0.75"],
    [1.25, "1.25"],
  ])("formats %s as %s", (score, expected) => {
    expect(formatLoadScore(score)).toBe(expected);
  });
});
