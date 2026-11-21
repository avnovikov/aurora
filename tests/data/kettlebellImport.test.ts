import { describe, expect, it } from "vitest";
import { LIBRARY_CATALOGUE } from "../../src/data/libraryCatalogue";
import { isFedbCandidate, KETTLEBELL_EQUIPMENT as FEDB_KB } from "../../src/data/fedb/selection";
import type { FedbExerciseRecord } from "../../src/data/fedb/types";
import {
  KETTLEBELL_EQUIPMENT as WGER_KB,
  isWgerCandidate,
  isWgerPureKettlebell,
} from "../../src/data/wger/selection";
import type { WgerExerciseRecord } from "../../src/data/wger/types";
import { EQUIPMENT_IDS } from "../../src/domain/program";

function fedb(overrides: Partial<FedbExerciseRecord>): FedbExerciseRecord {
  return {
    id: "X",
    name: "X",
    force: "push",
    level: "beginner",
    mechanic: "compound",
    equipment: FEDB_KB,
    primaryMuscles: ["shoulders"],
    secondaryMuscles: [],
    instructions: ["Step."],
    category: "strength",
    images: [],
    ...overrides,
  };
}

function wger(overrides: Partial<WgerExerciseRecord>): WgerExerciseRecord {
  return {
    id: 1,
    name: "Test",
    description: "<p>A long enough description for the candidate filter.</p>",
    category: "Shoulders",
    muscles: [2],
    musclesSecondary: [],
    equipment: [WGER_KB],
    license: "CC-BY-SA-4.0",
    licenseAuthor: "",
    images: [],
    ...overrides,
  };
}

describe("pure kettlebell import (#171)", () => {
  it("registers kettlebell as gear and accepts pure kettlebell source rows", () => {
    expect(EQUIPMENT_IDS).toContain("kettlebell");
    expect(isFedbCandidate(fedb({}))).toBe(true);
    expect(isFedbCandidate(fedb({ equipment: "dumbbell" }))).toBe(false);
    expect(isWgerPureKettlebell([WGER_KB])).toBe(true);
    expect(isWgerPureKettlebell([WGER_KB, "Bench"])).toBe(true);
    expect(isWgerPureKettlebell([WGER_KB, "Dumbbell"])).toBe(false);
    expect(isWgerCandidate(wger({}))).toBe(true);
    expect(isWgerCandidate(wger({ equipment: ["Dumbbell"] }))).toBe(false);
  });

  it("ships kettlebell-required Library moves; dumbbell-required only as curated weighted cousins (#251)", () => {
    const kettlebell = LIBRARY_CATALOGUE.filter((ex) => (ex.requires ?? []).includes("kettlebell"));
    const dumbbell = LIBRARY_CATALOGUE.filter((ex) => (ex.requires ?? []).includes("dumbbell"));
    expect(kettlebell.length).toBeGreaterThanOrEqual(40);
    expect(dumbbell.length).toBeGreaterThanOrEqual(12);
    expect(dumbbell.every((ex) => ex.id.startsWith("wger_"))).toBe(true);
    expect(dumbbell.every((ex) => !ex.easierId && !ex.harderId)).toBe(true);
    expect(kettlebell.every((ex) => ex.id.startsWith("fedb_") || ex.id.startsWith("wger_"))).toBe(true);
    expect(kettlebell.every((ex) => !ex.easierId && !ex.harderId)).toBe(true);
  });
});
