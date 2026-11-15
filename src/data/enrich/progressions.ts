import type { SeedExercise } from "../seed";
import { sourceRank } from "../sourceRank";
import type { CrossLink } from "./families";
import { hasKeyword, normaliseForKeywords } from "./keywords";
import type { LadderPlacement } from "./ladder";

export interface Placed {
  exercise: SeedExercise;
  placement: LadderPlacement;
}

/** Curated sources first, then the plainest (shortest) name. */
function anchorScore(exercise: SeedExercise): [number, number, string] {
  return [sourceRank(exercise.id), exercise.name.length, exercise.id];
}

function words(name: string): Set<string> {
  return new Set(normaliseForKeywords(name).trim().split(" ").filter((word) => word.length > 2));
}

/** Shared name words with the source move (e.g. bridge → single-leg bridge). */
function overlap(a: string, b: string): number {
  const left = words(a);
  return [...words(b)].filter((word) => left.has(word)).length;
}

function bestAnchor(candidates: Placed[], from?: SeedExercise): SeedExercise | undefined {
  return [...candidates]
    .sort((a, b) => {
      const shared = from ? overlap(from.name, b.exercise.name) - overlap(from.name, a.exercise.name) : 0;
      const [pa, la, ia] = anchorScore(a.exercise);
      const [pb, lb, ib] = anchorScore(b.exercise);
      return shared || pa - pb || la - lb || ia.localeCompare(ib);
    })
    .at(0)?.exercise;
}

function atRank(members: Placed[], rank: number): Placed[] {
  return members.filter((item) => item.placement.rank === rank);
}

function nearest(members: Placed[], rank: number, direction: "down" | "up"): Placed[] {
  const ranks = members
    .map((item) => item.placement.rank)
    .filter((value) => (direction === "down" ? value < rank : value > rank));
  if (ranks.length === 0) {
    return [];
  }
  return atRank(members, direction === "down" ? Math.max(...ranks) : Math.min(...ranks));
}

function crossMembers(byFamily: Map<string, Placed[]>, link: CrossLink | undefined): Placed[] {
  if (!link) {
    return [];
  }
  return (byFamily.get(link.family) ?? []).filter(
    (item) =>
      (link.rank === undefined || item.placement.rank === link.rank) &&
      (link.keyword === undefined || hasKeyword(item.exercise.name, [link.keyword])),
  );
}

/**
 * Fill missing easierId / harderId from the movement-family ladder: the
 * nearest rung below / above, preferring curated moves as anchors, and
 * stepping into the linked family at either end of a ladder.
 */
export function wireLadderProgressions(placed: Placed[]): Map<string, { easierId?: string; harderId?: string }> {
  const byFamily = new Map<string, Placed[]>();
  for (const item of placed) {
    const list = byFamily.get(item.placement.family.id) ?? [];
    list.push(item);
    byFamily.set(item.placement.family.id, list);
  }

  const links = new Map<string, { easierId?: string; harderId?: string }>();
  for (const item of placed) {
    const family = item.placement.family;
    const members = byFamily.get(family.id) ?? [];
    let easier: SeedExercise | undefined = bestAnchor(nearest(members, item.placement.rank, "down"), item.exercise);
    let harder: SeedExercise | undefined = bestAnchor(nearest(members, item.placement.rank, "up"), item.exercise);
    easier ??= bestAnchor(crossMembers(byFamily, family.easierFrom), item.exercise);
    harder ??= bestAnchor(crossMembers(byFamily, family.harderTo), item.exercise);
    links.set(item.exercise.id, { easierId: easier?.id, harderId: harder?.id });
  }
  return links;
}
