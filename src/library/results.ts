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
}

export interface LibraryResults {
  results: SeedExercise[];
  /** Stretches matching the current search that the stretch filter is hiding. */
  hiddenStretches: number;
}

/**
 * What the Library list shows. The "For my joints" list is curated, so the
 * stretch filter never applies to it (it includes stretches on purpose).
 * While stretches are hidden and the user is searching, the number of hidden
 * matches is reported so the UI can offer to show them.
 */
export function selectLibraryResults(input: LibraryResultsInput): LibraryResults {
  const { catalogue, query, forJoints, onlyGear, jointHistory, equipment } = input;
  const pool = forJoints ? prehabFor(jointHistory, catalogue, equipment) : catalogue;
  const gearPool = onlyGear
    ? pool.filter((item) => missingGear(item.requires, equipment).length === 0)
    : pool;
  const stretch = forJoints ? "all" : (query.stretch ?? "all");
  const results = searchExercises(gearPool, { ...query, stretch });
  const searching = (query.text?.trim() ?? "") !== "";
  const hiddenStretches =
    stretch === "hide" && searching
      ? searchExercises(gearPool, { ...query, stretch: "only" }).length
      : 0;
  return { results, hiddenStretches };
}
