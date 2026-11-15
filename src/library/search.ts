import type { LoadRegion, SeedExercise } from "../data/seed";
import type { SkillTier } from "../domain/types";

export type LevelFilter = SkillTier | "all";

export interface LibraryQuery {
  text?: string;
  region?: LoadRegion | "all";
  /** Catalogue difficulty tier; "all" keeps every exercise. */
  level?: LevelFilter;
  equipmentHint?: string;
}

export function searchExercises(
  catalogue: SeedExercise[],
  query: LibraryQuery,
): SeedExercise[] {
  const text = query.text?.trim().toLowerCase() ?? "";
  const region = query.region ?? "all";
  const level = query.level ?? "all";

  return catalogue.filter((exercise) => {
    if (region !== "all" && !exercise.regions.includes(region)) {
      return false;
    }
    if (level !== "all" && exercise.difficulty !== level) {
      return false;
    }
    if (!text) {
      return true;
    }
    return (
      exercise.name.toLowerCase().includes(text) ||
      exercise.id.toLowerCase().includes(text) ||
      exercise.pattern.toLowerCase().includes(text)
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
