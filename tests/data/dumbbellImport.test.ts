import { describe, expect, it } from "vitest";
import { LIBRARY_CATALOGUE } from "../../src/data/libraryCatalogue";
import { isFedbCandidate, DUMBBELL_EQUIPMENT as FEDB_DB } from "../../src/data/fedb/selection";
import type { FedbExerciseRecord } from "../../src/data/fedb/types";
import {
  DUMBBELL_EQUIPMENT as WGER_DB,
  isWgerCandidate,
  isWgerPureDumbbell,
  WGER_DENY,
  WGER_SAME_AS_EXISTING,
} from "../../src/data/wger/selection";
import type { WgerExerciseRecord } from "../../src/data/wger/types";

function fedb(overrides: Partial<FedbExerciseRecord>): FedbExerciseRecord {
  return {
    id: "X",
    name: "X",
    force: "push",
    level: "beginner",
    mechanic: "compound",
    equipment: FEDB_DB,
    primaryMuscles: ["chest"],
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
    category: "Chest",
    muscles: [4],
    musclesSecondary: [],
    equipment: [WGER_DB],
    license: "CC-BY-SA-4.0",
    licenseAuthor: "",
    images: [],
    ...overrides,
  };
}

describe("pure dumbbell import (#168)", () => {
  it("accepts pure dumbbell records from FEDB and wger", () => {
    expect(isFedbCandidate(fedb({}))).toBe(true);
    expect(isFedbCandidate(fedb({ equipment: "barbell" }))).toBe(false);
    expect(isWgerPureDumbbell([WGER_DB])).toBe(true);
    expect(isWgerPureDumbbell([WGER_DB, "Bench"])).toBe(true);
    expect(isWgerPureDumbbell([WGER_DB, "Barbell"])).toBe(false);
    expect(isWgerCandidate(wger({}))).toBe(true);
  });

  it("ships dumbbell-required Library moves from the imported sources", () => {
    const dumbbell = LIBRARY_CATALOGUE.filter((ex) => (ex.requires ?? []).includes("dumbbell"));
    const importedId = (id: string) => id.startsWith("fedb_") || id.startsWith("wger_");
    expect(dumbbell.length).toBeGreaterThanOrEqual(200);
    expect(dumbbell.every((ex) => importedId(ex.id))).toBe(true);
    expect(dumbbell.every((ex) => !ex.easierId && !ex.harderId)).toBe(true);
  });

  it("drops the barbell mis-tag and folds true FEDB twins (keeps seated/incline micro-variants)", () => {
    expect(WGER_DENY).toContain("Barbell Clean and press");
    expect(WGER_SAME_AS_EXISTING["Benchpress Dumbbells"]).toBe("Dumbbell Bench Press");
    expect(WGER_SAME_AS_EXISTING["Dumbbell Concentration Curl"]).toBe("Concentration Curls");
    expect(WGER_SAME_AS_EXISTING["Dumbbell Incline Curl"]).toBe("Incline Dumbbell Curl");
    expect(WGER_SAME_AS_EXISTING["Incline Dumbbell Row"]).toBe("Dumbbell Incline Row");
    expect(WGER_SAME_AS_EXISTING["Decline Bench Press Dumbbell"]).toBe("Decline Dumbbell Bench Press");

    const names = new Set(LIBRARY_CATALOGUE.map((ex) => ex.name));
    expect(names.has("Barbell Clean and press")).toBe(false);
    expect(names.has("Benchpress Dumbbells")).toBe(false);
    expect(names.has("Dumbbell Concentration Curl")).toBe(false);
    expect(names.has("Dumbbell Bench Press")).toBe(true);
    expect(names.has("Incline Dumbbell Curl")).toBe(true);
    expect(names.has("Seated Dumbbell Curl")).toBe(true);
  });
});
