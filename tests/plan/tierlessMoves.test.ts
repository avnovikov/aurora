// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { EXERCISE_GRAPH, isPlannable, isTierless } from "../../src/data/exerciseGraph";
import { templateToStarter } from "../../src/data/seed";
import type { ExerciseMemory } from "../../src/domain/types";
import { mountLibraryDetail } from "../../src/library/libraryDetail";
import { generateBlock } from "../../src/plan/generateBlock";
import { familyTier, type StepContext } from "../../src/plan/ladderSteps";
import { pickLevelAppropriateStep } from "../../src/plan/pathPlacement";
import { applyPlanLevelRaiseIfReady } from "../../src/plan/planLevelRaise";
import { applySkillDose } from "../../src/rules/skillDose";
import { planSession } from "../../src/rules/planSession";
import { exerciseNamed } from "../helpers/exercises";

/** A not_max_test move (#262): an activation drill, no gear, on the core ladder. */
const BIRD_DOG = exerciseNamed("Bird Dog");

const ctx = (memories: Record<string, ExerciseMemory> = {}): StepContext => ({
  memories,
  jointHistory: [],
  excluded: [],
  equipment: ["body"],
});

const memory = (over: Partial<ExerciseMemory> = {}): ExerciseMemory => ({
  exerciseId: BIRD_DOG.id,
  sessionsAtStandard: 0,
  sessionsBelowFloor: 0,
  lastAddedLoadKg: 0,
  weakLinkSessionsRemaining: 0,
  ...over,
});

describe("not_max_test moves have no tiers (#262)", () => {
  it("carry no standards but stay plannable", () => {
    expect(BIRD_DOG.standards).toBeUndefined();
    expect(isTierless(BIRD_DOG)).toBe(true);
    expect(isPlannable(BIRD_DOG)).toBe(true);
  });

  it("appear in a generated plan with the slot's own sets and reps", () => {
    const days = generateBlock({ kind: "core", context: ctx(), newId: () => "t" });
    const slots = days.flatMap((day) => day.slots).filter((slot) => slot.exerciseId === BIRD_DOG.id);
    expect(slots.length).toBeGreaterThan(0);
    for (const slot of slots) {
      expect(slot.dose.sets).toBeGreaterThanOrEqual(3);
      expect(slot.dose.reps).toBe(8);
      expect(slot.dose.targetRir).toBe(2);
      expect(slot.dose.addedLoadKg).toBe(0);
    }
    const day = days.find((item) => item.slots.some((slot) => slot.exerciseId === BIRD_DOG.id))!;
    const planned = planSession({ painJoints: [], sleepQuality: "good" }, templateToStarter(day), {}, { focus: day.focus });
    const item = planned.work.find((work) => work.exerciseId === BIRD_DOG.id)!;
    expect(item.dose.reps).toBe(8);
    expect(item.ruleIds).not.toContain("skill_dose");
  });

  it("dose, ladder tier and level raise tolerate no standards", () => {
    const dose = { sets: 3, reps: 8, targetRir: 2, addedLoadKg: 0 };
    const withBest = memory({ bestReps: 40, declaredTier: "advanced" });
    expect(applySkillDose(dose, BIRD_DOG, withBest)).toMatchObject({ dose, applied: false });
    expect(() => familyTier("core", ctx({ [BIRD_DOG.id]: withBest }))).not.toThrow();
    const day = generateBlock({ kind: "core", context: ctx(), newId: () => "t" })[0]!;
    const only = { ...day, slots: day.slots.filter((slot) => slot.exerciseId === BIRD_DOG.id) };
    expect(only.slots).toHaveLength(1);
    // Nothing to gate on: a day of tierless moves never raises the plan level.
    expect(
      applyPlanLevelRaiseIfReady({ days: [only, only, only], memories: { [BIRD_DOG.id]: withBest }, currentLevel: "beginner" }),
    ).toEqual({ raised: false });
    expect(pickLevelAppropriateStep(BIRD_DOG.id, EXERCISE_GRAPH, "advanced")).toBeTypeOf("string");
  });

  it("the Library detail renders without a tier picker or standards strip", () => {
    const root = document.createElement("div");
    mountLibraryDetail(root, {
      exercise: BIRD_DOG,
      catalogueById: EXERCISE_GRAPH,
      scrollToTop: false,
      actions: { onBack: () => {}, onOpenExercise: () => {} },
    });
    expect(root.querySelector("[data-skill-tier]")).toBeNull();
    expect(root.querySelector(".ex-standards")).toBeNull();
    expect(root.querySelector(".skill-standards")).toBeNull();
    expect(root.querySelector("[data-standards-source]")?.textContent).toContain("not a max-rep test");
  });

  it("the Library detail shows where a band comes from", () => {
    const root = document.createElement("div");
    mountLibraryDetail(root, {
      exercise: exerciseNamed("Ring Row"),
      catalogueById: EXERCISE_GRAPH,
      scrollToTop: false,
      actions: { onBack: () => {}, onOpenExercise: () => {} },
    });
    expect(root.querySelector(".ex-standards [data-standards-source]")?.textContent).toBe("Band: Derived from inverted row");
  });

  it("escapes the band label", () => {
    const root = document.createElement("div");
    const ringRow = exerciseNamed("Ring Row");
    mountLibraryDetail(root, {
      exercise: { ...ringRow, standardsSource: { kind: "derived", label: '<img src=x onerror="1">' } },
      catalogueById: EXERCISE_GRAPH,
      scrollToTop: false,
      actions: { onBack: () => {}, onOpenExercise: () => {} },
    });
    const hint = root.querySelector("[data-standards-source]")!;
    expect(hint.querySelector("img")).toBeNull();
    expect(hint.textContent).toBe('Band: <img src=x onerror="1">');
  });
});
