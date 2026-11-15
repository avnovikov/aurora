import type { SeedExercise } from "../data/seed";
import { SKILL_TIER_LABELS } from "../domain/skillTier";
import { escapeHtml } from "./present";
import { AREAS, MUSCLE_BUCKETS, areaOf, primaryBuckets } from "./facets";

/** Joins the parts of the line: "Upper body · Back · Beginner". */
const META_SEPARATOR = " · ";

interface MetaPart {
  text: string;
  /** This part is the skill level, which list rows emphasise. */
  isLevel?: boolean;
}

/**
 * One line describing a move in the same words the filters use:
 * area · primary muscles · level · needs gear. Shared by list rows and the
 * detail page so both speak the same vocabulary.
 */
function exerciseMetaParts(exercise: SeedExercise): MetaPart[] {
  const area = areaOf(exercise);
  const muscles = primaryBuckets(exercise)
    .map((bucket) => MUSCLE_BUCKETS.find((item) => item.id === bucket)?.label ?? bucket)
    .join(", ");
  return [
    { text: area ? (AREAS.find((item) => item.id === area)?.label ?? area) : "" },
    { text: muscles },
    { text: exercise.difficulty ? SKILL_TIER_LABELS[exercise.difficulty] : "", isLevel: true },
    { text: exercise.requires?.length ? `needs ${exercise.requires.join(", ")}` : "" },
  ].filter((part) => part.text);
}

export function exerciseMetaLine(exercise: SeedExercise): string {
  return exerciseMetaParts(exercise)
    .map((part) => part.text)
    .join(META_SEPARATOR);
}

/** The same line as markup for a list row, with the level emphasised. */
export function exerciseMetaHtml(exercise: SeedExercise): string {
  return exerciseMetaParts(exercise)
    .map((part) => (part.isLevel ? `<span class="lvl">${escapeHtml(part.text)}</span>` : escapeHtml(part.text)))
    .join(META_SEPARATOR);
}
