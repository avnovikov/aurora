import { describe, expect, it } from "vitest";
import { SEED_EXERCISES } from "../../src/data/seed";
import { searchExercises } from "../../src/library/search";

describe("searchExercises", () => {
  it("filters the Core area", () => {
    const results = searchExercises(SEED_EXERCISES, { region: "core" });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((item) => item.regions.includes("core"))).toBe(true);
  });

  it("searches by name", () => {
    const results = searchExercises(SEED_EXERCISES, { text: "hollow" });
    expect(results.some((item) => item.id === "hollow_hold")).toBe(true);
  });
});
