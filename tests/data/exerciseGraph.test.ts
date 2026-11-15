import { describe, expect, it } from "vitest";
import { EXERCISE_GRAPH, PLANNABLE_EXERCISES, isPlannable } from "../../src/data/exerciseGraph";
import { LIBRARY_CATALOGUE, LIBRARY_REDIRECTS } from "../../src/data/libraryCatalogue";
import { SEED_EXERCISES, SESSION_TEMPLATES } from "../../src/data/seed";
import { pickSlotExerciseForVariety } from "../../src/rules/consecutiveVariety";

const ORDER = { novice: 0, beginner: 1, intermediate: 2, advanced: 3, elite: 4 } as const;

describe("EXERCISE_GRAPH (planner graph)", () => {
  it("contains every seed move and the imported library", () => {
    for (const seed of SEED_EXERCISES) {
      expect(EXERCISE_GRAPH[seed.id]?.name).toBe(seed.name);
    }
    expect(PLANNABLE_EXERCISES.length).toBeGreaterThan(300);
  });

  it("folds imported duplicates of seed moves into the seed entry", () => {
    expect(LIBRARY_REDIRECTS.hf_83).toBe("nordic_curl");
    expect(LIBRARY_CATALOGUE.some((item) => item.id === "hf_83")).toBe(false);
    expect(EXERCISE_GRAPH.hf_83?.id).toBe("nordic_curl");
    const names = LIBRARY_CATALOGUE.map((item) => item.name.toLowerCase());
    expect(names.filter((name) => name === "dead hang")).toHaveLength(1);
  });

  it("only offers dosable work moves to the planner", () => {
    expect(PLANNABLE_EXERCISES.every(isPlannable)).toBe(true);
    expect(PLANNABLE_EXERCISES.some((item) => item.pattern === "mobility")).toBe(false);
  });

  it("swaps to a genuinely different move at the same or an easier level", () => {
    for (const template of SESSION_TEMPLATES) {
      const yesterday = template.slots.map((slot) => slot.exerciseId);
      const chosen = new Set<string>();
      for (const slot of template.slots) {
        const pick = pickSlotExerciseForVariety(slot, yesterday, chosen);
        chosen.add(pick.exerciseId);
        if (!pick.swapped) {
          continue;
        }
        const from = EXERCISE_GRAPH[slot.exerciseId];
        const to = EXERCISE_GRAPH[pick.exerciseId];
        expect(to.name.toLowerCase()).not.toBe(from.name.toLowerCase());
        expect(ORDER[to.difficulty!]).toBeLessThanOrEqual(ORDER[from.difficulty!]);
        expect(isPlannable(to)).toBe(true);
      }
    }
  });
});
