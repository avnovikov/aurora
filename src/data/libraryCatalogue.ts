import { enrichCatalogue } from "./enrich/enrichCatalogue";
import { FEDB_CATALOGUE } from "./generated/fedbCatalogue";
import { HF_CATALOGUE } from "./generated/hfCatalogue";
import { WGER_CATALOGUE } from "./generated/wgerCatalogue";
import { NTC_CATALOGUE } from "./ntc/ntcCatalogue";
import { mergeSeedDuplicates } from "./mergeSeedDuplicates";
import { SEED_EXERCISES, type SeedExercise } from "./seed";

/**
 * Seed first, then each extra source in order. Ids must be unique across
 * every source; seed ids keep priority in EXERCISE_GRAPH lookups.
 */
export function buildLibraryCatalogue(
  seed: SeedExercise[],
  ...sources: SeedExercise[][]
): SeedExercise[] {
  const ids = new Set(seed.map((item) => item.id));
  const merged = [...seed];
  for (const source of sources) {
    for (const item of source) {
      if (ids.has(item.id)) {
        throw new Error(`Library catalogue id collision: ${item.id}`);
      }
      ids.add(item.id);
      merged.push(item);
    }
  }
  return merged;
}

const merged = mergeSeedDuplicates(
  SEED_EXERCISES,
  buildLibraryCatalogue([], HF_CATALOGUE, NTC_CATALOGUE, FEDB_CATALOGUE, WGER_CATALOGUE),
);

/** Imported ids folded into a seed move → that seed id. */
export const LIBRARY_REDIRECTS: Readonly<Record<string, string>> = merged.redirects;

/** All sources merged, then given levels, standards, ladder links and cautions. */
export const LIBRARY_CATALOGUE: SeedExercise[] = enrichCatalogue(
  buildLibraryCatalogue(merged.seed, merged.imported),
);
