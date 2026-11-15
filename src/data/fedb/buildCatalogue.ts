import { exerciseNameKey } from "../nameKey";
import { serialiseCatalogueModule } from "../serialiseCatalogue";
import type { SeedExercise } from "../seed";
import { mapFedbExerciseRecord } from "./mapFedbExercise";
import { FEDB_SAME_AS_EXISTING, isFedbCandidate } from "./selection";
import type { FedbExerciseRecord } from "./types";

export interface FedbBuildResult {
  catalogue: SeedExercise[];
  skippedDuplicates: string[];
  /** Skipped records and the library id they duplicate (for merging text). */
  duplicates: Array<{ record: FedbExerciseRecord; intoId: string }>;
}

/**
 * Bodyweight subset of free-exercise-db, minus anything whose name (or a
 * known alias) already exists in `existing`.
 */
export function buildFedbCatalogue(
  records: FedbExerciseRecord[],
  existing: SeedExercise[],
): FedbBuildResult {
  const taken = new Map(existing.map((item) => [exerciseNameKey(item.name), item.id]));
  const catalogue: SeedExercise[] = [];
  const skippedDuplicates: string[] = [];
  const duplicates: Array<{ record: FedbExerciseRecord; intoId: string }> = [];

  for (const record of records) {
    if (!isFedbCandidate(record)) {
      continue;
    }
    const key = exerciseNameKey(record.name);
    const alias = FEDB_SAME_AS_EXISTING[record.name];
    const intoId = alias ? taken.get(exerciseNameKey(alias)) : taken.get(key);
    if (alias || intoId) {
      skippedDuplicates.push(record.name);
      if (intoId) {
        duplicates.push({ record, intoId });
      }
      continue;
    }
    const mapped = mapFedbExerciseRecord(record);
    taken.set(key, mapped.id);
    catalogue.push(mapped);
  }

  catalogue.sort((a, b) => a.name.localeCompare(b.name));
  return { catalogue, skippedDuplicates, duplicates };
}

export function parseFedbJson(content: string): FedbExerciseRecord[] {
  const parsed: unknown = JSON.parse(content);
  if (!Array.isArray(parsed)) {
    throw new Error("free-exercise-db JSON must be an array");
  }
  return parsed as FedbExerciseRecord[];
}

export function serialiseFedbCatalogueModule(catalogue: SeedExercise[]): string {
  return serialiseCatalogueModule("FEDB_CATALOGUE", "scripts/import-free-exercise-db.ts", catalogue);
}
