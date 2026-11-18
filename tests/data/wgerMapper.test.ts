import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FEDB_CATALOGUE } from "../../src/data/generated/fedbCatalogue";
import { HF_CATALOGUE } from "../../src/data/generated/hfCatalogue";
import { WGER_CATALOGUE } from "../../src/data/generated/wgerCatalogue";
import { NTC_CATALOGUE } from "../../src/data/ntc/ntcCatalogue";
import { SEED_EXERCISES } from "../../src/data/seed";
import { buildWgerCatalogue, slimWgerApiResults } from "../../src/data/wger/buildCatalogue";
import {
  cleanWgerName,
  mapWgerExerciseRecord,
  wgerDescriptionLines,
} from "../../src/data/wger/mapWgerExercise";
import {
  DUMBBELL_EQUIPMENT,
  WGER_ALLOW_UNTAGGED,
  WGER_DENY,
  WGER_SAME_AS_EXISTING,
  isWgerCandidate,
} from "../../src/data/wger/selection";
import type { WgerExerciseRecord } from "../../src/data/wger/types";

const RAW = JSON.parse(
  readFileSync(new URL("../../data/raw/wger-exercises.json", import.meta.url), "utf8"),
) as WgerExerciseRecord[];

function record(overrides: Partial<WgerExerciseRecord>): WgerExerciseRecord {
  return {
    id: 42,
    name: "Deficit Push ups",
    description: "<ol><li>Hands on two blocks.</li><li>Lower below hand level.</li></ol>",
    category: "Chest",
    muscles: [4],
    musclesSecondary: [5, 2],
    equipment: ["none (bodyweight exercise)"],
    license: "CC-BY-SA-4.0",
    licenseAuthor: "someone",
    images: [{ url: "https://wger.de/media/x.webp", license: "CC-BY-SA-4.0", author: "a" }],
    ...overrides,
  };
}

describe("wger mapping", () => {
  it("maps text, muscles, licence and images", () => {
    const mapped = mapWgerExerciseRecord(record({}));
    expect(mapped.id).toBe("wger_42");
    expect(mapped.pattern).toBe("horizontal_push");
    expect(mapped.cues).toEqual(["Hands on two blocks.", "Lower below hand level."]);
    expect(mapped.muscles[0]).toEqual({ group: "chest", role: "primary" });
    expect(mapped.attribution).toContain("CC-BY-SA-4.0");
    expect(mapped.media?.[0]).toMatchObject({ license: "CC-BY-SA-4.0", mediaType: "image" });
  });

  it("classifies by movement name before wger's category", () => {
    const squat = mapWgerExerciseRecord(record({ name: "Box squat", category: "Legs", muscles: [8] }));
    expect(squat.pattern).toBe("squat");
    const hang = mapWgerExerciseRecord(record({ name: "Towel Grip Dead Hang", category: "Arms" }));
    expect(hang.pattern).toBe("vertical_pull");
    const stretch = mapWgerExerciseRecord(record({ name: "Runners Lunge Stretch", category: "Legs" }));
    expect(stretch.pattern).toBe("mobility");
    expect(stretch.role).toBe("warmup");
  });

  it("cleans duplicate markers from names", () => {
    expect(cleanWgerName("Bulgarian split squats left")).toBe("Bulgarian split squats");
    expect(cleanWgerName("Calf raises, right leg")).toBe("Calf raises");
    expect(cleanWgerName("Jumping Jack HD")).toBe("Jumping Jack");
    expect(cleanWgerName("Crunches (Custom)")).toBe("Crunches");
  });

  it("renames wger rows whose name contradicts their text", () => {
    const jumpIn = mapWgerExerciseRecord(
      record({ id: 1286, name: "Dynamic Planche", category: "Abs", muscles: [6] }),
    );
    expect(jumpIn.name).toBe("Plank Jump-In");
    expect(jumpIn.type).toBe("dynamic");
    expect(jumpIn.regions).not.toContain("skill");
  });

  it("parses paragraph descriptions and entities", () => {
    expect(wgerDescriptionLines("<p>Keep&nbsp;tall.</p><p>Breathe &amp; go.</p>")).toEqual([
      "Keep tall.",
      "Breathe & go.",
    ]);
  });

  it("rejects machines, empty descriptions, and non-pure dumbbell mixes", () => {
    expect(isWgerCandidate(record({ equipment: [DUMBBELL_EQUIPMENT] }))).toBe(true);
    expect(isWgerCandidate(record({ equipment: [DUMBBELL_EQUIPMENT, "Bench"] }))).toBe(true);
    expect(isWgerCandidate(record({ equipment: [DUMBBELL_EQUIPMENT, "Barbell"] }))).toBe(false);
    expect(isWgerCandidate(record({ equipment: [DUMBBELL_EQUIPMENT, "Kettlebell"] }))).toBe(false);
    expect(isWgerCandidate(record({ name: "Foam Roller quadriceps" }))).toBe(false);
    expect(isWgerCandidate(record({ description: "<p></p>" }))).toBe(false);
    expect(isWgerCandidate(record({ equipment: [] }))).toBe(false);
    expect(isWgerCandidate(record({ name: "Snap Down", equipment: [] }))).toBe(true);
  });

  it("slims API payloads to English rows with normalised licences", () => {
    const slim = slimWgerApiResults([
      {
        id: 7,
        category: { name: "Abs" },
        muscles: [{ id: 6 }],
        muscles_secondary: [],
        equipment: [{ name: "Gym mat" }],
        license: { short_name: "CC-BY-SA 4" },
        license_author: null,
        images: [{ image: "u", license: 3, license_author: null }],
        translations: [
          { language: 1, name: "Bauch", description: "x" },
          { language: 2, name: " Crunch ", description: "y" },
        ],
      },
    ]);
    expect(slim).toEqual([
      expect.objectContaining({
        id: 7,
        name: "Crunch",
        license: "CC-BY-SA-4.0",
        images: [{ url: "u", license: "CC0", author: "" }],
      }),
    ]);
  });
});

