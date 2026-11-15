import { describe, expect, it } from "vitest";
import {
  inferTierFromBest,
  nextSkillTier,
  workingRepsForTier,
} from "../../src/domain/skillTier";
import { SEED_GRAPH } from "../../src/data/seed";

describe("skill tiers", () => {
  it("infers the highest met pull-up standard", () => {
    const standards = SEED_GRAPH.pullup.standards!;
    expect(inferTierFromBest(1, standards)).toBe("novice");
    expect(inferTierFromBest(5, standards)).toBe("beginner");
    expect(inferTierFromBest(12, standards)).toBe("intermediate");
    expect(inferTierFromBest(20, standards)).toBe("advanced");
    expect(inferTierFromBest(30, standards)).toBe("elite");
  });

  it("leaves RIR when prescribing working reps", () => {
    const standards = SEED_GRAPH.pullup.standards!;
    expect(workingRepsForTier(standards, "intermediate", 2)).toBe(10);
  });

  it("walks to the next tier", () => {
    expect(nextSkillTier("beginner")).toBe("intermediate");
    expect(nextSkillTier("elite")).toBeNull();
  });
});
