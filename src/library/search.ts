import type { LoadRegion, SeedExercise } from "../data/seed";

export interface LibraryQuery {
  text?: string;
  region?: LoadRegion | "all";
  equipmentHint?: string;
}

export function searchExercises(
  catalogue: SeedExercise[],
  query: LibraryQuery,
): SeedExercise[] {
  const text = query.text?.trim().toLowerCase() ?? "";
  const region = query.region ?? "all";

  return catalogue.filter((exercise) => {
    if (region !== "all" && !exercise.regions.includes(region)) {
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
