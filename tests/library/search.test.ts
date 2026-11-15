import { describe, expect, it } from "vitest";
import { LIBRARY_CATALOGUE } from "../../src/data/libraryCatalogue";
import { SEED_EXERCISES } from "../../src/data/seed";
import { searchExercises } from "../../src/library/search";

describe("searchExercises", () => {
  it("filters the Core area", () => {
    const results = searchExercises(LIBRARY_CATALOGUE, { region: "core" });
    expect(results.length).toBeGreaterThan(SEED_EXERCISES.length / 2);
    expect(results.every((item) => item.regions.includes("core"))).toBe(true);
  });

  it("searches by name", () => {
    const results = searchExercises(LIBRARY_CATALOGUE, { text: "hollow" });
    expect(results.some((item) => item.id === "hollow_hold")).toBe(true);
  });

  it("includes HF catalogue entries", () => {
    const results = searchExercises(LIBRARY_CATALOGUE, { text: "wall push" });
    expect(results.some((item) => item.id === "hf_1")).toBe(true);
  });
});