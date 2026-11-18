import type { SeedExercise } from "../data/seed";
import type { EquipmentId, JointHistoryEntry } from "../domain/program";
import { missingGear } from "../safety/gear";
import { prehabFor } from "../safety/prehab";
import { searchExercises, type LibraryQuery } from "./search";

export interface LibraryResultsInput {
  catalogue: SeedExercise[];
  query: LibraryQuery;
  forJoints: boolean;
  onlyGear: boolean;
  jointHistory: readonly JointHistoryEntry[];
  equipment: readonly EquipmentId[];
  /** Show only these excluded moves (set when the Excluded filter is on). */
  excludedOnly?: readonly string[];
}

export interface LibraryResults {
  results: SeedExercise[];
  /** Stretches matching the current search that the stretch filter is hiding. */
  hiddenStretches: number;
}

/** The moves the filters run over: the curated joints list or the catalogue, narrowed to excluded moves and owned gear when asked. */
function poolFor(input: LibraryResultsInput): SeedExercise[] {
  const { catalogue, forJoints, onlyGear, jointHistory, equipment, excludedOnly } = input;
  const base = forJoints ? prehabFor(jointHistory, catalogue, equipment) : catalogue;
  const pool = excludedOnly ? base.filter((item) => excludedOnly.includes(item.id)) : base;
  return onlyGear ? pool.filter((item) => missingGear(item, equipment).length === 0) : pool;
}

/**
 * What the Library list shows. The "For my joints" list is curated, so the
 * stretch filter never applies to it (it includes stretches on purpose); the
 * same goes for the user's own excluded list.
 * While stretches are hidden and the user is searching, the number of hidden
 * matches is reported so the UI can offer to show them.
 */
export function selectLibraryResults(input: LibraryResultsInput): LibraryResults {
  const { query, forJoints, excludedOnly } = input;
  const gearPool = poolFor(input);
  const stretch = forJoints || excludedOnly ? "all" : (query.stretch ?? "all");
  const results = searchExercises(gearPool, { ...query, stretch });
  const searching = (query.text?.trim() ?? "") !== "";
  const hiddenStretches =
    stretch === "hide" && searching
      ? searchExercises(gearPool, { ...query, stretch: "only" }).length
      : 0;
  return { results, hiddenStretches };
}
