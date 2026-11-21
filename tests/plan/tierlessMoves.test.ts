// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { EXERCISE_GRAPH, isPlannable, PLANNABLE_EXERCISES } from "../../src/data/exerciseGraph";
import { TEMPLATE_BY_ID, templateToStarter } from "../../src/data/seed";
import { SKILL_TIER_LABELS } from "../../src/domain/skillTier";
import { EQUIPMENT_IDS } from "../../src/domain/program";
import { AREA_KINDS } from "../../src/plan/dayKinds";
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
  it("carry no standards, so the generator never picks them", () => {
    expect(BIRD_DOG.standards).toBeUndefined();
    expect(BIRD_DOG.standardsSource?.kind).toBe("none");
    expect(isPlannable(BIRD_DOG)).toBe(false);
    expect(PLANNABLE_EXERCISES.some((exercise) => exercise.standardsSource?.kind === "none")).toBe(false);
  });

  it("no generated block holds a tierless move, a move without standards or the 8 reps at RIR 2 placeholder", () => {
    const contexts = [ctx(), { ...ctx(), equipment: [...EQUIPMENT_IDS] }, { ...ctx(), level: "advanced" as const }];
    let slots = 0;
    for (const kind of AREA_KINDS) {
      for (const context of contexts) {
        for (const day of generateBlock({ kind, context, newId: () => "t" })) {
          for (const slot of day.slots.filter((item) => !item.id.endsWith("_care"))) {
            slots += 1;
            const exercise = EXERCISE_GRAPH[slot.exerciseId]!;
            expect(exercise.standardsSource?.kind, slot.exerciseId).not.toBe("none");
            expect(exercise.standards, slot.exerciseId).toBeDefined();
          }
        }
      }
    }
    expect(slots).toBeGreaterThan(100);
  });

  it("a seed-day slot that holds a tierless move keeps the seed slot's dose", () => {
    const abs = TEMPLATE_BY_ID.tmpl_abs!;
    const slot = abs.slots[0]!;
    const day = { ...abs, slots: [{ ...slot, exerciseId: BIRD_DOG.id }, ...abs.slots.slice(1)] };
    const planned = planSession({ painJoints: [], sleepQuality: "good" }, templateToStarter(day), {}, { focus: day.focus });
    const item = planned.work.find((work) => work.exerciseId === BIRD_DOG.id)!;
    expect(item.dose).toEqual(slot.dose);
    expect(item.ruleIds).not.toContain("skill_dose");
  });

  it("dose, ladder tier and level raise tolerate no standards", () => {
    const dose = { sets: 3, reps: 8, targetRir: 2, addedLoadKg: 0 };
    const withBest = memory({ bestReps: 40, declaredTier: "advanced" });
    expect(applySkillDose(dose, BIRD_DOG, withBest)).toMatchObject({ dose, applied: false });
    expect(() => familyTier("core", ctx({ [BIRD_DOG.id]: withBest }))).not.toThrow();
    const abs = TEMPLATE_BY_ID.tmpl_abs!;
    const only = { ...abs, slots: [{ ...abs.slots[0]!, exerciseId: BIRD_DOG.id }] };
    // Nothing to gate on: a day of tierless moves never raises the plan level.
    expect(
      applyPlanLevelRaiseIfReady({ days: [only, only, only], memories: { [BIRD_DOG.id]: withBest }, currentLevel: "beginner" }),
    ).toEqual({ raised: false });
    expect(pickLevelAppropriateStep(BIRD_DOG.id, EXERCISE_GRAPH, "advanced")).toBeTypeOf("string");
  });

  it("the Library detail shows the move's own level, without a tier picker or standards strip", () => {
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
    expect(BIRD_DOG.difficulty).toBeDefined();
    expect(root.querySelector(".ex-tierless [data-move-level]")?.textContent).toBe(
      `Move level: ${SKILL_TIER_LABELS[BIRD_DOG.difficulty!]}`,
    );
    expect(root.querySelector(".ex-tierless [data-standards-source]")?.textContent).toBe(
      "No max-rep tiers: not a max-rep test. Dosed by sets, contacts or load.",
    );
    expect(root.querySelector(".ex-tierless")?.textContent).not.toMatch(/\d/);
  });

  it("the Library detail shows where a band comes from", () => {
    const root = document.createElement("div");
    mountLibraryDetail(root, {
      exercise: exerciseNamed("Ring Row"),
      catalogueById: EXERCISE_GRAPH,
      scrollToTop: false,
      actions: { onBack: () => {}, onOpenExercise: () => {} },
    });
    expect(root.querySelector(".ex-standards [data-standards-source]")?.textContent).toBe("Band: Row family band (bent-knee row norms)");
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
