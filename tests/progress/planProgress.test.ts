import { describe, expect, it } from "vitest";
import { EXERCISE_GRAPH } from "../../src/data/exerciseGraph";
import { SESSION_TEMPLATES } from "../../src/data/seed";
import type { SessionTemplate } from "../../src/domain/program";
import { emptyMemory } from "../../src/session/history";
import {
  buildPathPreview,
  buildPlanProgress,
} from "../../src/progress/planProgress";

describe("buildPlanProgress", () => {
  it("returns no cards when templates have no targets", () => {
    const bare: SessionTemplate = {
      ...SESSION_TEMPLATES[0]!,
      id: "tmpl_bare",
      targetExerciseIds: [],
    };
    const model = buildPlanProgress({
      templates: [bare],
      graph: EXERCISE_GRAPH,
      memories: {},
    });
    expect(model.cards).toEqual([]);
  });

  it("shows not_started cards for plan targets before training", () => {
    const model = buildPlanProgress({
      templates: SESSION_TEMPLATES.filter((t) => t.id === "tmpl_skill_hs"),
      graph: EXERCISE_GRAPH,
      memories: {},
    });
    expect(model.cards.length).toBeGreaterThan(0);
    const hs = model.cards.find((card) => card.targetId === "freestanding_hs");
    expect(hs?.phase).toBe("not_started");
    expect(hs?.status.reason).toMatch(/Not started/);
    expect(hs?.pathPreview.length).toBeGreaterThan(0);
    expect(hs?.templateNames).toContain("Skill");
  });

  it("switches to active once a chain step has training signal", () => {
    const memories = {
      wall_handstand: {
        ...emptyMemory("wall_handstand"),
        bestReps: 20,
        sessionsAtStandard: 1,
      },
    };
    const model = buildPlanProgress({
      templates: SESSION_TEMPLATES.filter((t) => t.id === "tmpl_skill_hs"),
      graph: EXERCISE_GRAPH,
      memories,
    });
    const hs = model.cards.find((card) => card.targetId === "freestanding_hs");
    expect(hs?.phase).toBe("active");
    expect(hs?.currentId).toBe("wall_handstand");
    expect(hs?.status.kind).not.toBe("no_history");
  });
});

describe("buildPlanProgress shared Now step", () => {
  const memories = {
    pullup: { ...emptyMemory("pullup"), bestReps: 6, skillTier: "intermediate" as const },
    bulgarian_split: { ...emptyMemory("bulgarian_split"), bestReps: 10, skillTier: "beginner" as const },
    pistol_squat: emptyMemory("pistol_squat"),
    hollow_hold: { ...emptyMemory("hollow_hold"), bestReps: 25, skillTier: "beginner" as const },
  };
  const model = buildPlanProgress({
    templates: SESSION_TEMPLATES,
    graph: EXERCISE_GRAPH,
    memories,
  });

  it("shows each exercise as Now under one target only", () => {
    const ownedNowIds = model.cards
      .filter((card) => card.nowShownUnder === undefined)
      .map((card) => card.currentId);
    expect(new Set(ownedNowIds).size).toBe(ownedNowIds.length);
  });

  it("points the later Pull-up card back to the Muscle-up card", () => {
    const muscleUp = model.cards.find((card) => card.targetId === "muscle_up");
    const pullup = model.cards.find((card) => card.targetId === "pullup");
    expect(muscleUp?.currentId).toBe("pullup");
    expect(muscleUp?.nowShownUnder).toBeUndefined();
    expect(pullup?.currentId).toBe("pullup");
    expect(pullup?.nowShownUnder).toBe(muscleUp?.targetName);
  });
});

describe("buildPathPreview", () => {
  it("keeps start, neighbours, and target", () => {
    const chain = [
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
    ];
    const graph = Object.fromEntries(
      chain.map((id) => [id, { id, name: id.toUpperCase() }]),
    );
    const preview = buildPathPreview(chain, graph as never, "c", null, "f");
    const ids = preview.map((step) => step.id);
    expect(ids).toContain("c");
    expect(ids).toContain("f");
    expect(preview.find((step) => step.id === "c")?.marker).toBe("start");
    expect(preview.find((step) => step.id === "f")?.marker).toBe("target");
  });
});
