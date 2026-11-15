import type { Exercise, ExerciseStandards, SkillTier } from "./types";

export const SKILL_TIERS: readonly SkillTier[] = [
  "novice",
  "beginner",
  "intermediate",
  "advanced",
  "elite",
] as const;

/** Position of a tier, 0 = novice … 4 = elite (for comparisons). */
export function tierIndex(tier: SkillTier): number {
  return SKILL_TIERS.indexOf(tier);
}

export const SKILL_TIER_LABELS: Record<SkillTier, string> = {
  novice: "Novice",
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  elite: "Elite",
};

/**
 * Highest tier whose standard the athlete’s best clean set meets.
 */
export function inferTierFromBest(
  bestReps: number,
  standards: ExerciseStandards,
): SkillTier {
  assertNonNegativeBest(bestReps);
  for (let i = SKILL_TIERS.length - 1; i >= 0; i -= 1) {
    const tier = SKILL_TIERS[i];
    if (bestReps >= standards[tier]) {
      return tier;
    }
  }
  return "novice";
}

export function nextSkillTier(tier: SkillTier): SkillTier | null {
  const index = SKILL_TIERS.indexOf(tier);
  if (index < 0 || index >= SKILL_TIERS.length - 1) {
    return null;
  }
  return SKILL_TIERS[index + 1];
}

export function tierRank(tier: SkillTier): number {
  const index = SKILL_TIERS.indexOf(tier);
  if (index < 0) {
    throw new Error(`Unknown skill tier: ${tier}`);
  }
  return index;
}

export function maxTier(a: SkillTier, b: SkillTier): SkillTier {
  return tierRank(a) >= tierRank(b) ? a : b;
}

export function standardsFor(exercise: Exercise): ExerciseStandards | null {
  return exercise.standards ?? null;
}

export function workingRepsForTier(
  standards: ExerciseStandards,
  tier: SkillTier,
  targetRir: number,
): number {
  if (targetRir < 0) {
    throw new Error(`targetRir must be non-negative; got ${targetRir}`);
  }
  return Math.max(1, standards[tier] - targetRir);
}

function assertNonNegativeBest(bestReps: number): void {
  if (!Number.isFinite(bestReps) || bestReps < 0) {
    throw new Error(`bestReps must be non-negative; got ${bestReps}`);
  }
}
