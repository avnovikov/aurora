import { EXERCISE_GRAPH } from "../data/exerciseGraph";
import type { SessionTemplate, WarmupLevel } from "../domain/program";
import { displayNameOf } from "../library/displayName";
import {
  estimateSessionDuration,
  formatDurationLabel,
} from "../rules/sessionDuration";

/** Display name for an exercise id, falling back to the id itself. */
export function exerciseName(exerciseId: string): string {
  return displayNameOf(exerciseId, EXERCISE_GRAPH);
}

/** Target names joined for UI chips and taglines. */
export function templateTargetsLabel(
  targetExerciseIds: readonly string[],
  separator = " · ",
): string {
  return targetExerciseIds.map(exerciseName).join(separator);
}

/** Duration label for a session template (warm-up at the given level). */
export function templateDurationLabel(template: SessionTemplate, level?: WarmupLevel): string {
  return formatDurationLabel(estimateSessionDuration(template, level));
}
