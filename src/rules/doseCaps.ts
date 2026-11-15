import { resolveExerciseTiming } from "../domain/timing";
import type { Exercise, SkillTier } from "../domain/types";

/**
 * Most reps one working set may prescribe, per tier. Above the cap the move is
 * too easy: the ladder steps up to a harder variation (two on-target sessions)
 * instead of adding reps. ACSM 2009 (Ratamess, MSSE 41:687): novice and
 * intermediate 8–12 reps (endurance 10–15); Kotarsky 2018: progress the
 * push-up variation at 3 × 8 rather than adding reps. Rep drop-off across
 * sets (Willardson 2006) makes "max − RIR" unrepeatable on long sets.
 */
export const REP_CAP: Readonly<Record<SkillTier, number>> = {
  novice: 12,
  beginner: 12,
  intermediate: 15,
  advanced: 20,
  elite: 20,
};

/**
 * Longest core hold (seconds) per tier: build endurance with repeats of
 * short holds, not longer holds (McGill 2010, Strength Cond J 32(3):33).
 */
export const CORE_HOLD_CAP: Readonly<Record<SkillTier, number>> = {
  novice: 10,
  beginner: 10,
  intermediate: 20,
  advanced: 30,
  elite: 30,
};

const CORE_PATTERNS: ReadonlySet<Exercise["pattern"]> = new Set(["core_anti_extension", "core_compression"]);

/** Cap for this move at this tier, or null when the move has none (non-core holds). */
export function doseCap(exercise: Exercise, tier: SkillTier): number | null {
  if (resolveExerciseTiming(exercise).effort !== "hold") {
    return REP_CAP[tier];
  }
  return CORE_PATTERNS.has(exercise.pattern) ? CORE_HOLD_CAP[tier] : null;
}

/** Reps (or hold seconds) after the tier cap. */
export function capDose(units: number, exercise: Exercise, tier: SkillTier): number {
  const cap = doseCap(exercise, tier);
  return cap === null ? units : Math.min(units, cap);
}
