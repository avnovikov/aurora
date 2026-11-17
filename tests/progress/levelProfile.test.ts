import { describe, expect, it } from "vitest";
import { buildLevelProfile } from "../../src/progress/levelProfile";
import type { Exercise, ExerciseMemory } from "../../src/domain/types";
import { emptyMemory } from "../../src/session/history";

const standards = {
  novice: 1,
  beginner: 3,
  intermediate: 8,
  advanced: 12,
  elite: 20,
};

function exercise(
  id: string,
  pattern: Exercise["pattern"],
): Exercise {
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

describe("buildLevelProfile", () => {
  it("aggregates per pattern with within-tier percent", () => {
    const graph = {
      row_a: exercise("row_a", "horizontal_pull"),
      row_b: exercise("row_b", "horizontal_pull"),
      pull: exercise("pull", "vertical_pull"),
    };
    const memories: Record<string, ExerciseMemory> = {
      row_a: { ...emptyMemory("row_a"), bestReps: 10, sessionsAtStandard: 1 },
      row_b: { ...emptyMemory("row_b"), bestReps: 10, sessionsAtStandard: 1 },
      pull: { ...emptyMemory("pull"), bestReps: 8, sessionsAtStandard: 1 },
    };
    const model = buildLevelProfile({ graph, memories });
    expect(model.rows).toHaveLength(2);
    const horizontal = model.rows.find((r) => r.pattern === "horizontal_pull");
    expect(horizontal?.tier).toBe("intermediate");
    expect(horizontal?.withinPercent).toBe(50);
    const vertical = model.rows.find((r) => r.pattern === "vertical_pull");
    expect(vertical?.tier).toBe("intermediate");
    expect(vertical?.withinPercent).toBe(0);
  });

  it("returns no rows without trained standards", () => {
    const model = buildLevelProfile({ graph: {}, memories: {} });
    expect(model.rows).toEqual([]);
  });
});
