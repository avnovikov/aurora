import { EXERCISE_GRAPH } from "../data/exerciseGraph";
import type { SessionTemplate } from "../domain/program";
import { tierIndex } from "../domain/skillTier";
import type { SeedExercise } from "../data/seed";
import type { ExerciseMemory, SkillTier } from "../domain/types";
import { effectiveSkillTier } from "../rules/skillDose";
import { refreshSkillTier } from "../progress/levelEvidence";
import { emptyMemory } from "../session/history";

/**
 * A plan level is a dose default (#112): a floor for planned moves, never
 * evidence. Results that already earned a higher tier are kept.
 */
function isBelow(memory: ExerciseMemory, exercise: SeedExercise, level: SkillTier): boolean {
  return tierIndex(effectiveSkillTier(memory, exercise)) < tierIndex(level);
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
): ExerciseMemory {
  const current = memory ?? emptyMemory(exercise.id);
  if (!planLevel) {
    return current;
  }
  const level = levelForMove(exercise, planLevel);
  if (!isBelow(current, exercise, level)) {
    return current;
  }
  return refreshSkillTier({ ...current, planTier: level }, new Date());
}

/**
 * Write the plan level as `planTier` on every working move of the generated
 * days (#112 rule 10): a dose default, never evidence, never inferred from.
 */
export function declareLevelForDays(
  memories: Record<string, ExerciseMemory>,
  days: readonly SessionTemplate[],
  planLevel: SkillTier,
): Record<string, ExerciseMemory> {
  const next = { ...memories };
  for (const slot of days.flatMap((day) => day.slots)) {
    const exercise = EXERCISE_GRAPH[slot.exerciseId];
    if (!exercise || slot.pinned) {
      continue;
    }
    next[exercise.id] = memoryAtLevel(next[exercise.id], exercise, planLevel);
  }
  return next;
}
