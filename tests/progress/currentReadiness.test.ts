import { describe, expect, it } from "vitest";
import { buildCurrentReadiness } from "../../src/progress/currentReadiness";
import type { SessionTemplate } from "../../src/domain/program";
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

describe("buildCurrentReadiness", () => {
  it("includes explicit plan targets", () => {
    const graph = {
      pull_up: exercise("pull_up", "vertical_pull"),
      australian_row: exercise("australian_row", "horizontal_pull"),
    };
    graph.pull_up = {
      ...graph.pull_up!,
      easierId: "australian_row",
    };
    graph.australian_row = {
      ...graph.australian_row!,
      harderId: "pull_up",
    };
    const templates = [
      {
        id: "t1",
        name: "Strength",
        focus: "strength",
        targetExerciseIds: ["pull_up"],
        slots: [{ id: "s1", exerciseId: "australian_row" }],
      },
    ] as unknown as SessionTemplate[];
    const memories: Record<string, ExerciseMemory> = {
      australian_row: {
        ...emptyMemory("australian_row"),
        bestReps: 10,
        sessionsAtStandard: 1,
      },
    };
    const model = buildCurrentReadiness({ templates, graph, memories });
    expect(model.rows.some((r) => r.kind === "explicit")).toBe(true);
    expect(model.rows[0]?.dosePercent).toBe(50);
  });
});
