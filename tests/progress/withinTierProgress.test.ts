import { describe, expect, it } from "vitest";
import { withinTierProgress } from "../../src/progress/withinTierProgress";
import type { ExerciseStandards } from "../../src/domain/types";

const standards: ExerciseStandards = {
  novice: 1,
  beginner: 3,
  intermediate: 8,
  advanced: 12,
  elite: 20,
};

describe("withinTierProgress", () => {
  it("places best inside Intermediate with within-tier percent", () => {
    // intermediate=8, advanced=12 → best 10 → 50% through Intermediate
    const progress = withinTierProgress(10, standards);
    expect(progress.tier).toBe("intermediate");
    expect(progress.withinPercent).toBe(50);
    expect(progress.continuum).toBeCloseTo((2 + 0.5) / 4, 5);
  });

  it("is 100% at elite", () => {
    const progress = withinTierProgress(20, standards);
    expect(progress.tier).toBe("elite");
    expect(progress.withinPercent).toBe(100);
    expect(progress.continuum).toBe(1);
  });

  it("is 0% at the floor of a tier", () => {
    const progress = withinTierProgress(8, standards);
    expect(progress.tier).toBe("intermediate");
    expect(progress.withinPercent).toBe(0);
  });
});
