import { EXERCISE_GRAPH, requireExercise } from "../data/exerciseGraph";
import type { Readiness } from "../domain/types";
import {
  easierChoice,
  easierInDay,
  excludeFromDay,
  setDayExercise,
  type ExcludeUndo,
} from "../plan/dayEdits";
import type { AthleteState } from "../plan/dayPreview";
import { displayExerciseName } from "../library/displayName";
import { emptyMemory } from "../session/history";
import type { PlannedSession, PlannedWorkItem } from "../rules/planSession";
import { resolveSlot } from "../rules/resolveSlot";
import { resolveTemplate } from "../plan/templates";

/** Other work moves in this session (exclude the slot being adjusted). */
export function dayExerciseIds(planned: PlannedSession, workIndex: number): string[] {
  if (workIndex < 0 || workIndex >= planned.work.length) {
    throw new Error(`workIndex out of range: ${workIndex}`);
  }
  return planned.work.filter((_, index) => index !== workIndex).map((item) => item.exerciseId);
}

export function easierAvailable(
  planned: PlannedSession,
  workIndex: number,
  athlete: AthleteState,
): boolean {
  const item = planned.work[workIndex];
  if (!item) {
    return false;
  }
  return easierChoice(item.exerciseId, athlete, dayExerciseIds(planned, workIndex)) !== undefined;
}

/**
 * Rebuild a live work item for a different move. Keeps the slot identity and
 * starts from the previous dose, pinned so mid-session adjust does not ladder-advance.
 */
export function replaceWorkMove(
  item: PlannedWorkItem,
  exerciseId: string,
  readiness: Readiness,
  deloadActive: boolean,
): PlannedWorkItem {
  const exercise = requireExercise(exerciseId);
  const resolved = resolveSlot({
    exercise,
    memory: emptyMemory(exerciseId),
    readiness,
    dose: { ...item.dose },
    pinned: true,
    weakLinks: [],
    graph: EXERCISE_GRAPH,
    deloadActive,
  });
  const chosen = requireExercise(resolved.exerciseId);
  return {
    slotId: item.slotId,
    label: item.label,
    exerciseId: chosen.id,
    exerciseName: chosen.name,
    dose: resolved.dose,
    restSeconds: item.restSeconds,
    ruleIds: resolved.ruleIds,
    reason: resolved.reason,
    doodlePath: chosen.doodlePath,
    cues: chosen.cues,
    summary: chosen.description,
    steps: chosen.steps,
    cautions: chosen.cautions ?? [],
  };
}

export interface WorkAdjustInput {
  planned: PlannedSession;
  workIndex: number;
  athlete: AthleteState;
}

export interface WorkAdjustResult {
  planned: PlannedSession;
  status: string;
  finishExercise: boolean;
  undo?: ExcludeUndo;
  /** Live item before Never again, for session Undo when still on this slot. */
  previousItem?: PlannedWorkItem;
}

function currentItem(input: WorkAdjustInput): PlannedWorkItem {
  const item = input.planned.work[input.workIndex];
  if (!item) {
    throw new Error(`No work item at index ${input.workIndex}`);
  }
  return item;
}

function withReplacedItem(
  planned: PlannedSession,
  workIndex: number,
  next: PlannedWorkItem,
): PlannedSession {
  const work = planned.work.map((item, index) => (index === workIndex ? next : item));
  return { ...planned, work };
}

function slotExerciseAfterEdit(templateId: string, slotId: string): string {
  const slot = resolveTemplate(templateId).slots.find((row) => row.id === slotId);
  if (!slot) {
    throw new Error(`Unknown slot ${slotId} on ${templateId}`);
  }
  return slot.exerciseId;
}

export function applyEasierWork(input: WorkAdjustInput): WorkAdjustResult {
  const item = currentItem(input);
  const ids = dayExerciseIds(input.planned, input.workIndex);
  const names = easierInDay({
    templateId: input.planned.programId,
    slotId: item.slotId,
    exerciseId: item.exerciseId,
    state: input.athlete,
    dayExerciseIds: ids,
  });
  const nextId = slotExerciseAfterEdit(input.planned.programId, item.slotId);
  const next = replaceWorkMove(item, nextId, input.planned.readiness, input.planned.deload);
  return {
    planned: withReplacedItem(input.planned, input.workIndex, next),
    status: `Easier: ${names.fromName} → ${names.toName}`,
    finishExercise: false,
  };
}

export function applySwapWork(input: WorkAdjustInput, pickId: string): WorkAdjustResult {
  const item = currentItem(input);
  requireExercise(pickId);
  setDayExercise(input.planned.programId, item.slotId, pickId);
  const next = replaceWorkMove(item, pickId, input.planned.readiness, input.planned.deload);
  return {
    planned: withReplacedItem(input.planned, input.workIndex, next),
    status: `Swapped to ${displayExerciseName(next.exerciseName)}`,
    finishExercise: false,
  };
}

export function applySkipToday(): Pick<WorkAdjustResult, "status" | "finishExercise"> {
  return { status: "Skipped for today", finishExercise: true };
}

export function applyNeverAgainWork(input: WorkAdjustInput): WorkAdjustResult {
  const item = currentItem(input);
  const previousItem = item;
  const result = excludeFromDay({
    templateId: input.planned.programId,
    slotId: item.slotId,
    exerciseId: item.exerciseId,
    state: input.athlete,
    dayExerciseIds: dayExerciseIds(input.planned, input.workIndex),
  });
  const nextId = slotExerciseAfterEdit(input.planned.programId, item.slotId);
  if (!result.substituteName || nextId === item.exerciseId) {
    return {
      planned: input.planned,
      status: `Excluded: ${result.excludedName}. No substitute fits.`,
      finishExercise: true,
      undo: result.undo,
      previousItem,
    };
  }
  const next = replaceWorkMove(item, nextId, input.planned.readiness, input.planned.deload);
  return {
    planned: withReplacedItem(input.planned, input.workIndex, next),
    status: `Excluded: ${result.excludedName}. Now: ${result.substituteName}.`,
    finishExercise: false,
    undo: result.undo,
    previousItem,
  };
}
