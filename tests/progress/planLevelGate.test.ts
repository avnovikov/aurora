import { describe, expect, it } from "vitest";
import type { SessionTemplate, TemplateSlot } from "../../src/domain/program";
import type { ExerciseMemory, ExerciseStandards, SkillTier } from "../../src/domain/types";
import { emptyMemory } from "../../src/progress/levelEvidence";
import {
  evaluatePlanLevelGate,
  meetsRaiseThreshold,
  PLAN_LEVEL_RAISE_PASSED,
  PLAN_LEVEL_RAISE_TOTAL,
} from "../../src/progress/planLevelGate";

const STANDARDS: ExerciseStandards = {
  novice: 1,
  beginner: 5,
  intermediate: 10,
  advanced: 15,
  elite: 20,
};

function slot(id: string, exerciseId: string, pinned = false): TemplateSlot {
  return {
    id,
    label: id,
    exerciseId,
    pattern: "squat",
    dose: { sets: 3, reps: 8, targetRir: 2, addedLoadKg: 0 },
    restSeconds: 60,
    pinned,
  };
}

function day(id: string, slots: TemplateSlot[]): SessionTemplate {
  return {
    id,
    name: id,
    focus: "legs",
    targetExerciseIds: [],
    warmupByLevel: { beginner: [], intermediate: [], advanced: [] },
    cooldownStationIds: [],
    slots,
    repeat: false,
  };
}

function mem(
  exerciseId: string,
  patch: Partial<ExerciseMemory> = {},
): ExerciseMemory {
  return { ...emptyMemory(exerciseId), ...patch };
}

function evaluate(
  days: SessionTemplate[],
  memories: Record<string, ExerciseMemory>,
  currentTier: SkillTier = "intermediate",
) {
  return evaluatePlanLevelGate({
    days,
    memories,
    currentTier,
    standardsFor: (id) => (id.startsWith("skip_") ? null : STANDARDS),
  });
}

describe("evaluatePlanLevelGate", () => {
  it("exposes the 80% raise threshold as 4/5", () => {
    expect(PLAN_LEVEL_RAISE_PASSED).toBe(4);
    expect(PLAN_LEVEL_RAISE_TOTAL).toBe(5);
    expect(meetsRaiseThreshold(4, 5)).toBe(true);
    expect(meetsRaiseThreshold(3, 5)).toBe(false);
  });

  it("does not raise with fewer than 3 plan days", () => {
    const days = [
      day("d1", [slot("s1", "a")]),
      day("d2", [slot("s2", "b")]),
    ];
    const memories = {
      a: mem("a", { bestReps: 10, loggedTier: "intermediate" }),
      b: mem("b", { bestReps: 10, loggedTier: "intermediate" }),
    };
    const result = evaluate(days, memories);
    expect(result.shouldRaise).toBe(false);
    expect(result.nextTier).toBe("advanced");
  });

  it("counts unlogged working slots as failures in the denominator", () => {
    // 4 slots: 3 at boundary, 1 unlogged → 75% < 80%
    const days = [
      day("d1", [slot("s1", "a"), slot("s2", "b")]),
      day("d2", [slot("s3", "c")]),
      day("d3", [slot("s4", "d")]),
    ];
    const atBoundary = { bestReps: 10, loggedTier: "intermediate" as const };
    const memories = {
      a: mem("a", atBoundary),
      b: mem("b", atBoundary),
      c: mem("c", atBoundary),
      // d missing → unlogged fail
    };
    const result = evaluate(days, memories);
    expect(result).toMatchObject({ passed: 3, total: 4, shouldRaise: false });
  });

  it("raises at 80% when slots are at the current boundary", () => {
    // 5 slots, 4 pass → 80%
    const days = [
      day("d1", [slot("s1", "a"), slot("s2", "b")]),
      day("d2", [slot("s3", "c"), slot("s4", "d")]),
      day("d3", [slot("s5", "e")]),
    ];
    const atBoundary = { bestReps: 10, loggedTier: "intermediate" as const };
    const memories = {
      a: mem("a", atBoundary),
      b: mem("b", atBoundary),
      c: mem("c", atBoundary),
      d: mem("d", atBoundary),
      e: mem("e"), // fail
    };
    const result = evaluate(days, memories);
    expect(result).toMatchObject({
      passed: 4,
      total: 5,
      shouldRaise: true,
      nextTier: "advanced",
    });
  });

  it("treats logged next-tier performance as a pass", () => {
    const days = [
      day("d1", [slot("s1", "a")]),
      day("d2", [slot("s2", "b")]),
      day("d3", [slot("s3", "c")]),
    ];
    const memories = {
      a: mem("a", { bestReps: 15, loggedTier: "advanced" }),
      b: mem("b", { bestReps: 15, loggedTier: "advanced" }),
      c: mem("c", { bestReps: 15, loggedTier: "advanced" }),
    };
    expect(evaluate(days, memories).shouldRaise).toBe(true);
  });

  it("ignores declared and planTier for the gate", () => {
    const days = [
      day("d1", [slot("s1", "a")]),
      day("d2", [slot("s2", "b")]),
      day("d3", [slot("s3", "c")]),
    ];
    const memories = {
      a: mem("a", { declaredTier: "advanced", planTier: "advanced" }),
      b: mem("b", { declaredTier: "advanced", planTier: "advanced" }),
      c: mem("c", { declaredTier: "advanced", planTier: "advanced" }),
    };
    const result = evaluate(days, memories);
    expect(result).toMatchObject({ passed: 0, total: 3, shouldRaise: false });
  });

  it("skips pinned slots and exercises without standards", () => {
    const days = [
      day("d1", [slot("s1", "a"), slot("pinned", "b", true)]),
      day("d2", [slot("s2", "c")]),
      day("d3", [slot("s3", "skip_x")]),
    ];
    const memories = {
      a: mem("a", { bestReps: 10, loggedTier: "intermediate" }),
      b: mem("b"),
      c: mem("c", { bestReps: 10, loggedTier: "intermediate" }),
      skip_x: mem("skip_x"),
    };
    const result = evaluate(days, memories);
    expect(result).toMatchObject({ passed: 2, total: 2, shouldRaise: true });
  });

  it("does not raise further from elite", () => {
    const days = [
      day("d1", [slot("s1", "a")]),
      day("d2", [slot("s2", "b")]),
      day("d3", [slot("s3", "c")]),
    ];
    const memories = {
      a: mem("a", { bestReps: 20, loggedTier: "elite" }),
      b: mem("b", { bestReps: 20, loggedTier: "elite" }),
      c: mem("c", { bestReps: 20, loggedTier: "elite" }),
    };
    const result = evaluate(days, memories, "elite");
    expect(result).toMatchObject({ shouldRaise: false, nextTier: null });
  });
});