describe("buildWgerCatalogue", () => {
  it("matches the committed generated module (re-run npm run import:wger)", () => {
    const existing = [...SEED_EXERCISES, ...HF_CATALOGUE, ...NTC_CATALOGUE, ...FEDB_CATALOGUE];
    expect(buildWgerCatalogue(RAW, existing).catalogue).toEqual(WGER_CATALOGUE);
  });

  it("selection lists only name rows that exist in the snapshot", () => {
    const names = new Set(RAW.map((item) => item.name));
    const listed = [...WGER_ALLOW_UNTAGGED, ...WGER_DENY, ...Object.keys(WGER_SAME_AS_EXISTING)];
    expect(listed.filter((name) => !names.has(name))).toEqual([]);
  });
});

describe("wger move type: reps vs hold", () => {
  const typeOf = (name: string, category = "Legs"): string => mapWgerExerciseRecord(record({ name, category })).type;

  it("keeps a rep move whose name only brushes a hold keyword as reps", () => {
    expect(typeOf("Supported Split Squat")).toBe("dynamic");
    expect(typeOf("Front lever pull-up", "Back")).toBe("dynamic");
    expect(typeOf("Plank with Alternating Leg Lift", "Abs")).toBe("dynamic");
    expect(typeOf("Dynamic side plank", "Abs")).toBe("dynamic");
  });

  it("still types real holds as holds", () => {
    expect(typeOf("Pull-up Isometric Hold", "Back")).toBe("isometric");
    expect(typeOf("Pull-Up Top Position Hold", "Back")).toBe("isometric");
    expect(typeOf("L-Sit (Foot Supported)", "Abs")).toBe("isometric");
    expect(typeOf("Reverse Plank", "Abs")).toBe("isometric");
  });

  it("prescribes the supported split squat in reps", () => {
    expect(WGER_CATALOGUE.find((exercise) => exercise.id === "wger_2557")?.type).toBe("dynamic");
  });
});
