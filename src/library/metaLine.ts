import type { SeedExercise } from "../data/seed";
import { SKILL_TIER_LABELS } from "../domain/skillTier";
import { AREAS, MUSCLE_BUCKETS, areaOf, primaryBuckets } from "./facets";

/**
 * One line describing a move in the same words the filters use:
 * area · primary muscles · level · needs gear. Shared by list rows and the
 * detail page so both speak the same vocabulary.
 */
export function exerciseMetaParts(exercise: SeedExercise): string[] {
  const area = areaOf(exercise);
  const muscles = primaryBuckets(exercise)
    .map((bucket) => MUSCLE_BUCKETS.find((item) => item.id === bucket)?.label ?? bucket)
    .join(", ");
  return [
    area ? (AREAS.find((item) => item.id === area)?.label ?? area) : "",
    muscles,
    exercise.difficulty ? SKILL_TIER_LABELS[exercise.difficulty] : "",
    exercise.requires?.length ? `needs ${exercise.requires.join(", ")}` : "",
  ].filter(Boolean);
}

export function exerciseMetaLine(exercise: SeedExercise): string {
  return exerciseMetaParts(exercise).join(" · ");
}
