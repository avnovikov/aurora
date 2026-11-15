import { EXERCISE_GRAPH } from "../data/exerciseGraph";
import type { SessionTemplate } from "../domain/program";
import {
  estimateSessionDuration,
  formatDurationLabel,
  warmupCooldownLabel,
} from "../rules/sessionDuration";

/** Display name for an exercise id, falling back to the id itself. */
export function exerciseName(exerciseId: string): string {
  return EXERCISE_GRAPH[exerciseId]?.name ?? exerciseId;
}

/** Target names joined for UI chips and taglines. */
export function templateTargetsLabel(
  targetExerciseIds: readonly string[],
  separator = " · ",
): string {
  return targetExerciseIds.map(exerciseName).join(separator);
}

/** Duration label for a session template. */
export function templateDurationLabel(template: SessionTemplate): string {
  return formatDurationLabel(estimateSessionDuration(template));
}

/** Warm-up length plus the optional cool-down, e.g. "Warm-up 9 min · +4 min cool-down". */
export function templateWarmupLabel(template: SessionTemplate): string {
  return warmupCooldownLabel(template);
}
