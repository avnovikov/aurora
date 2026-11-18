import { buildSourceCatalogue, type SourceBuildResult } from "../buildSourceCatalogue";
import { serialiseCatalogueModule } from "../serialiseCatalogue";
import type { SeedExercise } from "../seed";
import { mapFedbExerciseRecord } from "./mapFedbExercise";
import { FEDB_SAME_AS_EXISTING, isFedbCandidate } from "./selection";
import type { FedbExerciseRecord } from "./types";

export type FedbBuildResult = SourceBuildResult<FedbExerciseRecord>;

/**
 * Bodyweight subset of free-exercise-db, minus anything whose name (or a
 * known alias) already exists in `existing`.
 */
export function buildFedbCatalogue(
  records: FedbExerciseRecord[],
  existing: SeedExercise[],
): FedbBuildResult {
  return buildSourceCatalogue(records, existing, {
    isCandidate: isFedbCandidate,
    map: mapFedbExerciseRecord,
    aliases: FEDB_SAME_AS_EXISTING,
  });
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
