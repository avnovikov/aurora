import { describe, expect, it } from "vitest";
import { requiresFor } from "../../src/data/enrich/equipment";
import { listHtml } from "../../src/library/libraryList";
import { planSession } from "../../src/rules/planSession";
import { missingGear } from "../../src/safety/gear";
import { chooseSuitableExercise } from "../../src/safety/suitableExercise";
import { exerciseNamed as find } from "../helpers/exercises";

const readiness = { painJoints: [], sleepQuality: "good" as const };

describe("requiresFor", () => {
  it("tags gear moves", () => {
    expect(requiresFor("Pull-up")).toEqual(["bar"]);
    expect(requiresFor("Ring Dip")).toEqual(["rings"]);
    expect(requiresFor("Parallel Bar Dip")).toEqual(["parallettes"]);
    expect(requiresFor("Korean Dip")).toEqual(["bar"]);
    expect(requiresFor("Suspended Row")).toEqual(["rings"]);
  });

  it("leaves floor moves and look-alikes untagged", () => {
    for (const name of [
      "Standard Push-Up", "Hamstring Stretch", "Elbow Lever", "Chin To Chest Stretch",
      "Plank hip dips", "Bench Dip", "Typewriter Push-Up", "Bent-knee Iron Cross",
    ]) {
      expect(requiresFor(name), name).toEqual([]);
    }
  });

  it("keeps existing gear (bands) and adds no duplicates", () => {
    expect(requiresFor("Band pull-aparts", ["band"])).toEqual(["band"]);
    expect(requiresFor("Pull-up", ["bar"])).toEqual(["bar"]);
  });

  it("is applied across the Library", () => {
    expect(find("Pull-up").requires).toEqual(["bar"]);
    expect(find("Ring Dip").requires).toEqual(["rings"]);
    expect(find("Standard Push-Up").requires).toBeUndefined();
  });
});

describe("missingGear", () => {
  it("reports only gear the profile lacks; body is free; no profile means no gating", () => {
    expect(missingGear(["bar", "rings"], ["body", "bar"])).toEqual(["rings"]);
    expect(missingGear(["body"], [])).toEqual([]);
    expect(missingGear(["rings"], undefined)).toEqual([]);
    expect(missingGear(undefined, ["body"])).toEqual([]);
  });
});

describe("planner honours equipment", () => {
  it("plans bar moves for the default kit", () => {
    const session = planSession(readiness, undefined, undefined, { equipment: ["body", "bar"] });
    expect(session.work.some((item) => item.ruleIds.includes("equipment"))).toBe(false);
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
    const html = listHtml([], new Set(), {
      text: "",
      level: "all",
      onlyGear: true,
    });
    expect(html).toContain("data-only-gear");
    expect(html).toMatch(/data-only-gear class="selected"/);
  });
});
