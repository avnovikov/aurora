import type { StopReason } from "../domain/types";

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
}

export interface ActiveWorkState {
  slotId: string;
  exerciseId: string;
  setIndex: number;
  prescribedReps: number;
  addedLoadKg: number;
  nextRepsOverride?: number;
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
  const next: SetLogEntry = {
    id: entry.id ?? `set_${log.entries.length + 1}_${entry.slotId}`,
    slotId: entry.slotId,
    exerciseId: entry.exerciseId,
    setIndex: entry.setIndex,
    prescribedReps: entry.prescribedReps,
    completedReps: entry.completedReps,
    addedLoadKg: entry.addedLoadKg,
    stopReason: entry.stopReason,
    loggedAt: entry.loggedAt ?? new Date().toISOString(),
  };
  return { entries: [...log.entries, Object.freeze(next)] };
}

export function editNextReps(state: ActiveWorkState, reps: number): ActiveWorkState {
  if (!Number.isInteger(reps) || reps < 1) {
    throw new Error(`Next reps must be a positive integer; got ${reps}`);
  }
  return { ...state, nextRepsOverride: reps, prescribedReps: reps };
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

function assertAppendable(
  entry: Omit<SetLogEntry, "id" | "loggedAt"> & { id?: string; loggedAt?: string },
): void {
  if (entry.setIndex < 1) {
    throw new Error(`setIndex must be >= 1; got ${entry.setIndex}`);
  }
  if (entry.completedReps < 0) {
    throw new Error(`completedReps must be >= 0; got ${entry.completedReps}`);
  }
  if (entry.prescribedReps < 1) {
    throw new Error(`prescribedReps must be >= 1; got ${entry.prescribedReps}`);
  }
}
