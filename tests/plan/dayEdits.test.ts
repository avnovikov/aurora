import { describe, expect, it } from "vitest";
import { EXERCISE_GRAPH, requireExercise } from "../../src/data/exerciseGraph";
import { TEMPLATE_BY_ID } from "../../src/data/seed";
import type { ExerciseMemory } from "../../src/domain/types";
import { addBlockToPlan } from "../../src/plan/blockActions";
import { easierChoice, easierInDay, excludeFromDay, setDayExercise, undoExclude } from "../../src/plan/dayEdits";
import { previewDay, type AthleteState } from "../../src/plan/dayPreview";
import { excludeExercise, loadExcluded } from "../../src/plan/exclusions";
import { easierStep, familyOf } from "../../src/plan/ladderSteps";
import { getPlanDay, savePlanDays } from "../../src/plan/planDays";
import { loadPlanQueue, savePlanQueue } from "../../src/plan/queue";
import { resolveTemplate, slotExerciseOverride } from "../../src/plan/templates";
import { libraryFamilyLadderIndex } from "../../src/progress/familyLadderIndex";
import { applySkillDose } from "../../src/rules/skillDose";
import { emptyMemory } from "../../src/session/history";
import { useMemoryStorage } from "../helpers/storage";

const state = (over: Partial<AthleteState> = {}): AthleteState => ({
  memories: {},
  history: [],
  jointHistory: [],
  equipment: ["body", "bar"],
  excluded: [],
  deloadActive: false,
  ...over,
});
const legs = () => resolveTemplate("tmpl_legs");
const dayIds = (templateId: string, athlete: AthleteState) =>
  previewDay(resolveTemplate(templateId), athlete).map((item) => item.exerciseId);

/** The ladder's own easier step for a move, as the block generator would pick it. */
function ladderEasier(exerciseId: string, avoid: readonly string[] = []) {
  const family = familyOf(exerciseId)!;
  const rank = libraryFamilyLadderIndex().byId.get(exerciseId)!.rank;
  const ctx = { memories: {}, equipment: ["body", "bar"] as const, jointHistory: [], excluded: [] };
  return easierStep(family, { exercise: requireExercise(exerciseId), rank }, { ...ctx, equipment: [...ctx.equipment] }, new Set(avoid))
    ?.exercise;
}

useMemoryStorage();

