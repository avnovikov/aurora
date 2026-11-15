import { describe, expect, it } from "vitest";
import { buildHfCatalogue } from "../../src/data/hf/buildCatalogue";
import { HF_DATASET_ATTRIBUTION, type HfExerciseRecord } from "../../src/data/hf/types";
import { buildLibraryCatalogue } from "../../src/data/libraryCatalogue";
import { SEED_EXERCISES } from "../../src/data/seed";

const wallPushUp: HfExerciseRecord = {
  id: 1,
  name: "Wall Push-Up",
  category: "push",
  primary_muscles: ["chest", "anterior deltoids", "triceps"],
  description: "Stand facing a wall with hands at shoulder height.",
  progression_1: "Wall Push-Up",
  progression_2: "Incline Push-Up (counter height)",
  progression_3: "Incline Push-Up (low surface)",
  links: [
    {
      source: "free-exercise-db",
      type: "image",
      url: "https://example.com/fe.jpg",
      license: "public-domain",
    },
    {
      source: "everkinetic",
      type: "image",
      url: "https://example.com/ek.jpg",
      license: "CC-BY-SA-3.0",
    },
  ],
};

const inclineCounter: HfExerciseRecord = {
  ...wallPushUp,
  id: 99,
  name: "Incline Push-Up (counter height)",
  progression_1: "Wall Push-Up",
  progression_2: "Incline Push-Up (counter height)",
  progression_3: "Incline Push-Up (low surface)",
};

describe("mapHfExerciseRecord", () => {
  it("maps Apache-2.0 fields and filtered media", () => {
    const [exercise] = buildHfCatalogue([wallPushUp]);
    expect(exercise.id).toBe("hf_1");
    expect(exercise.pattern).toBe("horizontal_push");
    expect(exercise.regions).toContain("push");
    expect(exercise.attribution).toBe(HF_DATASET_ATTRIBUTION);
    expect(exercise.media?.map((item) => item.source)).toEqual(["everkinetic"]);
  });

  it("wires easier and harder progression ids within HF ids", () => {
    const catalogue = buildHfCatalogue([wallPushUp, inclineCounter]);
    const wall = catalogue.find((item) => item.id === "hf_1");
    const incline = catalogue.find((item) => item.id === "hf_99");
    expect(wall?.harderId).toBe("hf_99");
    expect(incline?.easierId).toBe("hf_1");
  });

  it("does not collide with seed ids when merged", () => {
    const catalogue = buildHfCatalogue([wallPushUp]);
    const merged = buildLibraryCatalogue(SEED_EXERCISES, catalogue);
    const seedIds = new Set(SEED_EXERCISES.map((item) => item.id));
    expect(merged.some((item) => seedIds.has(item.id) && item.id.startsWith("hf_"))).toBe(
      false,
    );
    expect(merged).toHaveLength(SEED_EXERCISES.length + catalogue.length);
  });
});