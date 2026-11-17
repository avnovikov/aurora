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
  it("ranks moves below the cohort average", () => {
    const graph = {
      strong: exercise("strong", "horizontal_pull"),
      weak: exercise("weak", "vertical_pull"),
    };
    const memories: Record<string, ExerciseMemory> = {
      strong: { ...emptyMemory("strong"), bestReps: 11, sessionsAtStandard: 1 },
      weak: { ...emptyMemory("weak"), bestReps: 8, sessionsAtStandard: 1 },
    };
    const model = buildWeakLinkBoard({ graph, memories });
    expect(model.cards[0]?.exerciseId).toBe("weak");
    expect(model.cards[0]?.deltaPercent).toBeLessThan(0);
    expect(model.cards.every((c) => c.exerciseId !== "strong")).toBe(true);
  });
});
