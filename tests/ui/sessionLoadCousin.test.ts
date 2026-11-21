import { describe, expect, it } from "vitest";
import { DEFAULT_PLAN_QUEUE, SESSION_TEMPLATES, templateToStarter } from "../../src/data/seed";
import { EXERCISE_GRAPH } from "../../src/data/exerciseGraph";
import type { Readiness } from "../../src/domain/types";
import { slotExerciseOverride } from "../../src/plan/templates";
import type { AthleteState } from "../../src/plan/dayPreview";
import { planSession, type PlannedSession } from "../../src/rules/planSession";
import { DEFAULT_ADDED_LOAD_KG } from "../../src/session/setLog";
import { applyAddedLoadChange } from "../../src/ui/sessionLoadCousin";
import { initialState } from "../../src/ui/sessionState";
import type { ViewState } from "../../src/ui/sessionTypes";
import { useMemoryStorage } from "../helpers/storage";

useMemoryStorage(() => ({ "aurora.poc.planQueue.v1": JSON.stringify(DEFAULT_PLAN_QUEUE) }));

const readiness: Readiness = { sleepQuality: "good", restingHrBpm: 58, painJoints: [] };

function athlete(equipment: AthleteState["equipment"] = ["body", "dumbbell"]): AthleteState {
  return {
    memories: {},
    history: [],
    jointHistory: [],
    equipment,
    excluded: [],
    deloadActive: false,
  };
}

function planWith(exerciseId: string): { planned: PlannedSession; state: ViewState } {
  const template = SESSION_TEMPLATES.find((item) => item.id === "tmpl_legs")!;
  const planned = planSession(readiness, templateToStarter(template), {});
  const index = 0;
  const item = planned.work[index]!;
  const twin = EXERCISE_GRAPH[exerciseId]?.weightedId;
  expect(twin, `expected weighted twin for ${exerciseId}`).toBeTruthy();
  // Force the live slot onto the unweighted cousin under test.
  planned.work = planned.work.map((work, i) =>
    i === index
      ? {
          ...work,
          exerciseId,
          exerciseName: EXERCISE_GRAPH[exerciseId]!.name,
        }
      : work,
  );
  const state = initialState({ planned, onDone: () => undefined, addWeightKg: DEFAULT_ADDED_LOAD_KG });
  state.phase = "work";
  state.warmupIndex = planned.warmup.length;
  state.workIndex = index;
  state.setIndex = 1;
  state.workState = {
    slotId: item.slotId,
    exerciseId,
    setIndex: 1,
    prescribedReps: item.dose.reps,
    addedLoadKg: 0,
  };
  return { planned, state };
}

describe("applyAddedLoadChange", () => {
  it("swaps to the weighted twin and writes the Plan slot when adding load", () => {
    const { planned, state } = planWith("hip_hinge");
    const twinId = EXERCISE_GRAPH.hip_hinge!.weightedId!;
    const next = applyAddedLoadChange(planned, state, DEFAULT_ADDED_LOAD_KG, athlete());
    expect(next.work[0]!.exerciseId).toBe(twinId);
    expect(state.workState?.exerciseId).toBe(twinId);
    expect(state.workState?.addedLoadKg).toBe(DEFAULT_ADDED_LOAD_KG);
    expect(state.workState?.loadSwapFromId).toBe("hip_hinge");
    expect(slotExerciseOverride(planned.programId, planned.work[0]!.slotId)).toBe(twinId);
  });

  it("restores the unweighted move when load returns to zero", () => {
    const { planned, state } = planWith("glute_bridge");
    let next = applyAddedLoadChange(planned, state, DEFAULT_ADDED_LOAD_KG, athlete());
    planned.work = next.work;
    next = applyAddedLoadChange(planned, state, 0, athlete());
    expect(next.work[0]!.exerciseId).toBe("glute_bridge");
    expect(state.workState?.exerciseId).toBe("glute_bridge");
    expect(state.workState?.addedLoadKg).toBe(0);
    expect(state.workState?.loadSwapFromId).toBeUndefined();
    expect(slotExerciseOverride(planned.programId, planned.work[0]!.slotId)).toBe("glute_bridge");
  });

  it("keeps sticky kg without swapping when the athlete lacks dumbbell gear", () => {
    const { planned, state } = planWith("hip_hinge");
    const next = applyAddedLoadChange(planned, state, DEFAULT_ADDED_LOAD_KG, athlete(["body"]));
    expect(next.work[0]!.exerciseId).toBe("hip_hinge");
    expect(state.workState?.addedLoadKg).toBe(DEFAULT_ADDED_LOAD_KG);
    expect(state.workState?.loadSwapFromId).toBeUndefined();
  });

  it("swaps step-up when the athlete has kettlebell only (orRequires)", () => {
    const { planned, state } = planWith("step_up");
    const twinId = EXERCISE_GRAPH.step_up!.weightedId!;
    const next = applyAddedLoadChange(planned, state, DEFAULT_ADDED_LOAD_KG, athlete(["body", "kettlebell"]));
    expect(next.work[0]!.exerciseId).toBe(twinId);
    expect(state.workState?.loadSwapFromId).toBe("step_up");
  });
});
