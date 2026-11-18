import { describe, expect, it } from "vitest";
import { curatedEquipmentFor } from "../../src/data/curatedEquipment";
import { enrichCatalogue } from "../../src/data/enrich/enrichCatalogue";
import { CURATED_EQUIPMENT } from "../../src/data/generated/equipment";
import { LIBRARY_CATALOGUE } from "../../src/data/libraryCatalogue";
import { isEquipmentId, type EquipmentId } from "../../src/domain/program";
import { listHtml } from "../../src/library/libraryList";
import { planSession } from "../../src/rules/planSession";
import { missingGear } from "../../src/safety/gear";
import { chooseSuitableExercise } from "../../src/safety/suitableExercise";
import { exerciseNamed as find } from "../helpers/exercises";

const readiness = { painJoints: [], sleepQuality: "good" as const };

const byId = (id: string) => {
  const found = LIBRARY_CATALOGUE.find((item) => item.id === id);
  if (!found) {
    throw new Error(`No Library exercise ${id}`);
  }
  return found;
};
const usable = (id: string, equipment: EquipmentId[]) => missingGear(byId(id), equipment).length === 0;

describe("curated equipment (#111)", () => {
  it("covers every Library exercise, and only with known gear ids", () => {
    for (const exercise of LIBRARY_CATALOGUE) {
      expect(CURATED_EQUIPMENT[exercise.id], exercise.id).toBeDefined();
    }
    for (const [id, entry] of Object.entries(CURATED_EQUIPMENT)) {
      for (const gear of [...entry.requires, ...(entry.orRequires ?? []).flat()]) {
        expect(isEquipmentId(gear), `${id}: ${gear}`).toBe(true);
        expect(gear, id).not.toBe("body");
      }
      expect(entry.evidence, id).not.toBe("");
    }
  });

  it("has no entries for moves outside the Library", () => {
    const ids = new Set(LIBRARY_CATALOGUE.map((item) => item.id));
    expect(Object.keys(CURATED_EQUIPMENT).filter((id) => !ids.has(id))).toEqual([]);
  });

  it("is what the Library carries", () => {
    for (const exercise of LIBRARY_CATALOGUE) {
      const entry = CURATED_EQUIPMENT[exercise.id]!;
      expect(exercise.requires ?? [], exercise.id).toEqual(entry.requires);
      expect(exercise.orRequires, exercise.id).toEqual(entry.orRequires);
    }
  });

  it("fails loudly for an exercise with no entry", () => {
    expect(() => curatedEquipmentFor("not_a_move")).toThrow(/No curated equipment for not_a_move/);
    expect(() =>
      enrichCatalogue([{ ...byId("pullup"), id: "not_a_move" }]),
    ).toThrow(/No curated equipment/);
  });

  it("honours alternatives", () => {
    // Suspended Split Squat: feet in strap cradles; the audit lists no rings alternative.
    expect(usable("fedb_suspended_split_squat", ["body", "suspension"])).toBe(true);
    expect(usable("fedb_suspended_split_squat", ["body", "rings"])).toBe(false);
    expect(usable("fedb_suspended_split_squat", ["body"])).toBe(false);
    // Suspended Row: straps, or rings as the alternative.
    expect(usable("fedb_suspended_row", ["body", "suspension"])).toBe(true);
    expect(usable("fedb_suspended_row", ["body", "rings"])).toBe(true);
    expect(usable("fedb_suspended_row", ["body", "bar"])).toBe(false);
  });

  it("spot checks", () => {
    // A foot anchor (bed, sofa) is always assumed, like a bench or wall.
    expect(byId("nordic_curl").requires).toBeUndefined();
    expect(usable("nordic_curl", ["body"])).toBe(true);
    expect(byId("fedb_hyperextensions_with_no_hyperextension_bench").requires).toBeUndefined();
    expect(byId("hf_84").requires).toEqual(["sliders"]);
    expect(byId("hf_84").orRequires).toEqual([["towel"]]);
    expect(usable("hf_84", ["body", "towel"])).toBe(true);
    // Owner review: parallettes handle every parallel-bar move; a dip station also works.
    for (const id of [
      "hf_25", "hf_26", "hf_30", "hf_146", "wger_2706", "wger_1808", "fedb_knee_hip_raise_on_parallel_bars",
    ]) {
      expect(byId(id).requires, id).toEqual(["parallettes"]);
      expect(usable(id, ["body", "parallettes"]), id).toBe(true);
      expect(usable(id, ["body", "dip_bars"]), id).toBe(true);
      expect(usable(id, ["body"]), id).toBe(false);
    }
    expect(byId("hf_27").requires).toEqual(["bar"]); // Straight Bar Dip
    expect(byId("hf_28").requires).toEqual(["bar"]); // Korean Dip
    expect(byId("hf_29").requires).toEqual(["rings"]); // Ring Dip
    expect(byId("hf_133").requires).toEqual(["rings"]); // Ring Support Hold
    expect(byId("wger_2557").requires).toBeUndefined();
    expect(byId("bulgarian_split").requires).toBeUndefined();
    expect(LIBRARY_CATALOGUE.some((item) => item.id === "wger_688")).toBe(false);
    expect(find("Pull-up").requires).toEqual(["bar"]);
    expect(find("Ring Dip").requires).toEqual(["rings"]);
    expect(find("Standard Push-Up").requires).toBeUndefined();
  });

  it("never lists bench or wall", () => {
    const gear = new Set(Object.values(CURATED_EQUIPMENT).flatMap((entry) => entry.requires));
    expect([...gear].some((item) => /bench$|wall/.test(item) && item !== "adjustable_bench")).toBe(false);
  });
});

