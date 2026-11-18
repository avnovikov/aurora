import { EXERCISE_GRAPH } from "../data/exerciseGraph";
import type { HistoryEntry } from "../domain/program";
import type { Exercise, MuscleGroup, MuscleRole } from "../domain/types";

export type BodyPeriod = "week" | "month" | "quarter" | "half_year" | "year";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const PERIOD_DAYS: Record<BodyPeriod, number> = {
  week: 7,
  month: 30,
  quarter: 91,
  half_year: 182,
  year: 365,
};

/**
 * Share of a session's setCount credited to a muscle, by its role in the
 * exercise. History stores no per-set reps, so heat metric B is
 * "setCount × role weight" — primaries count fully, secondaries half,
 * stabilizers a quarter. All three are exactly representable in binary
 * floating point, so sums stay exact.
 */
export const ROLE_WEIGHT: Record<MuscleRole, number> = {
  primary: 1,
  secondary: 0.5,
  stabilizer: 0.25,
};

export type MuscleLoadMap = Partial<Record<MuscleGroup, number>>;

/**
 * Sum weighted sets per muscle group for entries completed within `period`
 * of `nowMs` (inclusive of the cutoff instant).
 *
 * Each exercise logged in a session is credited with the session's full
 * setCount (POC approximation: no per-exercise set split is stored).
 * Entries with an unparseable date, a non-positive or non-finite setCount,
 * or exercise ids missing from the seed graph are skipped — local storage
 * can hold stale rows and one bad row must not blank the whole map.
 */
export function aggregateMuscleLoad(
  history: HistoryEntry[],
  period: BodyPeriod,
  nowMs: number = Date.now(),
): MuscleLoadMap {
  const periodDays = PERIOD_DAYS[period];
  if (periodDays === undefined) {
    throw new Error(`Unknown body period: ${String(period)}`);
  }
  const cutoff = nowMs - periodDays * MS_PER_DAY;
  const loads: MuscleLoadMap = {};

  for (const entry of history) {
    if (isCountable(entry, cutoff)) {
      addEntryLoad(loads, entry);
    }
  }
  return loads;
}

export function topMuscles(loads: MuscleLoadMap, limit = 5): Array<[MuscleGroup, number]> {
  return (Object.entries(loads) as Array<[MuscleGroup, number]>)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

/** Largest single-group score, or 0 for an empty map. */
export function maxLoad(loads: MuscleLoadMap): number {
  return Math.max(0, ...Object.values(loads));
}

function isCountable(entry: HistoryEntry, cutoffMs: number): boolean {
  const completedAt = Date.parse(entry.completedAt);
  const hasSets = Number.isFinite(entry.setCount) && entry.setCount > 0;
  return Number.isFinite(completedAt) && completedAt >= cutoffMs && hasSets;
}

function addEntryLoad(loads: MuscleLoadMap, entry: HistoryEntry): void {
  for (const exerciseId of entry.exerciseIds) {
    const exercise = EXERCISE_GRAPH[exerciseId];
    if (!exercise) {
      continue;
    }
    for (const [group, weight] of strongestWeightPerGroup(exercise)) {
      loads[group] = (loads[group] ?? 0) + entry.setCount * weight;
    }
  }
}

/**
 * An exercise may list one group more than once (e.g. two heads of the same
 * muscle). Credit the group once, at its strongest role, so it is not
 * double counted.
 */
export function strongestWeightPerGroup(exercise: Exercise): Map<MuscleGroup, number> {
  const weights = new Map<MuscleGroup, number>();
  for (const muscle of exercise.muscles) {
    const weight = ROLE_WEIGHT[muscle.role];
    weights.set(muscle.group, Math.max(weights.get(muscle.group) ?? 0, weight));
  }
  return weights;
}
