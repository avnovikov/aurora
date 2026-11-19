import { EXERCISE_GRAPH } from "../data/exerciseGraph";
import type { SessionTemplate } from "../domain/program";
import { tierIndex } from "../domain/skillTier";
import type { SeedExercise } from "../data/seed";
import type { ExerciseMemory, SkillTier } from "../domain/types";
import { effectiveSkillTier } from "../rules/skillDose";
import { emptyMemory, refreshSkillTier } from "../progress/levelEvidence";

/**
 * A plan level is a dose default (#112 / #115): never evidence. Logged
 * performance overrides it when dosing; results already earned stay.
 */
function isBelow(memory: ExerciseMemory, exercise: SeedExercise, level: SkillTier, now: Date): boolean {
  return tierIndex(effectiveSkillTier(memory, exercise, now)) < tierIndex(level);
}

/**
 * The plan level as it applies to one move: never above the move's own
 * difficulty, so an easy move is not dosed at an elite standard just
 * because the plan is elite.
 */
export function levelForMove(exercise: SeedExercise, level: SkillTier): SkillTier {
  const own = exercise.difficulty;
  return own && tierIndex(own) < tierIndex(level) ? own : level;
}

/** The memory the planner sees for this move with the plan level as a dose default. */
export function memoryAtLevel(
  memory: ExerciseMemory | undefined,
  exercise: SeedExercise,
  planLevel: SkillTier | undefined,
  now: Date = new Date(),
): ExerciseMemory {
  const current = memory ?? emptyMemory(exercise.id);
  if (!planLevel) {
    return current;
  }
  const level = levelForMove(exercise, planLevel);
  if (!isBelow(current, exercise, level, now)) {
    return current;
  }
  return refreshSkillTier({ ...current, planTier: level }, now);
}

/**
 * Write the plan level as `planTier` on every working move of the generated
 * days (#112 rule 10): a dose default, never evidence, never inferred from.
 */
export function declareLevelForDays(
  memories: Record<string, ExerciseMemory>,
  days: readonly SessionTemplate[],
  planLevel: SkillTier,
  now: Date = new Date(),
): Record<string, ExerciseMemory> {
  const next = { ...memories };
  for (const slot of days.flatMap((day) => day.slots)) {
    const exercise = EXERCISE_GRAPH[slot.exerciseId];
    if (!exercise || slot.pinned) {
      continue;
    }
    const before = next[exercise.id];
    const updated = memoryAtLevel(before, exercise, planLevel, now);
    // A move with no memory gets a record only when the plan level sets one.
    if (updated !== before && updated.planTier !== undefined) {
      next[exercise.id] = updated;
    }
  }
  return next;
}
