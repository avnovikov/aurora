import { EXERCISE_GRAPH, requireExercise } from "../data/exerciseGraph";
import type { SeedExercise } from "../data/seed";
import type { PlanQueue } from "../domain/program";
import { libraryFamilyLadderIndex } from "../progress/familyLadderIndex";
import { shouldAdvanceProgression } from "../rules/skillDose";
import { substitutesFor } from "../safety/suitableExercise";
import { emptyMemory } from "../session/history";
import { addBlockToPlan } from "./blockActions";
import type { AthleteState } from "./dayPreview";
import { excludeExercise, loadExcluded, restoreExercise } from "./exclusions";
import type { BlockKind } from "./generateBlock";
import { canBeGiven, easierStep, familyOf } from "./ladderSteps";
import { getPlanDay, replaceDaySlotExercise } from "./planDays";
import { clearSlotExercise, setSlotExercise, slotExerciseOverride } from "./templates";

const SWAP_CHOICES = 8;

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

/** How one slot was stored before an edit: a generated day's move, or a seed day's saved edit (if any). */
interface StoredSlot {
  templateId: string;
  slotId: string;
  generated: boolean;
  /** For a seed day, undefined means "no saved edit: the seed move". */
  exerciseId: string | undefined;
}

function storedSlot(templateId: string, slotId: string): StoredSlot {
  const day = getPlanDay(templateId);
  if (day) {
    return { templateId, slotId, generated: true, exerciseId: day.slots.find((slot) => slot.id === slotId)?.exerciseId };
  }
  return { templateId, slotId, generated: false, exerciseId: slotExerciseOverride(templateId, slotId) };
}

function restoreSlot(saved: StoredSlot): void {
  if (saved.generated) {
    if (saved.exerciseId) {
      replaceDaySlotExercise(saved.templateId, saved.slotId, saved.exerciseId);
    }
    return;
  }
  if (saved.exerciseId) {
    setSlotExercise(saved.templateId, saved.slotId, saved.exerciseId);
  } else {
    clearSlotExercise(saved.templateId, saved.slotId);
  }
}

/** Everything "Not for me" changed, so it can be put back exactly. */
export interface ExcludeUndo {
  exerciseId: string;
  /** Whether the move was already on the exclusion list (then undo leaves it there). */
  wasExcluded: boolean;
  slot: StoredSlot;
}

export interface ExcludeResult {
  excludedName: string;
  /** The move now in the slot; undefined when nothing suitable exists. */
  substituteName?: string;
  undo: ExcludeUndo;
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
  const undo: ExcludeUndo = {
    exerciseId: exercise.id,
    wasExcluded: loadExcluded().includes(exercise.id),
    slot: storedSlot(input.templateId, input.slotId),
  };
  const excluded = excludeExercise(exercise.id);
  const substitute = swapChoices(exercise.id, { ...input.state, excluded }, input.dayExerciseIds)[0];
  if (substitute) {
    setDayExercise(input.templateId, input.slotId, substitute.id);
  }
  return { excludedName: exercise.name, substituteName: substitute?.name, undo };
}

/** The inverse of `excludeFromDay`: the move comes off the exclusion list and the slot is stored as it was. */
export function undoExclude(undo: ExcludeUndo): { restoredName: string } {
  if (!undo.wasExcluded) {
    restoreExercise(undo.exerciseId);
  }
  restoreSlot(undo.slot);
  return { restoredName: requireExercise(undo.exerciseId).name };
}

/**
 * Whether the planner would keep this move where it is put: a move whose
 * standard the athlete already meets is advanced to its harder step at
 * planning time (`shouldAdvanceProgression`), which would undo "Easier".
 */
function plannerKeeps(exercise: SeedExercise, state: AthleteState): boolean {
  return !shouldAdvanceProgression(exercise, state.memories[exercise.id] ?? emptyMemory(exercise.id));
}

/**
 * The move one step easier than `exerciseId` for this athlete: its own
 * "Easier" link (as the exercise page shows it, and as the planner's stall
 * rule regresses), else the ladder's step below it (`easierStep`, as the
 * block generator's B day uses). Only a move the athlete can be given, not
 * already in the day, that the planner would keep. Undefined: no easier step.
 */
export function easierChoice(
  exerciseId: string,
  state: AthleteState,
  dayExerciseIds: readonly string[] = [],
): SeedExercise | undefined {
  const exercise = requireExercise(exerciseId);
  const avoid = new Set([...dayExerciseIds, exercise.id]);
  const fits = (candidate: SeedExercise | undefined): candidate is SeedExercise =>
    candidate !== undefined && !avoid.has(candidate.id) && canBeGiven(candidate, state) && plannerKeeps(candidate, state);

  const linked = exercise.easierId ? EXERCISE_GRAPH[exercise.easierId] : undefined;
  if (fits(linked)) {
    return linked;
  }
  const family = familyOf(exerciseId);
  const placed = libraryFamilyLadderIndex().byId.get(exerciseId);
  if (!family || !placed) {
    return undefined;
  }
  const step = easierStep(family, { exercise, rank: placed.rank }, state, avoid)?.exercise;
  return fits(step) ? step : undefined;
}

/**
 * "Easier": the day's slot takes the move's easier step. Only the move
 * changes; its dose is the planner's, from the library standards and the
 * athlete's level, exactly as for any swap.
 */
export function easierInDay(input: {
  templateId: string;
  slotId: string;
  exerciseId: string;
  state: AthleteState;
  dayExerciseIds?: readonly string[];
}): { fromName: string; toName: string } {
  const from = requireExercise(input.exerciseId);
  const to = easierChoice(from.id, input.state, input.dayExerciseIds);
  if (!to) {
    throw new Error("No easier step");
  }
  setDayExercise(input.templateId, input.slotId, to.id);
  return { fromName: from.name, toName: to.name };
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
