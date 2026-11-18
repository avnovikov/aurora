import { checkDuplicate, exerciseNameKey } from "./nameKey";
import type { SeedExercise } from "./seed";

export interface SourceBuildResult<R> {
  catalogue: SeedExercise[];
  skippedDuplicates: string[];
  /** Skipped records and the library id they duplicate (for merging text). */
  duplicates: Array<{ record: R; intoId: string }>;
}

/** What one external source (free-exercise-db, wger, …) contributes to the build. */
export interface SourceAdapter<R extends { name: string }> {
  isCandidate: (record: R) => boolean;
  /** Source record → Library exercise. */
  map: (record: R) => SeedExercise;
  /** Source name → name of a move already in the Library it is the same as. */
  aliases: Readonly<Record<string, string>>;
  /** Name used for the duplicate key; defaults to the record's own name. */
  displayName?: (record: R) => string;
}

/**
 * Maps one source's records into the Library, skipping anything whose name
 * (or a known alias) is already taken, by `existing` or by an earlier record.
 * The result is sorted by name.
 */
export function buildSourceCatalogue<R extends { name: string }>(
  records: readonly R[],
  existing: readonly SeedExercise[],
  adapter: SourceAdapter<R>,
): SourceBuildResult<R> {
  const taken = new Map(existing.map((item) => [exerciseNameKey(item.name), item.id]));
  const catalogue: SeedExercise[] = [];
  const skippedDuplicates: string[] = [];
  const duplicates: Array<{ record: R; intoId: string }> = [];

  for (const record of records) {
    if (!adapter.isCandidate(record)) {
      continue;
    }
    const key = exerciseNameKey(adapter.displayName?.(record) ?? record.name);
    const { duplicate, intoId } = checkDuplicate(taken, key, adapter.aliases[record.name]);
    if (duplicate) {
      skippedDuplicates.push(record.name);
      if (intoId) {
        duplicates.push({ record, intoId });
      }
      continue;
    }
    const mapped = adapter.map(record);
    taken.set(key, mapped.id);
    catalogue.push(mapped);
  }

  catalogue.sort((a, b) => a.name.localeCompare(b.name));
  return { catalogue, skippedDuplicates, duplicates };
}
