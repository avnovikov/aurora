import { describe, expect, it } from "vitest";
import { EXERCISE_GRAPH } from "../../src/data/exerciseGraph";
import {
  WEIGHTED_COUSIN_BY_UNWEIGHTED_ID,
  WEIGHTED_COUSIN_WGER_NAMES,
} from "../../src/data/weightedCousins";

describe("weighted cousins (#251)", () => {
  it("links every curated unweighted id to an imported twin with dumbbell gear", () => {
    for (const [fromId, twinName] of Object.entries(WEIGHTED_COUSIN_BY_UNWEIGHTED_ID)) {
      const from = EXERCISE_GRAPH[fromId];
      expect(from, fromId).toBeDefined();
      expect(from!.weightedId, fromId).toBeTruthy();
      const twin = EXERCISE_GRAPH[from!.weightedId!];
      expect(twin, twinName).toBeDefined();
      expect(twin!.name).toBe(twinName);
      expect(twin!.requires ?? []).toContain("dumbbell");
    }
  });

  it("links all four glute / hip-thrust unweighted moves", () => {
    expect(EXERCISE_GRAPH.glute_bridge?.weightedId).toBe("wger_1642");
    expect(EXERCISE_GRAPH.hf_87?.weightedId).toBe("wger_1642");
    expect(EXERCISE_GRAPH.fedb_single_leg_glute_bridge?.weightedId).toBe("wger_1234");
    expect(EXERCISE_GRAPH.wger_1913?.weightedId).toBe("wger_1234");
  });

  it("lets Weighted Step-ups use kettlebell as an alternative to dumbbell", () => {
    const step = EXERCISE_GRAPH.wger_722;
    expect(step?.requires).toEqual(["dumbbell"]);
    expect(step?.orRequires).toEqual([["kettlebell"]]);
  });

  it("keeps the allowlist equal to curated twin names", () => {
    expect(WEIGHTED_COUSIN_WGER_NAMES.size).toBe(
      new Set(Object.values(WEIGHTED_COUSIN_BY_UNWEIGHTED_ID)).size,
    );
  });
});
