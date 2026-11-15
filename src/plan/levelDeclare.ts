import { EXERCISE_GRAPH } from "../data/exerciseGraph";
import type { SessionTemplate } from "../domain/program";
import { maxTier, tierIndex } from "../domain/skillTier";
import type { SeedExercise } from "../data/seed";
import type { ExerciseMemory, SkillTier } from "../domain/types";
import { effectiveSkillTier } from "../rules/skillDose";
import { declareSkillTier, emptyMemory } from "../session/history";

/**
 * A plan level is a declared level: the same thing as picking "Your level"
 * on an exercise's Library page. It is a floor, never a ceiling: results
 * that already earned a higher tier are kept.
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

/** The memory the planner would see for this move once the plan level is declared on it. */
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
  return { ...current, declaredTier: level, skillTier: maxTier(current.skillTier ?? level, level) };
}

/**
 * Declare the plan level on every working move of the generated days (care
 * moves are pinned and have no level), through the Library's own
 * `declareSkillTier`, so the planner doses them at that tier.
 */
export function declareLevelForDays(
  memories: Record<string, ExerciseMemory>,
  days: readonly SessionTemplate[],
  planLevel: SkillTier,
): Record<string, ExerciseMemory> {
  let next = memories;
  for (const slot of days.flatMap((day) => day.slots)) {
    const exercise = EXERCISE_GRAPH[slot.exerciseId];
    if (!exercise || slot.pinned) {
      continue;
    }
    const level = levelForMove(exercise, planLevel);
    if (isBelow(next[exercise.id] ?? emptyMemory(exercise.id), exercise, level)) {
      next = declareSkillTier(next, exercise.id, level).memories;
    }
  }
  return next;
}
