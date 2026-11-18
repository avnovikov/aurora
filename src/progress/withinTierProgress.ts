import {
  inferTierFromBest,
  nextSkillTier,
  SKILL_TIERS,
  tierIndex,
} from "../domain/skillTier";
import type { ExerciseStandards, SkillTier } from "../domain/types";

export interface WithinTierProgress {
  tier: SkillTier;
  /** 0–1 progress within `tier` toward the next tier (1 at elite). */
  withinFraction: number;
  /** Integer 0–100 for display. */
  withinPercent: number;
  /**
   * Position on novice→elite continuum in [0, 1]:
   * (tierIndex + withinFraction) / (tiers - 1).
   */
  continuum: number;
}

/**
 * Where best sits inside its earned tier, plus a continuum position for the bar.
 */
export function withinTierProgress(
  bestReps: number,
  standards: ExerciseStandards,
): WithinTierProgress {
  if (!Number.isFinite(bestReps) || bestReps < 0) {
    throw new Error(`bestReps must be non-negative; got ${bestReps}`);
  }

  const tier = inferTierFromBest(bestReps, standards);
  const next = nextSkillTier(tier);
  if (!next) {
    // Elite is the end of the continuum; do not use (index + 1) / max.
    return {
      tier,
      withinFraction: 1,
      withinPercent: 100,
      continuum: 1,
    };
  }

  const floor = standards[tier];
  const ceiling = standards[next];
  const span = ceiling - floor;
  if (span <= 0) {
    return progressWithin(tier, 0);
  }

  const raw = (bestReps - floor) / span;
  const withinFraction = Math.min(Math.max(raw, 0), 0.999);
  return progressWithin(tier, withinFraction);
}

function continuumPosition(tier: SkillTier, withinFraction: number): number {
  const maxIndex = SKILL_TIERS.length - 1;
  return (tierIndex(tier) + withinFraction) / maxIndex;
}

function progressWithin(
  tier: SkillTier,
  withinFraction: number,
): WithinTierProgress {
  return {
    tier,
    withinFraction,
    withinPercent: Math.round(withinFraction * 100),
    continuum: continuumPosition(tier, withinFraction),
  };
}
