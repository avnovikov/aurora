import { describe, expect, it } from "vitest";
import type { SessionTemplate } from "../../src/domain/program";
import type { SkillTier } from "../../src/domain/types";
import {
  chooseTemplateForExercise,
  defaultPlanDayIndex,
  hasProgressionPath,
  insertQueueItemAt,
  listUpcomingPlanDays,
  pickBestSlotId,
  pickLevelAppropriateStep,
  placeTemplateAt,
  type PlacementGraph,
} from "../../src/plan/pathPlacement";

function chainNode(
  id: string,
  difficulty: SkillTier,
  links: { easierId?: string; harderId?: string },
) {
  return {
    id,
    name: id,
    pattern: "skill" as const,
    type: "reps" as const,
    muscles: [],
    joints: [],
    regions: ["skill"],
    cues: [],
    difficulty,
    ...links,
  };
}

const graph = {
  easy: chainNode("easy", "novice", { harderId: "mid" }),
  mid: chainNode("mid", "beginner", { easierId: "easy", harderId: "hard" }),
  hard: chainNode("hard", "advanced", { easierId: "mid" }),
} as unknown as PlacementGraph;

describe("hasProgressionPath", () => {
  it("is true when easier or harder exists", () => {
    expect(hasProgressionPath({ harderId: "x" })).toBe(true);
    expect(hasProgressionPath({ easierId: "x" })).toBe(true);
    expect(hasProgressionPath({})).toBe(false);
  });
});

describe("pickLevelAppropriateStep", () => {
  it("picks the chain step matching athlete tier", () => {
    expect(pickLevelAppropriateStep("hard", graph, "beginner")).toBe("mid");
  });

  it("falls back to closest tier on the chain", () => {
    expect(pickLevelAppropriateStep("hard", graph, "intermediate")).toBe("mid");
  });
});

describe("pickBestSlotId", () => {
  const slots = [
    {
      id: "a",
      label: "A",
      exerciseId: "easy",
      pattern: "hinge" as const,
      dose: { sets: 3, reps: 8, addedLoadKg: 0 },
      restSeconds: 60,
      pinned: false,
    },
    {
      id: "b",
      label: "B",
      exerciseId: "mid",
      pattern: "skill" as const,
      dose: { sets: 3, reps: 8, addedLoadKg: 0 },
      restSeconds: 60,
      pinned: false,
    },
  ];

  it("prefers a matching pattern slot", () => {
    expect(pickBestSlotId(slots, { pattern: "skill" }, () => 0)).toBe("b");
  });

  it("picks at random when no pattern matches", () => {
    expect(pickBestSlotId(slots, { pattern: "vertical_pull" }, () => 0.9)).toBe(
      "b",
    );
  });
});

describe("chooseTemplateForExercise", () => {
  const templates = [
    { id: "tmpl_legs", name: "Legs", focus: "legs" },
    { id: "tmpl_skill_hs", name: "Skill", focus: "skill" },
  ] as SessionTemplate[];

  it("prefers Skill for skill-pattern moves", () => {
    expect(
      chooseTemplateForExercise(templates, {
        pattern: "skill",
        regions: ["skill"],
      }).id,
    ).toBe("tmpl_skill_hs");
  });
});

describe("queue placement", () => {
  it("defaults to tomorrow when more than one day exists", () => {
    expect(defaultPlanDayIndex(3)).toBe(1);
    expect(defaultPlanDayIndex(1)).toBe(0);
  });

  it("inserts and places templates at an index", () => {
    const queue = { items: ["a", "b", "c"] };
    expect(insertQueueItemAt(queue, 1, "x").items).toEqual(["a", "x", "b", "c"]);
    expect(placeTemplateAt(queue, "c", 1).items).toEqual(["a", "c", "b"]);
    expect(placeTemplateAt(queue, "x", 1).items).toEqual(["a", "x", "b", "c"]);
  });

  it("marks tomorrow as the default upcoming day", () => {
    const days = listUpcomingPlanDays(
      { items: ["tmpl_legs", "tmpl_skill_hs", "tmpl_bars"] },
      (id) => id,
    );
    expect(days[1]?.isDefault).toBe(true);
    expect(days[0]?.isDefault).toBe(false);
  });
});
