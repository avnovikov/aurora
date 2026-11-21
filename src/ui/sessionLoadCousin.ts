import { EXERCISE_GRAPH, requireExercise } from "../data/exerciseGraph";
import type { EquipmentId } from "../domain/program";
import { setDayExercise } from "../plan/dayEdits";
import type { AthleteState } from "../plan/dayPreview";
import type { PlannedSession, PlannedWorkItem } from "../rules/planSession";
import { editAddedLoad, type ActiveWorkState } from "../session/setLog";
import { missingGear } from "../safety/gear";
import { replaceWorkMove, type WorkAdjustInput } from "./sessionWorkAdjust";
import type { ViewState } from "./sessionTypes";
import { currentWork } from "./sessionState";

/**
 * Cousin-swap only: kettlebell satisfies dumbbell twins. Library/plan gear stay
 * strict — do not reuse this expansion outside Add-weight cousin checks.
 */
function equipmentForCousinTwin(
  equipment: readonly EquipmentId[],
): readonly EquipmentId[] {
  if (equipment.includes("kettlebell") && !equipment.includes("dumbbell")) {
    return [...equipment, "dumbbell"];
  }
  return equipment;
}

function athleteOwnsGearFor(exerciseId: string, athlete: AthleteState): boolean {
  const exercise = EXERCISE_GRAPH[exerciseId];
  if (exercise === undefined) {
    return false;
  }
  const effectiveGear = equipmentForCousinTwin(athlete.equipment);
  return missingGear(exercise, effectiveGear).length === 0;
}

function replaceLiveWorkItem(
  planned: PlannedSession,
  workIndex: number,
  next: PlannedWorkItem,
): PlannedSession {
  return {
    ...planned,
    work: planned.work.map((item, index) => (index === workIndex ? next : item)),
  };
}

function workStateForMovedItem(
  prior: ActiveWorkState,
  nextItem: PlannedWorkItem,
  kg: number,
  loadSwapFromId?: string,
): ActiveWorkState {
  const next: ActiveWorkState = {
    ...editAddedLoad(prior, kg),
    slotId: nextItem.slotId,
    exerciseId: nextItem.exerciseId,
    prescribedReps: nextItem.dose.reps,
  };
  if (loadSwapFromId) {
    next.loadSwapFromId = loadSwapFromId;
  } else {
    delete next.loadSwapFromId;
  }
  return next;
}

/** Plan write + live rewrite for a cousin swap or restore. */
function swapLiveExercise(
  planned: PlannedSession,
  item: PlannedWorkItem,
  input: WorkAdjustInput,
  nextExerciseId: string,
): { planned: PlannedSession; nextItem: PlannedWorkItem } {
  requireExercise(nextExerciseId);
  setDayExercise(planned.programId, item.slotId, nextExerciseId);
  const nextItem = replaceWorkMove(item, nextExerciseId, input);
  return {
    planned: replaceLiveWorkItem(planned, input.workIndex, nextItem),
    nextItem,
  };
}

function shouldSwapToWeightedTwin(work: ActiveWorkState, kg: number): boolean {
  return kg > 0 && work.addedLoadKg <= 0 && work.loadSwapFromId === undefined;
}

function shouldRestoreUnweighted(work: ActiveWorkState, kg: number): boolean {
  return kg === 0 && work.loadSwapFromId !== undefined;
}

/**
 * Apply a new added-load kg on the live work set. When crossing 0→load with a
 * curated twin the athlete can use, swap live + Plan; when returning to 0 with
 * `loadSwapFromId`, restore the unweighted move.
 */
export function applyAddedLoadChange(
  planned: PlannedSession,
  state: ViewState,
  nextKg: number,
  athlete: AthleteState,
): PlannedSession {
  if (!state.workState || state.phase !== "work") {
    return planned;
  }
  const item = currentWork(planned, state);
  if (!item) {
    return planned;
  }

  const kg = Math.max(0, nextKg);
  const work = state.workState;
  const input: WorkAdjustInput = {
    planned,
    workIndex: state.workIndex,
    athlete,
  };

  if (shouldSwapToWeightedTwin(work, kg)) {
    const twinId = EXERCISE_GRAPH[item.exerciseId]?.weightedId;
    if (twinId && athleteOwnsGearFor(twinId, athlete)) {
      const swapped = swapLiveExercise(planned, item, input, twinId);
      state.workState = workStateForMovedItem(work, swapped.nextItem, kg, item.exerciseId);
      return swapped.planned;
    }
  }

  if (shouldRestoreUnweighted(work, kg)) {
    const fromId = work.loadSwapFromId!;
    const restored = swapLiveExercise(planned, item, input, fromId);
    state.workState = workStateForMovedItem(work, restored.nextItem, 0);
    return restored.planned;
  }

  state.workState = editAddedLoad(work, kg);
  return planned;
}
