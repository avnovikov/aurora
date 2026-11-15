import type { SeedExercise } from "../data/seed";
import { SKILL_TIER_LABELS } from "../domain/skillTier";
import { escapeHtml } from "./present";
import { AREAS, MUSCLE_BUCKETS, areaOf, primaryBuckets } from "./facets";

/**
 * One line describing a move in the same words the filters use:
 * area · primary muscles · level · needs gear. Shared by list rows and the
 * detail page so both speak the same vocabulary.
 */
function exerciseMetaParts(exercise: SeedExercise): Array<{ text: string; level?: true }> {
  const area = areaOf(exercise);
  const muscles = primaryBuckets(exercise)
    .map((bucket) => MUSCLE_BUCKETS.find((item) => item.id === bucket)?.label ?? bucket)
    .join(", ");
  return [
    { text: area ? (AREAS.find((item) => item.id === area)?.label ?? area) : "" },
    { text: muscles },
    { text: exercise.difficulty ? SKILL_TIER_LABELS[exercise.difficulty] : "", level: true as const },
    { text: exercise.requires?.length ? `needs ${exercise.requires.join(", ")}` : "" },
  ].filter((part) => part.text);
}

export function exerciseMetaLine(exercise: SeedExercise): string {
  return exerciseMetaParts(exercise)
    .map((part) => part.text)
    .join(" · ");
}

/** The same line as markup for a list row, with the level emphasised. */
export function exerciseMetaHtml(exercise: SeedExercise): string {
  return exerciseMetaParts(exercise)
    .map((part) => (part.level ? `<span class="lvl">${escapeHtml(part.text)}</span>` : escapeHtml(part.text)))
    .join(" · ");
}
