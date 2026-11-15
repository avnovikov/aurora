import { SEED_GRAPH } from "../data/seed";
import type { HistoryEntry } from "../domain/program";
import type { MuscleGroup } from "../domain/types";

export type BodyPeriod = "week" | "month" | "quarter" | "half_year" | "year";

const PERIOD_DAYS: Record<BodyPeriod, number> = {
  week: 7,
  month: 30,
  quarter: 91,
  half_year: 182,
  year: 365,
};

export type MuscleLoadMap = Partial<Record<MuscleGroup, number>>;

/**
 * Heat metric B: sets × sessions touching each primary muscle group.
 * History stores setCount per session; we attribute that count to each
 * primary group on every exercise logged that day (POC approximation).
 */
export function aggregateMuscleLoad(
  history: HistoryEntry[],
  period: BodyPeriod,
  nowMs: number = Date.now(),
): MuscleLoadMap {
  const cutoff = nowMs - PERIOD_DAYS[period] * 24 * 60 * 60 * 1000;
  const loads: MuscleLoadMap = {};

  for (const entry of history) {
    const at = Date.parse(entry.completedAt);
    if (!Number.isFinite(at) || at < cutoff) {
      continue;
    }
    for (const exerciseId of entry.exerciseIds) {
      const exercise = SEED_GRAPH[exerciseId];
      if (!exercise) {
        continue;
      }
      for (const muscle of exercise.muscles) {
        if (muscle.role !== "primary") {
          continue;
        }
        loads[muscle.group] = (loads[muscle.group] ?? 0) + entry.setCount;
      }
    }
  }
  return loads;
}

export function topMuscles(loads: MuscleLoadMap, limit = 5): Array<[MuscleGroup, number]> {
  return (Object.entries(loads) as Array<[MuscleGroup, number]>)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}
