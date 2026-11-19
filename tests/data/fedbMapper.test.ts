import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildFedbCatalogue, parseFedbJson } from "../../src/data/fedb/buildCatalogue";
import { fedbExerciseId, mapFedbExerciseRecord } from "../../src/data/fedb/mapFedbExercise";
import {
  FEDB_ALLOW_OTHER,
  FEDB_DENY,
  FEDB_RECLASSIFY,
  FEDB_SAME_AS_EXISTING,
  KETTLEBELL_EQUIPMENT,
} from "../../src/data/fedb/selection";
import { FEDB_ATTRIBUTION, type FedbExerciseRecord } from "../../src/data/fedb/types";
import { FEDB_CATALOGUE } from "../../src/data/generated/fedbCatalogue";
import { HF_CATALOGUE } from "../../src/data/generated/hfCatalogue";
import { NTC_CATALOGUE } from "../../src/data/ntc/ntcCatalogue";
import { SEED_EXERCISES } from "../../src/data/seed";

const RAW = parseFedbJson(
  readFileSync(new URL("../../data/raw/free-exercise-db.json", import.meta.url), "utf8"),
);

function record(overrides: Partial<FedbExerciseRecord>): FedbExerciseRecord {
  return {
    id: "Test_Move",
    name: "Test Move",
    force: "push",
    level: "beginner",
    mechanic: "compound",
    equipment: "body only",
    primaryMuscles: ["chest"],
    secondaryMuscles: ["triceps"],
    instructions: ["Step one.", "Step two."],
    category: "strength",
    images: ["Test_Move/0.jpg"],
    ...overrides,
  };
}

describe("mapFedbExerciseRecord", () => {
  it("maps a push-up to a horizontal push with text but no images", () => {
    const mapped = mapFedbExerciseRecord(record({ id: "Push-Up_Wide", name: "Push-Up Wide" }));
    expect(mapped.id).toBe("fedb_push_up_wide");
    expect(mapped.pattern).toBe("horizontal_push");
    expect(mapped.regions).toEqual(["push"]);
    expect(mapped.muscles).toEqual([
      { group: "chest", role: "primary" },
      { group: "triceps", role: "secondary" },
    ]);
    expect(mapped.cues).toEqual(["Step one.", "Step two."]);
    expect(mapped.media).toBeUndefined();
    expect(mapped.attribution).toBe(FEDB_ATTRIBUTION);
  });

  it("treats static stretches as isometric warmup mobility", () => {
    const mapped = mapFedbExerciseRecord(
      record({ category: "stretching", force: "static", primaryMuscles: ["hamstrings"] }),
    );
    expect(mapped.pattern).toBe("mobility");
    expect(mapped.type).toBe("isometric");
    expect(mapped.role).toBe("warmup");
    expect(mapped.regions).toEqual(["general", "legs"]);
  });

  it("classifies chin-ups as vertical pulls and hanging ab work as core + pull", () => {
    const chin = mapFedbExerciseRecord(record({ name: "Mixed Grip Chin", primaryMuscles: ["lats"] }));
    expect(chin.pattern).toBe("vertical_pull");
    const pike = mapFedbExerciseRecord(
      record({ name: "Hanging Pike", primaryMuscles: ["abdominals"], force: "pull" }),
    );
    expect(pike.pattern).toBe("core_compression");
    expect(pike.regions).toEqual(["core", "pull"]);
  });

  it("applies reclassification for strength moves the source tags as stretches", () => {
    const split = mapFedbExerciseRecord(
      record({ name: "Split Squats", category: "stretching", primaryMuscles: ["hamstrings"] }),
    );
    expect(split.pattern).toBe("squat");
    expect(split.role).toBe("work");
  });

  it("rejects records without recognised muscles", () => {
    expect(() => mapFedbExerciseRecord(record({ primaryMuscles: [], secondaryMuscles: [] }))).toThrow();
  });

  it("slugs ids safely", () => {
    expect(fedbExerciseId("3_4_Sit-Up")).toBe("fedb_3_4_sit_up");
    expect(fedbExerciseId("Knee/Hip_Raise_On_Parallel_Bars")).toBe(
      "fedb_knee_hip_raise_on_parallel_bars",
    );
  });
});

describe("buildFedbCatalogue", () => {
  it("skips non-kettlebell equipment moves, denied moves and names already in the library", () => {
    const records = [
      record({ id: "A", name: "Clock Push-Up" }),
      record({ id: "B", name: "Barbell Curl", equipment: "barbell" }),
      record({ id: "C", name: "Linear Acceleration Wall Drill" }),
      record({ id: "D", name: "Pushups" }),
      record({ id: "E", name: "Bodyweight Squats" }),
      record({ id: "F", name: "Suspended Row", equipment: "other", primaryMuscles: ["middle back"] }),
      record({ id: "G", name: "Kettlebell Swing", equipment: KETTLEBELL_EQUIPMENT, primaryMuscles: ["hamstrings"] }),
    ];
    const existing = [SEED_EXERCISES.find((item) => item.id === "bodyweight_squat")!];
    const { catalogue, skippedDuplicates } = buildFedbCatalogue(records, existing);
    expect(catalogue.map((item) => item.name)).toEqual([
      "Clock Push-Up",
      "Kettlebell Swing",
      "Suspended Row",
    ]);
    expect(skippedDuplicates).toEqual(["Pushups", "Bodyweight Squats"]);
  });

  it("matches the committed generated module (re-run npm run import:fedb)", () => {
    const existing = [...SEED_EXERCISES, ...HF_CATALOGUE, ...NTC_CATALOGUE];
    const { catalogue } = buildFedbCatalogue(RAW, existing);
    expect(catalogue).toEqual(FEDB_CATALOGUE);
  });
});

describe("selection lists", () => {
  it("only name moves that exist in the raw snapshot", () => {
    const names = new Set(RAW.map((item) => item.name));
    const listed = [
      ...FEDB_ALLOW_OTHER,
      ...FEDB_DENY,
      ...Object.keys(FEDB_SAME_AS_EXISTING),
      ...Object.keys(FEDB_RECLASSIFY),
    ];
    expect(listed.filter((name) => !names.has(name))).toEqual([]);
  });
});
