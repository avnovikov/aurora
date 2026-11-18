import { clampToPrescription } from "../domain/prescription";
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
import { evidenceTier } from "../progress/levelEvidence";
import { capDose, rirForTier } from "./doseCaps";

const DEFAULT_TIER: SkillTier = "beginner";

/**
 * Effective skill tier from evidence (#112): tested, live inferred and plan
 * default, plus best reps against standards for memories not yet migrated.
 */
export function effectiveSkillTier(
  memory: ExerciseMemory,
  exercise: Exercise,
  now: Date = new Date(),
): SkillTier {
  let tier: SkillTier = evidenceTier(memory, now) ?? DEFAULT_TIER;
  const standards = standardsFor(exercise);
  if (standards && memory.bestReps !== undefined) {
    tier = maxTier(tier, inferTierFromBest(memory.bestReps, standards));
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
  let working = capDose(workingRepsForTier(standards, tier, targetRir), exercise, tier);
  if (exercise.prescription) {
    working = clampToPrescription(working, exercise.prescription);
  }
  return {
    dose: { ...dose, reps: working, targetRir },
    tier,
    applied: working !== dose.reps,
  };
}

/** Sessions at the standard before a move is ready for its harder step. */
export const SESSIONS_AT_STANDARD_TO_ADVANCE = 2;

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
  if (memory.sessionsAtStandard >= SESSIONS_AT_STANDARD_TO_ADVANCE) {
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