describe("missingGear", () => {
  it("reports only gear the profile lacks; body is free; no profile means no gating", () => {
    expect(missingGear(["bar", "rings"], ["body", "bar"])).toEqual(["rings"]);
    expect(missingGear(["body"], [])).toEqual([]);
    expect(missingGear(["rings"], undefined)).toEqual([]);
    expect(missingGear(undefined, ["body"])).toEqual([]);
  });

  it("is satisfied by any one complete alternative set", () => {
    const needs = { requires: ["bar" as const], orRequires: [["rings" as const], ["partner" as const, "towel" as const]] };
    expect(missingGear(needs, ["body", "rings"])).toEqual([]);
    expect(missingGear(needs, ["body", "partner", "towel"])).toEqual([]);
    expect(missingGear(needs, ["body", "partner"])).toEqual(["bar"]);
  });
});

describe("planner honours equipment", () => {
  it("plans bar moves for the default kit", () => {
    const session = planSession(readiness, undefined, undefined, { equipment: ["body", "bar"] });
    const swapped = session.work.filter((item) => item.ruleIds.includes("equipment"));
    // Nothing is swapped: the Nordic curl's foot anchor is always assumed.
    expect(swapped).toEqual([]);
  });

  it("swaps out moves needing gear the user lacks", () => {
    const session = planSession(
      readiness,
      undefined,
      undefined,
      { equipment: ["body"] },
    );
    for (const item of session.work) {
      const chosen = find(item.exerciseName);
      expect(missingGear(chosen.requires, ["body"]), item.exerciseName).toEqual([]);
    }
  });

  it("is unchanged when no equipment is passed", () => {
    const session = planSession(readiness);
    expect(session.work.every((item) => !item.ruleIds.includes("equipment"))).toBe(true);
  });

  it("chooseSuitableExercise swaps for gear with a clear reason", () => {
    const choice = chooseSuitableExercise(find("Ring Push-Up"), [], ["body", "bar"]);
    expect(choice.cause).toBe("gear");
    expect(choice.reason).toMatch(/Needs rings \(not in your equipment\)/);
    expect(missingGear(find(choice.name).requires, ["body", "bar"])).toEqual([]);
  });

  it("keeps the move, with a note, when no gear-free alternative exists", () => {
    const choice = chooseSuitableExercise(find("Pull-up"), [], ["body"]);
    expect(choice.swappedFrom).toBeUndefined();
    expect(choice.cause).toBe("gear");
    expect(choice.cautions[0]).toMatch(/Needs bar/);
  });
});

describe("Library gear filter", () => {
  it("always offers Only my gear", () => {
    const html = listHtml(
      [],
      new Set(),
      {
      text: "",
      level: "all",
      onlyGear: true,
    },
    );
    expect(html).toContain("data-only-gear");
    expect(html).toMatch(/data-only-gear class="selected"/);
  });
});
