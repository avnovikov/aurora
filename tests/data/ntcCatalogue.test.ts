import { describe, expect, it } from "vitest";
import { FEDB_CATALOGUE } from "../../src/data/generated/fedbCatalogue";
import { HF_CATALOGUE } from "../../src/data/generated/hfCatalogue";
import { WGER_CATALOGUE } from "../../src/data/generated/wgerCatalogue";
import { LIBRARY_CATALOGUE } from "../../src/data/libraryCatalogue";
import { exerciseNameKey } from "../../src/data/nameKey";
import { NTC_ATTRIBUTION, NTC_CATALOGUE } from "../../src/data/ntc/ntcCatalogue";
import { SEED_EXERCISES } from "../../src/data/seed";

describe("NTC_CATALOGUE", () => {
  it("uses unique ntc_ ids", () => {
    const ids = NTC_CATALOGUE.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith("ntc_"))).toBe(true);
  });

  it("only adds moves not already in seed, HF, free-exercise-db or wger", () => {
    const others = [...SEED_EXERCISES, ...HF_CATALOGUE, ...FEDB_CATALOGUE, ...WGER_CATALOGUE];
    const taken = new Set(others.map((item) => exerciseNameKey(item.name)));
    const clashes = NTC_CATALOGUE.filter((item) => taken.has(exerciseNameKey(item.name)));
    expect(clashes.map((item) => item.name)).toEqual([]);
  });

  it("gives every move cues, muscles, joints and attribution", () => {
    for (const item of NTC_CATALOGUE) {
      expect(item.cues.length, item.id).toBeGreaterThanOrEqual(2);
      expect(item.muscles.some((m) => m.role === "primary"), item.id).toBe(true);
      expect(item.joints.length, item.id).toBeGreaterThan(0);
      expect(item.attribution).toBe(NTC_ATTRIBUTION);
      expect(item.media).toBeUndefined();
    }
  });

  it("links progressions to exercises that exist in the library", () => {
    const ids = new Set(LIBRARY_CATALOGUE.map((item) => item.id));
    for (const item of NTC_CATALOGUE) {
      for (const ref of [item.easierId, item.harderId]) {
        if (ref) {
          expect(ids.has(ref), `${item.id} -> ${ref}`).toBe(true);
        }
      }
    }
  });

  it("marks timed conditioning intervals as holds", () => {
    const highKnees = NTC_CATALOGUE.find((item) => item.id === "ntc_high_knees");
    expect(highKnees?.effort).toBe("hold");
    const sumo = NTC_CATALOGUE.find((item) => item.id === "ntc_sumo_squat");
    expect(sumo?.effort).toBeUndefined();
  });

  it("adds the v3 warm-up moves at their levels, with curated descriptions", () => {
    const levels = {
      ntc_push_up_plus: "beginner",
      ntc_assisted_pistol: "intermediate",
      ntc_chest_to_wall_handstand: "advanced",
      ntc_single_leg_balance: "beginner",
    } as const;
    for (const [id, level] of Object.entries(levels)) {
      const entry = LIBRARY_CATALOGUE.find((item) => item.id === id);
      expect(entry?.difficulty, id).toBe(level);
      expect(entry?.steps?.length, id).toBeGreaterThan(0);
    }
  });
});
