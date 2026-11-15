import { FAMILIES, type Family, type Rung } from "./families";
import { hasKeyword } from "./keywords";

export interface LadderPlacement {
  family: Family;
  rank: number;
  tier: Rung["tier"];
}

/** Find the family and rung for an exercise name, if it belongs to one. */
export function placeOnLadder(name: string): LadderPlacement | undefined {
  for (const family of FAMILIES) {
    if (!hasKeyword(name, family.includes)) {
      continue;
    }
    if (family.excludes && hasKeyword(name, family.excludes)) {
      continue;
    }
    const rung = family.rungs.find((item) => hasKeyword(name, item.keywords)) ?? family.fallback;
    return { family, rank: rung.rank, tier: rung.tier };
  }
  return undefined;
}
