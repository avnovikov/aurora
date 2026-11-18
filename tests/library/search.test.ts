import { describe, expect, it } from "vitest";
import { LIBRARY_CATALOGUE } from "../../src/data/libraryCatalogue";
import { SEED_EXERCISES } from "../../src/data/seed";
import { areaOf } from "../../src/library/facets";
import { searchExercises } from "../../src/library/search";

describe("searchExercises", () => {
  it("filters the Core area", () => {
    const results = searchExercises(LIBRARY_CATALOGUE, { area: "core" });
    expect(results.length).toBeGreaterThan(SEED_EXERCISES.length / 2);
    expect(results.every((item) => areaOf(item) === "core")).toBe(true);
  });

  it("searches by name", () => {
    const results = searchExercises(LIBRARY_CATALOGUE, { text: "hollow" });
    expect(results.some((item) => item.id === "hollow_hold")).toBe(true);
  });

  it("includes HF catalogue entries", () => {
    const results = searchExercises(LIBRARY_CATALOGUE, { text: "wall push" });
    expect(results.some((item) => item.id === "hf_1")).toBe(true);
  });

  it("filters by catalogue difficulty level", () => {
    const results = searchExercises(LIBRARY_CATALOGUE, { level: "beginner" });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((item) => item.difficulty === "beginner")).toBe(true);
  });

  it("excludes exercises without a level when a level is selected", () => {
    const mixed: typeof LIBRARY_CATALOGUE = [
      {
        ...LIBRARY_CATALOGUE[0]!,
        id: "with_level",
        difficulty: "beginner",
      },
      {
        ...LIBRARY_CATALOGUE[0]!,
        id: "no_level",
        difficulty: undefined,
      },
    ];
    const results = searchExercises(mixed, { level: "beginner" });
    expect(results.map((item) => item.id)).toEqual(["with_level"]);
  });

  it("keeps every exercise when level is all", () => {
    const results = searchExercises(LIBRARY_CATALOGUE, { level: "all" });
    expect(results).toHaveLength(LIBRARY_CATALOGUE.length);
  });
});