import type { LoadRegion, SeedExercise } from "../data/seed";
import type { SkillTier } from "../domain/types";
import { matchesFacets, matchesFacetText, type AreaFilter, type MuscleFilter } from "./facets";

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
  equipmentHint?: string;
}

export function searchExercises(
  catalogue: SeedExercise[],
  query: LibraryQuery,
): SeedExercise[] {
  const text = query.text?.trim().toLowerCase() ?? "";
  const region = query.region ?? "all";
  const level = query.level ?? "all";
  const area = query.area ?? "all";
  const muscle = query.muscle ?? "all";

  return catalogue.filter((exercise) => {
    if (region !== "all" && !exercise.regions.includes(region)) {
      return false;
    }
    if (level !== "all" && exercise.difficulty !== level) {
      return false;
    }
    if (!matchesFacets(exercise, area, muscle)) {
      return false;
    }
    if (!text) {
      return true;
    }
    return (
      exercise.name.toLowerCase().includes(text) ||
      exercise.id.toLowerCase().includes(text) ||
      exercise.pattern.toLowerCase().includes(text) ||
      matchesFacetText(exercise, text)
    );
  });
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
