import { describe, expect, it } from "vitest";
import { buildLibraryCatalogue, LIBRARY_CATALOGUE } from "../../src/data/libraryCatalogue";
import { SEED_EXERCISES } from "../../src/data/seed";

describe("LIBRARY_CATALOGUE", () => {
  it("merges seed, HF, NTC-style, free-exercise-db and wger sources", () => {
    expect(LIBRARY_CATALOGUE.some((item) => item.id.startsWith("hf_"))).toBe(true);
    expect(LIBRARY_CATALOGUE.some((item) => item.id.startsWith("ntc_"))).toBe(true);
    expect(LIBRARY_CATALOGUE.some((item) => item.id.startsWith("fedb_"))).toBe(true);
    expect(LIBRARY_CATALOGUE.some((item) => item.id.startsWith("wger_"))).toBe(true);
    expect(LIBRARY_CATALOGUE.length).toBeGreaterThan(600);
  });

  it("has unique ids", () => {
    const ids = LIBRARY_CATALOGUE.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only links progressions to ids in the catalogue", () => {
    const ids = new Set(LIBRARY_CATALOGUE.map((item) => item.id));
    const dangling = LIBRARY_CATALOGUE.flatMap((item) =>
      [item.easierId, item.harderId]
        .filter((ref): ref is string => Boolean(ref) && !ids.has(ref as string))
        .map((ref) => `${item.id} -> ${ref}`),
    );
    expect(dangling).toEqual([]);
  });

  it("throws on id collisions across any source", () => {
    const clash = [{ ...SEED_EXERCISES[0] }];
    expect(() => buildLibraryCatalogue(SEED_EXERCISES, [], clash)).toThrow(/collision/);
  });
});
