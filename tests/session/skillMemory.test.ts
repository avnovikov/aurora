import { describe, expect, it } from "vitest";
import { SEED_GRAPH } from "../../src/data/seed";
import {
  declareSkillTier,
  emptyMemory,
  recordBestReps,
} from "../../src/session/history";

describe("skill memory", () => {
  it("stores a declared tier from Library", () => {
    const next = declareSkillTier({}, "pullup", "intermediate");
    expect(next.pullup?.declaredTier).toBe("intermediate");
    expect(next.pullup?.skillTier).toBe("intermediate");
  });

  it("raises bestReps and skillTier from a logged set", () => {
    const start = { pullup: emptyMemory("pullup") };
    const next = recordBestReps(start, "pullup", 12, SEED_GRAPH.pullup);
    expect(next.pullup?.bestReps).toBe(12);
    expect(next.pullup?.skillTier).toBe("intermediate");
  });
});