describe("Easier", () => {
  it("takes the move's own Easier link, as the exercise page shows it", () => {
    const bulgarian = requireExercise("bulgarian_split");
    expect(easierChoice("bulgarian_split", state())?.id).toBe(bulgarian.easierId);
  });

  it("falls back to the ladder's easier step when the link is already in the day", () => {
    const pick = easierChoice("nordic_curl", state(), ["hip_hinge", "nordic_curl"]);
    expect(pick).toBeDefined();
    expect(pick!.id).toBe(ladderEasier("nordic_curl", ["hip_hinge", "nordic_curl"])!.id);
    expect(pick!.id).not.toBe("hip_hinge");
  });

  it("never offers a move the athlete has excluded", () => {
    const pick = easierChoice("bulgarian_split", state({ excluded: ["bodyweight_squat"] }));
    expect(pick?.id).not.toBe("bodyweight_squat");
    expect(pick?.id).toBe(ladderEasier("bulgarian_split")?.id);
  });

  it("has nothing for a move at the bottom of its ladder", () => {
    expect(easierChoice("hip_hinge", state())).toBeUndefined();
    expect(() =>
      easierInDay({ templateId: "tmpl_legs", slotId: "legs_hinge", exerciseId: "hip_hinge", state: state() }),
    ).toThrow("No easier step");
  });

  it("puts the easier move in that day's slot and names both moves", () => {
    const athlete = state();
    const result = easierInDay({
      templateId: "tmpl_legs",
      slotId: "legs_split",
      exerciseId: "bulgarian_split",
      state: athlete,
      dayExerciseIds: dayIds("tmpl_legs", athlete),
    });
    const slot = legs().slots.find((s) => s.id === "legs_split")!;
    expect(result.fromName).toBe("Bulgarian split squat");
    expect(result.toName).toBe(EXERCISE_GRAPH[slot.exerciseId]!.name);
    expect(slot.exerciseId).not.toBe("bulgarian_split");
    // Bodyweight squat is already the day's squat, so the ladder step is used.
    expect(slot.exerciseId).not.toBe("bodyweight_squat");
  });

  it("doses the easier move by the rules at the athlete's level, never by copying the old dose", () => {
    const athlete = state();
    const pick = easierChoice("bulgarian_split", athlete, dayIds("tmpl_legs", athlete))!;
    const memory: ExerciseMemory = { ...emptyMemory(pick.id), declaredTier: "intermediate" };
    const levelled = state({ memories: { [pick.id]: memory } });

    easierInDay({
      templateId: "tmpl_legs",
      slotId: "legs_split",
      exerciseId: "bulgarian_split",
      state: levelled,
      dayExerciseIds: dayIds("tmpl_legs", levelled),
    });

    const seedSlot = TEMPLATE_BY_ID.tmpl_legs!.slots.find((s) => s.id === "legs_split")!;
    const stored = legs().slots.find((s) => s.id === "legs_split")!;
    // The stored prescription is untouched: no reps or holds are written by Easier.
    expect(stored.dose).toEqual(seedSlot.dose);

    // What the day will show is the planner's dose for that move at the athlete's level.
    const rules = applySkillDose(seedSlot.dose, pick, memory).dose;
    const shown = previewDay(legs(), levelled).find((item) => item.slotId === "legs_split")!;
    expect(shown.exerciseId).toBe(pick.id);
    expect(shown.dose).toBe(`${rules.sets} × ${rules.reps}`);
    expect(rules.reps).not.toBe(seedSlot.dose.reps);

    // And it is exactly what a normal swap to that move gives.
    const swapped = { ...TEMPLATE_BY_ID.tmpl_legs!, slots: TEMPLATE_BY_ID.tmpl_legs!.slots.map((s) => (s.id === "legs_split" ? { ...s, exerciseId: pick.id } : s)) };
    expect(previewDay(swapped, levelled).find((item) => item.slotId === "legs_split")!.dose).toBe(shown.dose);
  });

  it("on a generated day, leaves the generator's stored dose alone", () => {
    const { days, queue } = addBlockToPlan({ kind: "lower", context: state(), queue: loadPlanQueue(), index: 0, count: 1, newId: () => "z" });
    savePlanQueue(queue);
    const day = days[0]!;
    const slot = day.slots.find((s) => easierChoice(s.exerciseId, state(), day.slots.map((x) => x.exerciseId)))!;
    easierInDay({ templateId: day.id, slotId: slot.id, exerciseId: slot.exerciseId, state: state(), dayExerciseIds: day.slots.map((s) => s.exerciseId) });
    const after = getPlanDay(day.id)!.slots.find((s) => s.id === slot.id)!;
    expect(after.exerciseId).not.toBe(slot.exerciseId);
    expect(after.dose).toEqual(slot.dose);
  });
});

describe("Not for me, undone", () => {
  it("on a seed day: the exclusion goes and the slot is stored exactly as before", () => {
    const before = legs();
    const result = excludeFromDay({ templateId: "tmpl_legs", slotId: "legs_posterior", exerciseId: "nordic_curl", state: state() });
    expect(loadExcluded()).toEqual(["nordic_curl"]);
    expect(slotExerciseOverride("tmpl_legs", "legs_posterior")).toBeDefined();

    const undone = undoExclude(result.undo);
    expect(undone.restoredName).toBe("Nordic curl");
    expect(loadExcluded()).toEqual([]);
    expect(slotExerciseOverride("tmpl_legs", "legs_posterior")).toBeUndefined();
    expect(legs()).toEqual(before);
  });

  it("keeps an earlier swap on that slot and other exclusions", () => {
    excludeExercise("pullup");
    setDayExercise("tmpl_legs", "legs_posterior", "nordic_curl");
    const result = excludeFromDay({ templateId: "tmpl_legs", slotId: "legs_posterior", exerciseId: "nordic_curl", state: state({ excluded: ["pullup"] }) });
    undoExclude(result.undo);
    expect(loadExcluded()).toEqual(["pullup"]);
    expect(slotExerciseOverride("tmpl_legs", "legs_posterior")).toBe("nordic_curl");
  });

  it("on a generated day: the day is stored exactly as before", () => {
    const { days, queue } = addBlockToPlan({ kind: "lower", context: state(), queue: loadPlanQueue(), index: 0, count: 1, newId: () => "u" });
    savePlanQueue(queue);
    savePlanDays(days);
    const day = getPlanDay(days[0]!.id)!;
    const slot = day.slots[0]!;
    const result = excludeFromDay({ templateId: day.id, slotId: slot.id, exerciseId: slot.exerciseId, state: state() });
    expect(getPlanDay(day.id)).not.toEqual(day);
    undoExclude(result.undo);
    expect(getPlanDay(day.id)).toEqual(day);
    expect(loadExcluded()).toEqual([]);
  });
});
