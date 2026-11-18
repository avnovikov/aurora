import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EXERCISE_GRAPH } from "../../src/data/exerciseGraph";
import {
  addExerciseToPlanDay,
  generatePlanTowardExercise,
} from "../../src/plan/pathPlanActions";
import { loadPlanQueue, savePlanQueue } from "../../src/plan/queue";
import {
  resetTemplateOverridesForTests,
  resolveTemplate,
} from "../../src/plan/templates";

function firstExerciseWithPath() {
  const withPath = Object.values(EXERCISE_GRAPH).find(
    (item) => item.easierId || item.harderId,
  );
  if (!withPath) {
    throw new Error("Expected at least one chained exercise in the graph");
  }
  return withPath;
}

describe("path plan actions", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    });
    resetTemplateOverridesForTests();
    savePlanQueue({
      items: ["tmpl_legs", "tmpl_skill_hs", "tmpl_bars", "tmpl_abs"],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("adds a level-appropriate step into the chosen plan day", () => {
    const exercise = firstExerciseWithPath();
    const result = addExerciseToPlanDay({
      templateId: "tmpl_skill_hs",
      exercise,
      memory: { skillTier: "beginner" },
      random: () => 0,
    });
    const template = resolveTemplate("tmpl_skill_hs");
    const slot = template.slots.find((item) => item.id === result.slotId);
    expect(slot?.exerciseId).toBe(result.exerciseId);
    expect(result.message).toMatch(/Added/);
  });

  it("generates a whole plan toward the skill and queues it for tomorrow", () => {
    const exercise = firstExerciseWithPath();
    const result = generatePlanTowardExercise({
      exercise,
      queue: loadPlanQueue(),
      memory: { declaredTier: "beginner" },
      random: () => 0,
    });
    expect(result.queue.items[1]).toBe(result.templateId);
    expect(resolveTemplate(result.templateId).targetExerciseIds).toContain(
      exercise.id,
    );
    expect(result.message).toMatch(/Generated/);
  });
});
