import { EXERCISE_GRAPH } from "../data/exerciseGraph";
import type { HistoryEntry } from "../domain/program";
import type { Exercise, MuscleGroup, MuscleRole } from "../domain/types";

/** Hard windows for exercise-count chips. Overall is separate (decayed load). */
export type BodyPeriod = "month" | "quarter" | "half_year" | "year";

export type BodyViewMode = "overall" | BodyPeriod;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const BODY_PERIODS = ["month", "quarter", "half_year", "year"] as const satisfies readonly BodyPeriod[];

const PERIOD_DAYS: Record<BodyPeriod, number> = {
  month: 30,
  quarter: 91,
  half_year: 182,
  year: 365,
};

/** Full credit through this many days (Bosquet: no clear force loss ≤ ~2 weeks). */
export const OVERALL_FULL_DAYS = 14;
/** Anchor age where weight ≈ OVERALL_ANCHOR_WEIGHT (McMaster mean ~7.2 weeks). */
export const OVERALL_ANCHOR_DAYS = 49;
/** Retained fraction at OVERALL_ANCHOR_DAYS (~85% after mean −14.5%). */
export const OVERALL_ANCHOR_WEIGHT = 0.85;

const OVERALL_DECAY_LAMBDA =
  -Math.log(OVERALL_ANCHOR_WEIGHT) / (OVERALL_ANCHOR_DAYS - OVERALL_FULL_DAYS);

/**
 * Share of a session's setCount credited to a muscle, by its role in the
 * exercise. History stores no per-set reps, so Overall heat is
 * "setCount × role weight × age weight" — primaries count fully, secondaries
 * half, stabilizers a quarter. All three are exactly representable in binary
 * floating point, so sums stay exact.
 */
export const ROLE_WEIGHT: Record<MuscleRole, number> = {
  primary: 1,
  secondary: 0.5,
  stabilizer: 0.25,
};

/** Per-muscle scores; units depend on view (decayed set-load vs exercise count). */
export type MuscleLoadMap = Partial<Record<MuscleGroup, number>>;

export function isBodyPeriod(value: string): value is BodyPeriod {
  return (BODY_PERIODS as readonly string[]).includes(value);
}

export function isBodyViewMode(value: string): value is BodyViewMode {
  return value === "overall" || isBodyPeriod(value);
}

/**
 * Session age weight for Overall: 1.0 for the first OVERALL_FULL_DAYS, then
 * exponential decay pinned so OVERALL_ANCHOR_DAYS → OVERALL_ANCHOR_WEIGHT.
 */
export function sessionAgeWeight(ageDays: number): number {
  assertFinite(ageDays, "ageDays");
  if (ageDays <= OVERALL_FULL_DAYS) {
    return 1;
  }
  return Math.exp(-OVERALL_DECAY_LAMBDA * (ageDays - OVERALL_FULL_DAYS));
}

/**
 * Decayed set-load map for Overall: every countable session contributes
 * `setCount × role weight × sessionAgeWeight`.
 */
export function aggregateOverallMuscleLoad(
  history: HistoryEntry[],
  nowMs: number = Date.now(),
): MuscleLoadMap {
  const loads: MuscleLoadMap = {};
  for (const entry of history) {
    const weight = windowWeight(entry, "overall", nowMs);
    if (hasUsableSets(entry) && weight > 0) {
      creditWeightedSets(loads, entry, entry.setCount * weight);
    }
  }
  return loads;
}

/**
 * Count exercise appearances per muscle group inside a hard window.
 * Each known exercise in a session adds 1 once per muscle group it trains.
 */
export function aggregateMuscleExercises(
  history: HistoryEntry[],
  period: BodyPeriod,
  nowMs: number = Date.now(),
): MuscleLoadMap {
  if (PERIOD_DAYS[period] === undefined) {
    throw new Error(`Unknown body period: ${String(period)}`);
  }
  const loads: MuscleLoadMap = {};

  for (const entry of history) {
    if (windowWeight(entry, period, nowMs) <= 0) {
      continue;
    }
    for (const exercise of knownExercises(entry)) {
      for (const group of muscleGroupsOf(exercise)) {
        addLoad(loads, group, 1);
      }
    }
  }
  return loads;
}

/**
 * Weight of one session in a Body window: Overall decays with age, a period
 * counts 1 inside it and 0 outside; an undated session weighs 0.
 */
export function windowWeight(entry: HistoryEntry, mode: BodyViewMode, nowMs: number): number {
  const completedAt = entryCompletedAtMs(entry);
  if (completedAt === undefined) {
    return 0;
  }
  if (mode === "overall") {
    return sessionAgeWeight(Math.max(0, (nowMs - completedAt) / MS_PER_DAY));
  }
  return completedAt >= nowMs - PERIOD_DAYS[mode] * MS_PER_DAY ? 1 : 0;
}

/** Resolve Body page scores for the selected chip. */
export function aggregateBodyView(
  history: HistoryEntry[],
  mode: BodyViewMode,
  nowMs: number = Date.now(),
): MuscleLoadMap {
  if (mode === "overall") {
    return aggregateOverallMuscleLoad(history, nowMs);
  }
  return aggregateMuscleExercises(history, mode, nowMs);
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

/** Distinct muscle groups trained by an exercise (role ignored). */
export function muscleGroupsOf(exercise: Exercise): MuscleGroup[] {
  return [...new Set(exercise.muscles.map((muscle) => muscle.group))];
}

function knownExercises(entry: HistoryEntry): Exercise[] {
  const exercises: Exercise[] = [];
  for (const exerciseId of entry.exerciseIds) {
    const exercise = EXERCISE_GRAPH[exerciseId];
    if (exercise) {
      exercises.push(exercise);
    }
  }
  return exercises;
}

function creditWeightedSets(loads: MuscleLoadMap, entry: HistoryEntry, setCredit: number): void {
  for (const exercise of knownExercises(entry)) {
    for (const [group, weight] of strongestWeightPerGroup(exercise)) {
      addLoad(loads, group, setCredit * weight);
    }
  }
}

function addLoad(loads: MuscleLoadMap, group: MuscleGroup, amount: number): void {
  loads[group] = (loads[group] ?? 0) + amount;
}

/** Completion time in ms, or undefined when the stored date does not parse. */
export function entryCompletedAtMs(entry: HistoryEntry): number | undefined {
  const completedAt = Date.parse(entry.completedAt);
  return Number.isFinite(completedAt) ? completedAt : undefined;
}

function hasUsableSets(entry: HistoryEntry): boolean {
  return Number.isFinite(entry.setCount) && entry.setCount > 0;
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be finite; got ${value}`);
  }
}
