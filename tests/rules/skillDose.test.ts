import { describe, expect, it } from "vitest";
import { SEED_GRAPH } from "../../src/data/seed";
import {
  applySkillDose,
  effectiveSkillTier,
  shouldAdvanceProgression,
} from "../../src/rules/skillDose";
import type { ExerciseMemory } from "../../src/domain/types";

function memory(partial: Partial<ExerciseMemory>): ExerciseMemory {
  return {
    exerciseId: "pullup",
    sessionsAtStandard: 0,
    sessionsBelowFloor: 0,
    lastAddedLoadKg: 0,
    weakLinkSessionsRemaining: 0,
    ...partial,
  };
}

describe("skillDose", () => {
  it("scales pull-up dose to the declared tier", () => {
    const result = applySkillDose(
      { sets: 4, reps: 5, targetRir: 2, addedLoadKg: 0 },
      SEED_GRAPH.pullup,
      memory({ declaredTier: "intermediate" }),
    );
    expect(result.tier).toBe("intermediate");
    expect(result.dose.reps).toBe(8);
    expect(result.applied).toBe(true);
  });

  it("promotes tier from a strong best set", () => {
    const tier = effectiveSkillTier(
      memory({ bestReps: 20, declaredTier: "beginner" }),
      SEED_GRAPH.pullup,
    );
    expect(tier).toBe("advanced");
  });

  it("advances progression immediately for advanced athletes", () => {
    expect(
      shouldAdvanceProgression(
        SEED_GRAPH.pullup,
        memory({ declaredTier: "advanced" }),
      ),
    ).toBe(true);
  });

  it("does not advance a novice with no history", () => {
    expect(
      shouldAdvanceProgression(
        SEED_GRAPH.pullup,
        memory({ declaredTier: "novice" }),
      ),
    ).toBe(false);
  });

  it("clamps tier-standard reps into the Library prescription band", () => {
    const capped = {
      ...SEED_GRAPH.pullup,
      prescription: {
        effort: "reps" as const,
        rounds: 1,
        amountMin: 3,
        amountMax: 6,
        scope: "total" as const,
      },
    };
    const result = applySkillDose(
      { sets: 4, reps: 5, targetRir: 2, addedLoadKg: 0 },
      capped,
      memory({ declaredTier: "intermediate" }),
    );
    // Intermediate pull-up working reps would be 8; clamp to max 6.
    expect(result.dose.reps).toBe(6);
  });
});
