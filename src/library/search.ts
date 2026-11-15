import type { LoadRegion, SeedExercise } from "../data/seed";
import type { SkillTier } from "../domain/types";
import {
  matchesFacets,
  matchesFacetText,
  matchesStretchFilter,
  type AreaFilter,
  type MuscleFilter,
  type StretchFilter,
} from "./facets";

export type LevelFilter = SkillTier | "all";

export interface LibraryQuery {
  text?: string;
  region?: LoadRegion | "all";
  /** Catalogue difficulty tier; "all" keeps every exercise. */
  level?: LevelFilter;
  /** Upper / lower / core / full body, from primary muscles. */
  area?: AreaFilter;
  /** One rolled-up muscle bucket, primary muscles only. */
  muscle?: MuscleFilter;
  /** Stretch handling; omitted means everything (the Library UI defaults to "hide"). */
  stretch?: StretchFilter;
  equipmentHint?: string;
}

/** Every filter with its default, so callers may omit any of them. */
function withDefaults(query: LibraryQuery): Required<Omit<LibraryQuery, "text" | "equipmentHint">> {
  return {
    region: query.region ?? "all",
    level: query.level ?? "all",
    area: query.area ?? "all",
    muscle: query.muscle ?? "all",
    stretch: query.stretch ?? "all",
  };
}

function passesFilters(exercise: SeedExercise, query: LibraryQuery): boolean {
  const { region, level, area, muscle, stretch } = withDefaults(query);
  const regionOk = region === "all" || exercise.regions.includes(region);
  const levelOk = level === "all" || exercise.difficulty === level;
  return (
    regionOk &&
    levelOk &&
    matchesStretchFilter(exercise, stretch) &&
    matchesFacets(exercise, area, muscle)
  );
}

function matchesText(exercise: SeedExercise, text: string): boolean {
  return (
    exercise.name.toLowerCase().includes(text) ||
    exercise.id.toLowerCase().includes(text) ||
    exercise.pattern.toLowerCase().includes(text) ||
    matchesFacetText(exercise, text)
  );
}

export function searchExercises(
  catalogue: SeedExercise[],
  query: LibraryQuery,
): SeedExercise[] {
  const text = query.text?.trim().toLowerCase() ?? "";
  return catalogue.filter(
    (exercise) => passesFilters(exercise, query) && (!text || matchesText(exercise, text)),
  );
}

export const LIBRARY_REGIONS: Array<LoadRegion | "all"> = [
  "all",
  "core",
  "legs",
  "push",
  "pull",
  "skill",
  "general",
];
