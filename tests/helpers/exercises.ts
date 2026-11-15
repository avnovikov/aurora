import { LIBRARY_CATALOGUE } from "../../src/data/libraryCatalogue";
import type { SeedExercise } from "../../src/data/seed";

/** The Library move with this exact name; throws, so a typo fails loudly. */
export function exerciseNamed(name: string): SeedExercise {
  const found = LIBRARY_CATALOGUE.find((item) => item.name === name);
  if (!found) {
    throw new Error(`No Library exercise named "${name}"`);
  }
  return found;
}
