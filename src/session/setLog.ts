import type { StopReason } from "../domain/types";

/** Prefill when the athlete turns on optional added load for a set. */
export const DEFAULT_ADDED_LOAD_KG = 12;

export interface SetLogEntry {
  readonly id: string;
  readonly slotId: string;
  readonly exerciseId: string;
  readonly setIndex: number;
  readonly prescribedReps: number;
  readonly completedReps: number;
  readonly addedLoadKg: number;
  readonly stopReason: StopReason;
  readonly loggedAt: string;
  /** Elapsed work time for this set (rep sets); omitted on skip. */
  readonly durationSeconds?: number;
}

export interface ActiveWorkState {
  slotId: string;
  exerciseId: string;
  setIndex: number;
  prescribedReps: number;
  addedLoadKg: number;
  nextRepsOverride?: number;
  /** When this work screen opened (rep-set duration clock). */
  setStartedAtMs?: number;
}

export interface WorkoutLog {
  entries: readonly SetLogEntry[];
}

export function createEmptyLog(): WorkoutLog {
  return { entries: [] };
}

export function appendSet(
  log: WorkoutLog,
  entry: Omit<SetLogEntry, "id" | "loggedAt"> & { id?: string; loggedAt?: string },
): WorkoutLog {
  assertAppendable(entry);
  const { id, loggedAt, ...fields } = entry;
  const next: SetLogEntry = Object.freeze({
    ...fields,
    id: id ?? `set_${log.entries.length + 1}_${entry.slotId}`,
    loggedAt: loggedAt ?? new Date().toISOString(),
  });
  return { entries: [...log.entries, next] };
}

export function editNextReps(state: ActiveWorkState, reps: number): ActiveWorkState {
  assertPositiveInteger(reps, "Next reps must be a positive integer");
  return { ...state, nextRepsOverride: reps, prescribedReps: reps };
}

/** Optional added load for the set about to be logged (kg). Zero means no weight. */
export function editAddedLoad(state: ActiveWorkState, kg: number): ActiveWorkState {
  assertNonNegativeFinite(kg, "addedLoadKg must be a non-negative finite number");
  return { ...state, addedLoadKg: kg };
}

/**
 * After a completed/failed set, prepare work state for the next set of the same
 * exercise: reps stick to what was just logged; added load does not.
 */
export function workStateAfterLoggedSet(
  state: ActiveWorkState,
  nextSetIndex: number,
  loggedReps: number,
): ActiveWorkState {
  assertPositiveInteger(nextSetIndex, "setIndex must be >= 1");
  assertPositiveInteger(loggedReps, "logged reps must be a positive integer");
  return {
    ...state,
    setIndex: nextSetIndex,
    prescribedReps: loggedReps,
    nextRepsOverride: loggedReps,
    addedLoadKg: 0,
  };
}

export function prescribedForNextSet(state: ActiveWorkState): number {
  return state.nextRepsOverride ?? state.prescribedReps;
}

export function assertLogImmutable(log: WorkoutLog): void {
  for (const entry of log.entries) {
    if (!Object.isFrozen(entry)) {
      throw new Error(`Set log entry ${entry.id} is mutable; logged sets must be frozen`);
    }
  }
}

function assertPositiveInteger(value: number, message: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${message}; got ${value}`);
  }
}

function assertNonNegativeFinite(value: number, message: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${message}; got ${value}`);
  }
}

function assertAppendable(
  entry: Omit<SetLogEntry, "id" | "loggedAt"> & { id?: string; loggedAt?: string },
): void {
  assertPositiveInteger(entry.setIndex, "setIndex must be >= 1");
  assertPositiveInteger(entry.prescribedReps, "prescribedReps must be >= 1");
  assertNonNegativeFinite(entry.completedReps, "completedReps must be >= 0");
  if (entry.durationSeconds !== undefined) {
    assertNonNegativeFinite(entry.durationSeconds, "durationSeconds must be >= 0");
    if (!Number.isInteger(entry.durationSeconds)) {
      throw new Error(`durationSeconds must be a whole number; got ${entry.durationSeconds}`);
    }
  }
}
