/** Id prefixes of imported sources, most curated first. Seed ids have none. */
const IMPORTED_PREFIXES = ["hf_", "ntc_", "fedb_", "wger_"] as const;

/** 0 = hand-curated seed, then HF, NTC-style, free-exercise-db, wger. Lower is preferred. */
export function sourceRank(exerciseId: string): number {
  const index = IMPORTED_PREFIXES.findIndex((prefix) => exerciseId.startsWith(prefix));
  return index + 1;
}

export function isSeedId(exerciseId: string): boolean {
  return sourceRank(exerciseId) === 0;
}
