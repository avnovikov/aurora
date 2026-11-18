import type { FamilyLadderIndex, FamilyLadderMember } from "../../src/progress/familyLadderIndex";

/** One synthetic ladder member; name mirrors the id. */
export function member(id: string, rank: number, familyId = "f"): FamilyLadderMember {
  return { id, name: id, familyId, rank };
}

/**
 * A synthetic family ladder index. Each family lists its move ids in rank order
 * (rank = position), or `[id, rank]` pairs when the ranks are explicit.
 */
export function indexOf(
  families: Record<string, Array<string | [string, number]>>,
): FamilyLadderIndex {
  const byId = new Map<string, FamilyLadderMember>();
  const byFamily = new Map<string, FamilyLadderMember[]>();
  for (const [familyId, entries] of Object.entries(families)) {
    const members = entries.map((entry, position) =>
      typeof entry === "string" ? member(entry, position, familyId) : member(entry[0], entry[1], familyId),
    );
    byFamily.set(familyId, members);
    for (const m of members) byId.set(m.id, m);
  }
  return { byId, byFamily };
}
