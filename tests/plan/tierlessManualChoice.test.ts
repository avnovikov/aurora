import { describe, expect, it } from "vitest";
import { EXERCISE_GRAPH, isChoosable, isPlannable, requireExercise } from "../../src/data/exerciseGraph";
import { LIBRARY_CATALOGUE } from "../../src/data/libraryCatalogue";
import { DEFAULT_PLAN_QUEUE, TEMPLATE_BY_ID, templateToStarter } from "../../src/data/seed";
import { pathPreviousBand, type PathStep } from "../../src/data/enrich/pathPrevious";
import { describeStandardsSource } from "../../src/library/levelSource";
import { addBlockToPlan } from "../../src/plan/blockActions";
import { excludeFromDay, setDayExercise, swapChoices } from "../../src/plan/dayEdits";
import type { AthleteState } from "../../src/plan/dayPreview";
import { addExerciseToPlanDay } from "../../src/plan/pathPlanActions";
import { getPlanDay } from "../../src/plan/planDays";
import { loadPlanQueue, savePlanQueue } from "../../src/plan/queue";
import { resolveTemplate } from "../../src/plan/templates";
import { planSession } from "../../src/rules/planSession";
import { substitutesFor } from "../../src/safety/suitableExercise";
import { replaceWorkMove } from "../../src/ui/sessionWorkAdjust";
import { useMemoryStorage } from "../helpers/storage";

/** Tierless (not a max-rep test) hinge moves on the glute ladder, bodyweight only. */
const FIRE_HYDRANT = requireExercise("ntc_fire_hydrant");
const TIERLESS = (id: string) => EXERCISE_GRAPH[id]?.standardsSource?.kind === "none";

const state = (over: Partial<AthleteState> = {}): AthleteState => ({
  memories: {},
  history: [],
  jointHistory: [],
  equipment: ["body", "bar"],
  excluded: [],
  deloadActive: false,
  ...over,
});
const good = { painJoints: [], sleepQuality: "good" as const };

useMemoryStorage(() => ({ "aurora.poc.planQueue.v1": JSON.stringify(DEFAULT_PLAN_QUEUE) }));

describe("tierless moves chosen by hand (#262)", () => {
  it("are choosable but never plannable", () => {
    expect(FIRE_HYDRANT.standardsSource?.kind).toBe("none");
    expect(isPlannable(FIRE_HYDRANT)).toBe(false);
    expect(isChoosable(FIRE_HYDRANT)).toBe(true);
  });

  it("Swap offers tierless moves; Aurora's own substitutes never include them", () => {
    const picks = swapChoices("glute_bridge", state()).map((exercise) => exercise.id);
    expect(picks).toContain(FIRE_HYDRANT.id);
    const auto = substitutesFor(requireExercise("glute_bridge"), [], ["body", "bar"]);
    expect(auto.some((exercise) => TIERLESS(exercise.id))).toBe(false);
  });

  it("Not for me puts a plannable move in the slot, never a tierless one", () => {
    const legs = resolveTemplate("tmpl_legs");
    const slot = legs.slots.find((item) => item.pattern === "hinge") ?? legs.slots[0]!;
    const result = excludeFromDay({ templateId: legs.id, slotId: slot.id, exerciseId: slot.exerciseId, state: state() });
    const now = resolveTemplate(legs.id).slots.find((item) => item.id === slot.id)!.exerciseId;
    expect(result.substituteName).toBeDefined();
    expect(TIERLESS(now)).toBe(false);
  });

  it("a generated-day swap keeps the slot's existing dose", () => {
    const { days, queue } = addBlockToPlan({ kind: "lower", context: state(), queue: loadPlanQueue(), index: 0, count: 1, newId: () => "m" });
    savePlanQueue(queue);
    const day = days[0]!;
    const slot = day.slots.find((item) => swapChoices(item.exerciseId, state()).some((exercise) => TIERLESS(exercise.id)))!;
    const pick = swapChoices(slot.exerciseId, state()).find((exercise) => TIERLESS(exercise.id))!;
    setDayExercise(day.id, slot.id, pick.id);
    const stored = getPlanDay(day.id)!;
    const planned = planSession(good, templateToStarter(stored), {}, { focus: stored.focus, equipment: ["body", "bar"] });
    const item = planned.work.find((work) => work.slotId === slot.id)!;
    expect(item.exerciseId).toBe(pick.id);
    expect(item.dose).toEqual(slot.dose);
  });

  it("a session swap keeps the live item's dose", () => {
    const legs = TEMPLATE_BY_ID.tmpl_legs!;
    const planned = planSession(good, templateToStarter(legs), {}, { focus: legs.focus });
    const item = planned.work[0]!;
    const next = replaceWorkMove(item, FIRE_HYDRANT.id, { planned, workIndex: 0, athlete: state() });
    expect(next.exerciseId).toBe(FIRE_HYDRANT.id);
    expect(next.dose).toEqual(item.dose);
  });

  it("Library Add to the plan puts a tierless move in a seed day, at the seed slot's dose", () => {
    expect(FIRE_HYDRANT.easierId ?? FIRE_HYDRANT.harderId).toBeDefined();
    const result = addExerciseToPlanDay({ templateId: "tmpl_legs", exercise: FIRE_HYDRANT, random: () => 0 });
    expect(result.exerciseId).toBe(FIRE_HYDRANT.id);
    const seedSlot = TEMPLATE_BY_ID.tmpl_legs!.slots.find((slot) => slot.id === result.slotId)!;
    const resolved = resolveTemplate("tmpl_legs");
    const planned = planSession(good, templateToStarter(resolved), {}, { focus: resolved.focus });
    const item = planned.work.find((work) => work.slotId === result.slotId)!;
    expect(item.exerciseId).toBe(FIRE_HYDRANT.id);
    expect(item.dose).toEqual(seedSlot.dose);
  });
});

