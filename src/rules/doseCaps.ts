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

/**
 * Longest single hold (seconds) per tier for every other isometric (wall sit,
 * planche lean, hangs, handstand holds). [C] Coaching consensus: no trial
 * sets a ceiling; harder variations progress the hold beyond it.
 */
export const HOLD_CAP: Readonly<Record<SkillTier, number>> = {
  novice: 30,
  beginner: 30,
  intermediate: 45,
  advanced: 60,
  elite: 60,
};

/**
 * Reps in reserve per tier: novices and beginners misjudge reps left, worse
 * on longer sets (Hackett 2017, JSCR 31:2162), and proximity to failure
 * barely changes strength gains (Refalo 2024, Sports Med 54:2209). [C] 3 RIR.
 */
export const MIN_RIR: Readonly<Record<SkillTier, number>> = {
  novice: 3,
  beginner: 3,
  intermediate: 2,
  advanced: 2,
  elite: 2,
};

/** McGill's limit for a single core hold; at it, endurance builds by repeats. */
export const SHORT_CORE_HOLD_SECONDS = 10;
/** [C] A breath between the short holds of one pyramid set. */
export const HOLD_REPEAT_REST_SECONDS = 5;

const CORE_PATTERNS: ReadonlySet<Exercise["pattern"]> = new Set(["core_anti_extension", "core_compression"]);

function isHold(exercise: Exercise): boolean {
  return resolveExerciseTiming(exercise).effort === "hold";
}

function isCoreHold(exercise: Exercise): boolean {
  return isHold(exercise) && CORE_PATTERNS.has(exercise.pattern);
}

/** Most reps (or hold seconds) one set may prescribe for this move at this tier. */
export function doseCap(exercise: Exercise, tier: SkillTier): number {
  if (!isHold(exercise)) {
    return REP_CAP[tier];
  }
  return isCoreHold(exercise) ? CORE_HOLD_CAP[tier] : HOLD_CAP[tier];
}

/** Reps (or hold seconds) after the tier cap. */
export function capDose(units: number, exercise: Exercise, tier: SkillTier): number {
  return Math.min(units, doseCap(exercise, tier));
}

/** Target RIR for this tier: never closer to failure than the tier allows. */
export function rirForTier(targetRir: number, tier: SkillTier): number {
  return Math.max(targetRir, MIN_RIR[tier]);
}

/**
 * Russian descending pyramid for short core holds (McGill 2010): each set is
 * several ≤10 s holds, fewer every set (3 sets: 5, 3, 1). Null when the move
 * is not a core hold at McGill's limit (one hold per set).
 */
export function holdRepeats(exercise: Exercise, sets: number, holdSeconds: number): number[] | null {
  if (!isCoreHold(exercise) || holdSeconds > SHORT_CORE_HOLD_SECONDS) {
    return null;
  }
  return Array.from({ length: sets }, (_, index) => 2 * (sets - index) - 1);
}

/** Seconds one pyramid set takes: its holds plus a breath between them. */
export function pyramidSetSeconds(repeats: number, holdSeconds: number): number {
  return repeats * holdSeconds + Math.max(0, repeats - 1) * HOLD_REPEAT_REST_SECONDS;
}
