import { HF_CATALOGUE } from "./generated/hfCatalogue";
import { SEED_EXERCISES, type SeedExercise } from "./seed";

export function buildLibraryCatalogue(
  seed: SeedExercise[],
  hf: SeedExercise[],
): SeedExercise[] {
  const seedIds = new Set(seed.map((item) => item.id));
  for (const item of hf) {
    if (seedIds.has(item.id)) {
      throw new Error(`HF catalogue collides with seed id: ${item.id}`);
    }
  }
  return [...seed, ...hf];
}

export const LIBRARY_CATALOGUE: SeedExercise[] = buildLibraryCatalogue(
  SEED_EXERCISES,
  HF_CATALOGUE,
);