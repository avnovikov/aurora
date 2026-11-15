import { EXERCISE_GRAPH } from "../data/exerciseGraph";
import type { SeedExercise } from "../data/seed";
import type { PlanQueue } from "../domain/program";
import { substitutesFor } from "../safety/suitableExercise";
import { addBlockToPlan } from "./blockActions";
import type { AthleteState } from "./dayPreview";
import { excludeExercise } from "./exclusions";
import type { BlockKind } from "./generateBlock";
import { getPlanDay, replaceDaySlotExercise } from "./planDays";
import { setSlotExercise } from "./templates";

const SWAP_CHOICES = 8;

function requireExercise(exerciseId: string): SeedExercise {
  const exercise = EXERCISE_GRAPH[exerciseId];
  if (!exercise) {
    throw new Error(`Unknown exercise: ${exerciseId}`);
  }
  return exercise;
}

/** Moves offered when swapping one out, best first (same ladder, nearest level, never harder first). */
export function swapChoices(exerciseId: string, state: AthleteState, dayExerciseIds: readonly string[] = []): SeedExercise[] {
  return substitutesFor(requireExercise(exerciseId), state.jointHistory, state.equipment, state.excluded)
    .filter((candidate) => !dayExerciseIds.includes(candidate.id))
    .slice(0, SWAP_CHOICES);
}

/** Point a day's slot at another exercise: a generated day directly, a seed day through its saved edits. */
export function setDayExercise(templateId: string, slotId: string, exerciseId: string): void {
  requireExercise(exerciseId);
  if (getPlanDay(templateId)) {
    replaceDaySlotExercise(templateId, slotId, exerciseId);
    return;
  }
  setSlotExercise(templateId, slotId, exerciseId);
}

export interface ExcludeResult {
  excludedName: string;
  /** The move now in the slot; undefined when nothing suitable exists. */
  substituteName?: string;
}

/**
 * "Not for me": the move joins the exclusion list (so it is never planned
 * again, anywhere) and the day's slot takes the best substitute now.
 */
export function excludeFromDay(input: {
  templateId: string;
  slotId: string;
  exerciseId: string;
  state: AthleteState;
  dayExerciseIds?: readonly string[];
}): ExcludeResult {
  const exercise = requireExercise(input.exerciseId);
  const excluded = excludeExercise(exercise.id);
  const substitute = swapChoices(exercise.id, { ...input.state, excluded }, input.dayExerciseIds)[0];
  if (substitute) {
    setDayExercise(input.templateId, input.slotId, substitute.id);
  }
  return { excludedName: exercise.name, substituteName: substitute?.name };
}

/**
 * Turn the day at `index` into a new block of `kind`: its first day takes
 * that position, the others are spaced after it. The day that was there is
 * dropped from the queue.
 */
export function makeDay(input: {
  queue: PlanQueue;
  index: number;
  kind: BlockKind;
  target?: string;
  state: AthleteState;
  newId?: () => string;
}): PlanQueue {
  const { queue, index } = input;
  if (!Number.isInteger(index) || index < 0 || index >= queue.items.length) {
    throw new Error(`queue index out of range: ${index}`);
  }
  const without = { items: queue.items.filter((_, i) => i !== index) };
  return addBlockToPlan({
    kind: input.kind,
    target: input.target,
    context: input.state,
    queue: without,
    index,
    newId: input.newId,
  }).queue;
}
