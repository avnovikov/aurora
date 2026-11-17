import { EXERCISE_GRAPH, requireExercise } from "../data/exerciseGraph";
import { displayExerciseName } from "../library/displayName";
import {
  easierChoice,
  easierInDay,
  excludeFromDay,
  setDayExercise,
  type ExcludeUndo,
} from "../plan/dayEdits";
import type { AthleteState } from "../plan/dayPreview";
import { resolveTemplate } from "../plan/templates";
import type { PlannedSession, PlannedWorkItem } from "../rules/planSession";
import { resolveSlot } from "../rules/resolveSlot";
import { applySkillDose } from "../rules/skillDose";
import { emptyMemory } from "../session/history";

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

/** Other work moves in this session (exclude the slot being adjusted). */
export function dayExerciseIds(planned: PlannedSession, workIndex: number): string[] {
  if (workIndex < 0 || workIndex >= planned.work.length) {
    throw new Error(`workIndex out of range: ${workIndex}`);
  }
  return planned.work.filter((_, index) => index !== workIndex).map((item) => item.exerciseId);
}

export function easierAvailable(input: WorkAdjustInput): boolean {
  const item = input.planned.work[input.workIndex];
  if (!item) {
    return false;
  }
  return easierChoice(item.exerciseId, input.athlete, dayExerciseIds(input.planned, input.workIndex)) !== undefined;
}

/**
 * Rebuild a live work item for a different move. Keeps the slot identity; doses
 * from library standards + athlete memory; pinned so adjust does not ladder-advance.
 */
export function replaceWorkMove(
  item: PlannedWorkItem,
  exerciseId: string,
  input: WorkAdjustInput,
): PlannedWorkItem {
  const exercise = requireExercise(exerciseId);
  const memory = input.athlete.memories[exerciseId] ?? emptyMemory(exerciseId);
  const skilled = applySkillDose({ ...item.dose }, exercise, memory);
  const resolved = resolveSlot({
    exercise,
    memory,
    readiness: input.planned.readiness,
    dose: skilled.dose,
    pinned: true,
    weakLinks: [],
    graph: EXERCISE_GRAPH,
    deloadActive: input.planned.deload,
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

/** Args shared by every Plan dayEdit for the current live work row. */
function dayEditArgs(input: WorkAdjustInput, item: PlannedWorkItem) {
  return {
    templateId: input.planned.programId,
    slotId: item.slotId,
    exerciseId: item.exerciseId,
    state: input.athlete,
    dayExerciseIds: dayExerciseIds(input.planned, input.workIndex),
  };
}

/** Rewrite the live work row after a Plan dayEdit changed the slot's exercise. */
function replaceLiveItem(
  input: WorkAdjustInput,
  item: PlannedWorkItem,
  exerciseId: string,
): { planned: PlannedSession; next: PlannedWorkItem } {
  const next = replaceWorkMove(item, exerciseId, input);
  return {
    planned: withReplacedItem(input.planned, input.workIndex, next),
    next,
  };
}

function slotExerciseAfterEdit(templateId: string, slotId: string): string {
  const slot = resolveTemplate(templateId).slots.find((row) => row.id === slotId);
  if (!slot) {
    throw new Error(`Unknown slot ${slotId} on ${templateId}`);
  }
  return slot.exerciseId;
}

function resultAfterPlanEdit(
  input: WorkAdjustInput,
  item: PlannedWorkItem,
  status: string,
): WorkAdjustResult {
  const nextId = slotExerciseAfterEdit(input.planned.programId, item.slotId);
  return {
    planned: replaceLiveItem(input, item, nextId).planned,
    status,
    finishExercise: false,
  };
}

export function applyEasierWork(input: WorkAdjustInput): WorkAdjustResult {
  const item = currentItem(input);
  const names = easierInDay(dayEditArgs(input, item));
  return resultAfterPlanEdit(input, item, `Easier: ${names.fromName} → ${names.toName}`);
}

export function applySwapWork(input: WorkAdjustInput, pickId: string): WorkAdjustResult {
  const item = currentItem(input);
  requireExercise(pickId);
  setDayExercise(input.planned.programId, item.slotId, pickId);
  const { planned, next } = replaceLiveItem(input, item, pickId);
  return {
    planned,
    status: `Swapped to ${displayExerciseName(next.exerciseName)}`,
    finishExercise: false,
  };
}

export function applySkipToday(): Pick<WorkAdjustResult, "status" | "finishExercise"> {
  return { status: "Skipped for today", finishExercise: true };
}

export function applyNeverAgainWork(input: WorkAdjustInput): WorkAdjustResult {
  const item = currentItem(input);
  const result = excludeFromDay(dayEditArgs(input, item));
  const nextId = slotExerciseAfterEdit(input.planned.programId, item.slotId);
  if (!result.substituteName || nextId === item.exerciseId) {
    return {
      planned: input.planned,
      status: `Excluded: ${result.excludedName}. No substitute fits.`,
      finishExercise: true,
      undo: result.undo,
      previousItem: item,
    };
  }
  return {
    ...resultAfterPlanEdit(input, item, `Excluded: ${result.excludedName}. Now: ${result.substituteName}.`),
    undo: result.undo,
    previousItem: item,
  };
}
