import { describe, expect, it } from "vitest";
import { SKILL_TIERS } from "../../src/domain/skillTier";
import type { ExerciseMemory } from "../../src/domain/types";
import { buildFamilyLadderIndex } from "../../src/progress/familyLadderIndex";
import { declareSkillTier } from "../../src/session/history";
import {
  DEFAULT_WARMUP_LEVEL,
  highestKnownTier,
  warmupLevelFor,
  warmupLevelForTargets,
  warmupLevelFromTier,
} from "../../src/rules/warmupLevel";

function memory(exerciseId: string, over: Partial<ExerciseMemory> = {}): ExerciseMemory {
  return {
    exerciseId,
    sessionsAtStandard: 0,
    sessionsBelowFloor: 0,
    lastAddedLoadKg: 0,
    weakLinkSessionsRemaining: 0,
    ...over,
  };
}

const index = buildFamilyLadderIndex([
  { id: "split", name: "Bulgarian split squat" },
  { id: "pistol", name: "Pistol squat" },
  { id: "dead_hang", name: "Dead hang" },
  { id: "pull", name: "Pull-up" },
  { id: "wall_hs", name: "Wall handstand" },
  { id: "free_hs", name: "Freestanding handstand" },
]);
const graph = {};

describe("warmupLevelFromTier", () => {
  it("maps five skill tiers to three warm-up levels", () => {
    expect(SKILL_TIERS.map(warmupLevelFromTier)).toEqual([
      "beginner",
      "beginner",
      "intermediate",
      "advanced",
      "advanced",
    ]);
    expect(warmupLevelFromTier(undefined)).toBe("beginner");
    expect(DEFAULT_WARMUP_LEVEL).toBe("beginner");
  });
});

describe("warmupLevelFor", () => {
  it("warmupLevelForTargets is the call-site form of the same rule", () => {
    const memories = { pull: memory("pull", { skillTier: "elite" }) };
    expect(warmupLevelForTargets(["pull"], memories)).toBe(
      warmupLevelFor({ targetExerciseIds: ["pull"], memories }),
    );
  });

  it("is beginner when nothing is known about the target family", () => {
    expect(warmupLevelFor({ targetExerciseIds: ["pistol"], memories: {}, index, graph })).toBe("beginner");
    expect(
      warmupLevelFor({
        targetExerciseIds: ["pistol"],
        memories: { split: memory("split") },
        index,
        graph,
      }),
    ).toBe("beginner");
  });

  it("is beginner for a session without a ladder target (Mobility)", () => {
    expect(warmupLevelFor({ targetExerciseIds: [], memories: {}, index, graph })).toBe("beginner");
  });

  it("uses the highest known tier among the target family's moves", () => {
    const memories = {
      split: memory("split", { skillTier: "intermediate" }),
      pistol: memory("pistol", { declaredTier: "novice" }),
      pull: memory("pull", { skillTier: "elite" }),
    };
    expect(warmupLevelFor({ targetExerciseIds: ["pistol"], memories, index, graph })).toBe(
      "intermediate",
    );
    expect(warmupLevelFor({ targetExerciseIds: ["pull"], memories, index, graph })).toBe("advanced");
  });

  it("takes the lowest family level when a session has several targets", () => {
    const memories = {
      pull: memory("pull", { skillTier: "advanced" }),
      split: memory("split", { skillTier: "intermediate" }),
    };
    expect(
      warmupLevelFor({ targetExerciseIds: ["pull", "pistol"], memories, index, graph }),
    ).toBe("intermediate");
    expect(
      warmupLevelFor({ targetExerciseIds: ["pull", "pistol", "free_hs"], memories, index, graph }),
    ).toBe("beginner");
  });

  it("reads Library declares through the family cascade", () => {
    const { memories } = declareSkillTier({}, "pullup", "advanced");
    expect(warmupLevelFor({ targetExerciseIds: ["muscle_up"], memories })).toBe("advanced");
  });

  it("infers a tier from the best logged set when standards exist", () => {
    const memories = { pullup: memory("pullup", { bestReps: 12 }) };
    expect(highestKnownTier(["pullup"], memories)).not.toBe("novice");
    expect(highestKnownTier(["pullup"], {})).toBeUndefined();
  });
});
