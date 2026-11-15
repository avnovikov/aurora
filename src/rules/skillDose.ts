import {
  inferTierFromBest,
  maxTier,
  standardsFor,
  workingRepsForTier,
} from "../domain/skillTier";
import type {
  Dose,
  Exercise,
  ExerciseMemory,
  SkillTier,
} from "../domain/types";
import { capDose, rirForTier } from "./doseCaps";

const DEFAULT_TIER: SkillTier = "beginner";

/**
 * Effective skill tier: max(declared, inferred-from-best, stored).
 */
export function effectiveSkillTier(
  memory: ExerciseMemory,
  exercise: Exercise,
): SkillTier {
  let tier: SkillTier = memory.skillTier ?? memory.declaredTier ?? DEFAULT_TIER;
  const standards = standardsFor(exercise);
  if (standards && memory.bestReps !== undefined) {
    tier = maxTier(tier, inferTierFromBest(memory.bestReps, standards));
  }
  if (memory.declaredTier) {
    tier = maxTier(tier, memory.declaredTier);
  }
  return tier;
}

/**
 * Scale template dose toward the athlete’s tier standard, at no less than the
 * tier's RIR and never above its rep or hold cap (`doseCaps`).
 */
export function applySkillDose(
  dose: Dose,
  exercise: Exercise,
  memory: ExerciseMemory,
): { dose: Dose; tier: SkillTier; applied: boolean } {
  const standards = standardsFor(exercise);
  if (!standards) {
    return {
      dose: { ...dose },
      tier: effectiveSkillTier(memory, exercise),
      applied: false,
    };
  }
  const tier = effectiveSkillTier(memory, exercise);
  const targetRir = rirForTier(dose.targetRir, tier);
  const working = capDose(workingRepsForTier(standards, tier, targetRir), exercise, tier);
  return {
    dose: { ...dose, reps: working, targetRir },
    tier,
    applied: working !== dose.reps,
  };
}

/**
 * Fast path onto the harder progression when performance already proves readiness.
 */
export function shouldAdvanceProgression(
  exercise: Exercise,
  memory: ExerciseMemory,
): boolean {
  if (!exercise.harderId) {
    return false;
  }
  if (memory.sessionsAtStandard >= 2) {
    return true;
  }
  const tier = effectiveSkillTier(memory, exercise);
  if (tier === "advanced" || tier === "elite") {
    return true;
  }
  const standards = standardsFor(exercise);
  if (!standards || memory.bestReps === undefined) {
    return false;
  }
  if (memory.bestReps >= standards.advanced) {
    return true;
  }
  if (
    memory.bestReps >= standards.intermediate &&
    memory.sessionsAtStandard >= 1
  ) {
    return true;
  }
  return false;
}
