import type { Pattern } from "../domain/types";
import { LIBRARY_CATALOGUE, LIBRARY_REDIRECTS } from "./libraryCatalogue";
import type { SeedExercise } from "./seed";
import { sourceRank } from "./sourceRank";

export { sourceRank };

/**
 * Every Library exercise by id — seed moves keep their hand-curated chains and
 * standards; imported moves carry ladder links, levels and standards from
 * `enrich/`. This is the graph the planner, session and progress views use.
 */
const BY_ID: Record<string, SeedExercise> = Object.fromEntries(
  LIBRARY_CATALOGUE.map((exercise) => [exercise.id, exercise]),
);

/** Old ids of merged duplicates still resolve (to the seed move that absorbed them). */
export const EXERCISE_GRAPH: Readonly<Record<string, SeedExercise>> = {
  ...Object.fromEntries(
    Object.entries(LIBRARY_REDIRECTS).flatMap(([from, to]) => (BY_ID[to] ? [[from, BY_ID[to]]] : [])),
  ),
  ...BY_ID,
};

/** The Library exercise with this id; throws for an unknown id. */
export function requireExercise(exerciseId: string): SeedExercise {
  const exercise = EXERCISE_GRAPH[exerciseId];
  if (!exercise) {
    throw new Error(`Unknown exercise: ${exerciseId}`);
  }
  return exercise;
}

/**
 * Work moves the planner may put in a slot: they need tier standards to dose,
 * and are not band moves (those are prehab with no ladder). Gear the user
 * lacks is filtered at planning time, not here. A move that is not a max-rep
 * test has no standards (#262), so the generator never picks it: it has no
 * library dose rule.
 */
export function isPlannable(exercise: SeedExercise): boolean {
  return (
    exercise.role === "work" &&
    exercise.pattern !== "mobility" &&
    Boolean(exercise.standards) &&
    !exercise.requires?.includes("band")
  );
}

export const PLANNABLE_EXERCISES: readonly SeedExercise[] = LIBRARY_CATALOGUE.filter(isPlannable);

/**
 * Work moves the athlete may choose by hand (a swap pick): every plannable
 * move, plus tierless ones (#262). The generator never picks a tierless move;
 * chosen by hand it keeps the slot's existing dose, since `applySkillDose`
 * leaves a move without standards at the dose it is given.
 */
export function isChoosable(exercise: SeedExercise): boolean {
  return (
    isPlannable(exercise) ||
    (exercise.role === "work" &&
      exercise.pattern !== "mobility" &&
      exercise.standardsSource?.kind === "none" &&
      !exercise.requires?.includes("band"))
  );
}

const CHOOSABLE_EXERCISES: readonly SeedExercise[] = LIBRARY_CATALOGUE.filter(isChoosable);

/** Plannable moves grouped by pattern, curated first, then by name. */
export function plannableByPattern(): Map<Pattern, SeedExercise[]> {
  return byPattern(PLANNABLE_EXERCISES);
}

/** Moves the athlete may choose by hand, grouped by pattern, in the same order. */
export function choosableByPattern(): Map<Pattern, SeedExercise[]> {
  return byPattern(CHOOSABLE_EXERCISES);
}

function byPattern(exercises: readonly SeedExercise[]): Map<Pattern, SeedExercise[]> {
  const groups = new Map<Pattern, SeedExercise[]>();
  for (const exercise of exercises) {
    const list = groups.get(exercise.pattern) ?? [];
    list.push(exercise);
    groups.set(exercise.pattern, list);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => sourceRank(a.id) - sourceRank(b.id) || a.name.localeCompare(b.name));
  }
  return groups;
}
