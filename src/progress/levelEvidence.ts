import { maxTier } from "../domain/skillTier";
import type { ExerciseMemory, SkillTier } from "../domain/types";

/** Unconfirmed inferred levels lapse after this (#112 rule 8). */
export const INFERRED_TTL_DAYS = 21;
/** Tested levels are flagged for retest after this long without a session. */
export const RETEST_AFTER_DAYS = 42;

const DAY_MS = 86_400_000;

/** Whole or fractional days from `iso` to `now`; a future or bad time counts as now (0). */
export function ageInDays(iso: string, now: Date): number {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) {
    return 0;
  }
  return Math.max(0, (now.getTime() - at) / DAY_MS);
}

function maxOf(tiers: ReadonlyArray<SkillTier | undefined>): SkillTier | undefined {
  let best: SkillTier | undefined;
  for (const tier of tiers) {
    if (tier !== undefined) {
      best = best === undefined ? tier : maxTier(best, tier);
    }
  }
  return best;
}

/** The athlete's own evidence: Library pick or logged reps. */
export function testedTier(memory: ExerciseMemory): SkillTier | undefined {
  return maxOf([memory.declaredTier, memory.loggedTier]);
}

export function liveInferredTier(memory: ExerciseMemory, now: Date): SkillTier | undefined {
  const inferred = memory.inferred;
  if (!inferred || ageInDays(inferred.at, now) > INFERRED_TTL_DAYS) {
    return undefined;
  }
  return inferred.tier;
}

/** Effective tier from evidence: max(tested, live inferred, plan default). */
export function evidenceTier(memory: ExerciseMemory, now: Date): SkillTier | undefined {
  return maxOf([testedTier(memory), liveInferredTier(memory, now), memory.planTier]);
}

export function needsRetest(memory: ExerciseMemory, now: Date): boolean {
  if (!testedTier(memory)) {
    return false;
  }
  const times = [memory.lastSessionAt, memory.declaredAt].filter((t): t is string => t !== undefined);
  if (times.length === 0) {
    return false;
  }
  return Math.min(...times.map((t) => ageInDays(t, now))) > RETEST_AFTER_DAYS;
}

/** Recompute the cached `skillTier` from evidence. */
export function refreshSkillTier(memory: ExerciseMemory, now: Date): ExerciseMemory {
  const rest: ExerciseMemory = { ...memory };
  delete rest.skillTier;
  const tier = evidenceTier(rest, now);
  return tier === undefined ? rest : { ...rest, skillTier: tier };
}
