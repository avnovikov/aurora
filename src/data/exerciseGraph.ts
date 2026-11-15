import type { Pattern } from "../domain/types";
import { LIBRARY_CATALOGUE, LIBRARY_REDIRECTS } from "./libraryCatalogue";
import type { SeedExercise } from "./seed";

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

const SOURCE_RANK: ReadonlyArray<readonly [string, number]> = [
  ["hf_", 1],
  ["ntc_", 2],
  ["fedb_", 3],
  ["wger_", 4],
];

/** 0 = hand-curated seed … 4 = wger import. Lower is preferred. */
export function sourceRank(exerciseId: string): number {
  return SOURCE_RANK.find(([prefix]) => exerciseId.startsWith(prefix))?.[1] ?? 0;
}

/** Work moves the planner may put in a slot: they need tier standards to dose. */
export function isPlannable(exercise: SeedExercise): boolean {
  return exercise.role === "work" && exercise.pattern !== "mobility" && Boolean(exercise.standards);
}

export const PLANNABLE_EXERCISES: readonly SeedExercise[] = LIBRARY_CATALOGUE.filter(isPlannable);

/** Plannable moves grouped by pattern, curated first, then by name. */
export function plannableByPattern(): Map<Pattern, SeedExercise[]> {
  const groups = new Map<Pattern, SeedExercise[]>();
  for (const exercise of PLANNABLE_EXERCISES) {
    const list = groups.get(exercise.pattern) ?? [];
    list.push(exercise);
    groups.set(exercise.pattern, list);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => sourceRank(a.id) - sourceRank(b.id) || a.name.localeCompare(b.name));
  }
  return groups;
}