describe("a tierless skill-path move takes the previous level's band (#262, user decision 8)", () => {
  const band = (elite: number) => ({ novice: 1, beginner: 2, intermediate: 4, advanced: 8, elite });
  const byId = (...steps: PathStep[]) => new Map(steps.map((step) => [step.id, step]));

  it("copies the previous step's band when both count the same thing, labelled with that step", () => {
    const tuck: PathStep = { id: "a", name: "Tuck Hold", effort: "hold", standards: band(30) };
    const top: PathStep = { id: "b", name: "Full Hold", effort: "hold", easierId: "a" };
    expect(pathPreviousBand(top, byId(tuck, top))).toEqual({
      standards: band(30),
      source: { kind: "path_previous", label: "Same as previous level: Tuck Hold" },
      previousId: "a",
    });
  });

  it("the Library shows the label as it is", () => {
    expect(describeStandardsSource({ kind: "path_previous", label: "Same as previous level: Tuck Hold" })).toBe(
      "Same as previous level: Tuck Hold",
    );
  });

  it("guard 1: walks past a step of the other effort to the nearest same-effort step, else stays excluded", () => {
    const reps: PathStep = { id: "a", name: "Pull-Up", effort: "reps", standards: band(18) };
    const hold: PathStep = { id: "b", name: "Tuck Hold", effort: "hold", standards: band(30), easierId: "a" };
    const top: PathStep = { id: "c", name: "Skill", effort: "reps", easierId: "b" };
    expect(pathPreviousBand(top, byId(reps, hold, top))).toMatchObject({ previousId: "a", standards: band(18) });
    const onlyHold: PathStep = { ...hold, easierId: undefined };
    expect(pathPreviousBand(top, byId(onlyHold, top))).toEqual({ excluded: "no_previous_same_effort" });
    expect(pathPreviousBand({ id: "d", name: "First", effort: "reps" }, byId())).toEqual({ excluded: "no_previous_same_effort" });
  });

  it("guard 2: never copies a band in the hundreds", () => {
    const big: PathStep = { id: "a", name: "Plank", effort: "hold", standards: band(120) };
    const top: PathStep = { id: "b", name: "Skill", effort: "hold", easierId: "a" };
    expect(pathPreviousBand(top, byId(big, top))).toEqual({ excluded: "elite_in_hundreds", previousId: "a" });
  });

  it("guard 3: moves that have a band keep it (the muscle-up keeps 1/2/6/12/15)", () => {
    const muscleUp = requireExercise("muscle_up");
    expect(muscleUp.standards).toEqual({ novice: 1, beginner: 2, intermediate: 6, advanced: 12, elite: 15 });
    expect(muscleUp.standardsSource?.kind).not.toBe("path_previous");
  });

  it("in the catalogue: Skin the Cat, the only tierless skill-path move, starts its path and stays tierless", () => {
    const skinTheCat = requireExercise("hf_60");
    expect(skinTheCat.standardsSource?.kind).toBe("none");
    expect(skinTheCat.easierId).toBeUndefined();
    expect(isPlannable(skinTheCat)).toBe(false);
    expect(LIBRARY_CATALOGUE.filter((exercise) => exercise.standardsSource?.kind === "path_previous")).toEqual([]);
  });
});
