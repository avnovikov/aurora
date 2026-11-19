import { describe, expect, it } from "vitest";
import { buildWeakLinkBoard } from "../../src/progress/weakLinkBoard";
import type { Exercise, ExerciseMemory } from "../../src/domain/types";
import { emptyMemory } from "../../src/session/history";

const standards = {
  novice: 1,
  beginner: 3,
  intermediate: 8,
  advanced: 12,
  elite: 20,
};

function exercise(id: string, pattern: Exercise["pattern"]): Exercise {
  return {
    id,
    name: id,
    pattern,
    type: "dynamic",
    muscles: [],
    joints: [],
    standards,
  };
}

describe("buildWeakLinkBoard", () => {
  it("ranks moves below the cohort average when plan level is auto", () => {
    const graph = {
      strong: exercise("strong", "horizontal_pull"),
      weak: exercise("weak", "vertical_pull"),
    };
    const memories: Record<string, ExerciseMemory> = {
      strong: { ...emptyMemory("strong"), bestReps: 11, sessionsAtStandard: 1 },
      weak: { ...emptyMemory("weak"), bestReps: 8, sessionsAtStandard: 1 },
    };
    const model = buildWeakLinkBoard({ graph, memories, planLevel: "auto" });
    expect(model.cards[0]?.exerciseId).toBe("weak");
    expect(model.cards[0]?.deltaPercent).toBeLessThan(0);
    expect(model.cards.every((c) => c.exerciseId !== "strong")).toBe(true);
  });

  it("ranks by shortfall vs declared plan-level bar", () => {
    const graph = {
      near: exercise("near", "hinge"),
      far: exercise("far", "squat"),
      cleared: exercise("cleared", "calf"),
    };
    const memories: Record<string, ExerciseMemory> = {
      // Intermediate bar = 8. near at 6 → 75% of bar (−25).
      near: { ...emptyMemory("near"), bestReps: 6, sessionsAtStandard: 1 },
      // far at 2 → 25% of bar (−75) — worst.
      far: { ...emptyMemory("far"), bestReps: 2, sessionsAtStandard: 1 },
      // At/above intermediate — excluded.
      cleared: { ...emptyMemory("cleared"), bestReps: 10, sessionsAtStandard: 1 },
    };
    const model = buildWeakLinkBoard({
      graph,
      memories,
      planLevel: "intermediate",
    });
    expect(model.cards.map((c) => c.exerciseId)).toEqual(["far", "near"]);
    expect(model.cards[0]?.deltaPercent).toBe(-75);
    expect(model.cards[1]?.deltaPercent).toBe(-25);
    expect(model.cards[0]?.reason).toContain("vs Intermediate");
    expect(model.cards.every((c) => c.exerciseId !== "cleared")).toBe(true);
  });

  it("keeps at most three cards", () => {
    const graph: Record<string, Exercise> = {};
    const memories: Record<string, ExerciseMemory> = {};
    for (let i = 1; i <= 5; i += 1) {
      const id = `m${i}`;
      graph[id] = exercise(id, "core");
      // All below intermediate (8): bestReps 1..5
      memories[id] = { ...emptyMemory(id), bestReps: i, sessionsAtStandard: 1 };
    }
    const model = buildWeakLinkBoard({
      graph,
      memories,
      planLevel: "intermediate",
    });
    expect(model.cards).toHaveLength(3);
    // Worst % of Intermediate first: 1/8, 2/8, 3/8
    expect(model.cards.map((c) => c.exerciseId)).toEqual(["m1", "m2", "m3"]);
  });
});
