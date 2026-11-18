import { describe, expect, it } from "vitest";
import { SEED_GRAPH } from "../../src/data/seed";
import {
  declareSkillTier,
  emptyMemory,
  recordBestReps,
} from "../../src/session/history";
import { indexOf } from "../helpers/ladderIndex";

describe("skill memory", () => {
  it("stores a declared tier from Library", () => {
    const next = declareSkillTier({}, "pullup", "intermediate");
    expect(next.memories.pullup?.declaredTier).toBe("intermediate");
    expect(next.memories.pullup?.skillTier).toBe("intermediate");
  });

  it("raises bestReps and skillTier from a logged set", () => {
    const start = { pullup: emptyMemory("pullup") };
    const next = recordBestReps(start, "pullup", 12, SEED_GRAPH.pullup);
    expect(next.pullup?.bestReps).toBe(12);
    expect(next.pullup?.skillTier).toBe("intermediate");
  });
});

describe("declare (#112)", () => {
  const NOW = new Date("2026-11-17T12:00:00Z");
  const index = indexOf({ f: [["top", 4], ["next", 3], ["mid", 2]] });

  it("records the pick with a time and does not promote the family from one pick", () => {
    const { memories, inferredCount } = declareSkillTier({}, "top", "advanced", NOW, index);
    expect(memories.top).toMatchObject({
      declaredTier: "advanced",
      declaredAt: NOW.toISOString(),
      skillTier: "advanced",
    });
    expect(inferredCount).toBe(0);
    expect(memories.mid).toBeUndefined();
  });

  it("a second pick in the family infers the easier move one tier below", () => {
    const first = declareSkillTier({}, "top", "advanced", NOW, index).memories;
    const { memories, inferredCount } = declareSkillTier(first, "next", "advanced", NOW, index);
    expect(inferredCount).toBe(1);
    expect(memories.mid?.inferred?.tier).toBe("intermediate");
  });

  it("logged reps write loggedTier and lastSessionAt (#112)", () => {
    const now = new Date("2026-11-17T12:00:00Z");
    const next = recordBestReps({}, "pullup", 12, SEED_GRAPH.pullup, now);
    expect(next.pullup).toMatchObject({
      bestReps: 12,
      loggedTier: "intermediate",
      skillTier: "intermediate",
      lastSessionAt: now.toISOString(),
    });
  });
});
