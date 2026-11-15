import { placeOnLadder } from "../data/enrich/ladder";
import { LIBRARY_CATALOGUE } from "../data/libraryCatalogue";

export interface FamilyLadderMember {
  id: string;
  name: string;
  familyId: string;
  rank: number;
}

export interface FamilyLadderIndex {
  /** Placement for each catalogue id that sits on a ladder. */
  byId: ReadonlyMap<string, FamilyLadderMember>;
  /** Members grouped by family id (includes all ranks). */
  byFamily: ReadonlyMap<string, readonly FamilyLadderMember[]>;
}

/**
 * Build a family/rank index from a catalogue using the same ladder rules as
 * enrich (band moves stay off ladders).
 */
export function buildFamilyLadderIndex(
  catalogue: ReadonlyArray<{ id: string; name: string; requires?: readonly string[] }>,
): FamilyLadderIndex {
  const byId = new Map<string, FamilyLadderMember>();
  const byFamily = new Map<string, FamilyLadderMember[]>();

  for (const exercise of catalogue) {
    if (exercise.requires?.includes("band")) {
      continue;
    }
    const placement = placeOnLadder(exercise.name);
    if (!placement) {
      continue;
    }
    if (byId.has(exercise.id)) {
      throw new Error(
        `Duplicate exercise id in family ladder catalogue: ${exercise.id}`,
      );
    }
    const member: FamilyLadderMember = {
      id: exercise.id,
      name: exercise.name,
      familyId: placement.family.id,
      rank: placement.rank,
    };
    byId.set(member.id, member);
    const list = byFamily.get(member.familyId) ?? [];
    list.push(member);
    byFamily.set(member.familyId, list);
  }

  return { byId, byFamily };
}

let cached: FamilyLadderIndex | undefined;

/** Library-wide index; built once from the enriched catalogue. */
export function libraryFamilyLadderIndex(): FamilyLadderIndex {
  if (!cached) {
    cached = buildFamilyLadderIndex(LIBRARY_CATALOGUE);
  }
  return cached;
}
