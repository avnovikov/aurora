import { SEED_GRAPH } from "../data/seed";
import type { SessionTemplate } from "../domain/program";
import {
  estimateSessionDuration,
  formatDurationLabel,
} from "../rules/sessionDuration";

/** Display name for an exercise id, falling back to the id itself. */
export function exerciseName(exerciseId: string): string {
  return SEED_GRAPH[exerciseId]?.name ?? exerciseId;
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
