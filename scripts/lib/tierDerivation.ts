/**
 * Deterministic tier-band derivation (#262, fourth step).
 * Spec: docs/superpowers/specs/2026-11-21-researched-tier-standards-design.md
 *
 * Anchors (Endura twins, the coaching list, seed bands, user decisions and
 * sourced research rows) are fixed. Every derived move takes its parent's
 * band one ×1.2 step up (easier) or down (harder), walked out from the
 * anchors in topological order, so a chain can never disagree with itself.
 */

export type EffortKind = "reps" | "hold";

/** Novice, beginner, intermediate, advanced, elite. */
export type Band = readonly [number, number, number, number, number];

/**
 * How a derived move relates to its parent. `same` is used only where the
 * research method says the move is the parent's band unchanged (×1.0).
 */
export type Step = "easier" | "harder" | "same";

/** The variant step: an easier move ×1.2, a harder move ÷1.2 (#189). */
export const VARIANT_STEP = 1.2;

/** Holds of this length or more round to whole 5 s. */
const HOLD_ROUND_FROM = 10;
const HOLD_ROUND = 5;

export interface Anchor {
  band: Band;
  effort: EffortKind;
}

export interface DerivedNode {
  id: string;
  parentId: string;
  step: Step;
  effort: EffortKind;
}

export interface Derivation {
  bands: Map<string, Band>;
  /** Derived ids in the order they were computed (every parent before its children). */
  order: string[];
}

/**
 * One step from the parent's band. Easier: ×1.2 rounded up. Harder: ÷1.2
 * rounded down, at least 1. Holds of 10 s or more round to 5 s in the same
 * direction. Tiers are then made strictly increasing: an easier band is
 * raised (it may sit above the parent), a harder band is raised by 1 where
 * flooring tied two tiers, which never lifts it above the parent because the
 * parent's tiers are strictly increasing integers.
 */
export function stepBand(parent: Band, step: Step, effort: EffortKind): Band {
  if (step === "same") {
    return parent;
  }
  const values = parent.map((value) =>
    step === "easier" ? roundUp(value * VARIANT_STEP, effort) : Math.max(1, roundDown(value / VARIANT_STEP, effort)),
  );
  for (let i = 1; i < values.length; i += 1) {
    if (values[i]! <= values[i - 1]!) {
      values[i] = values[i - 1]! + 1;
    }
  }
  return values as unknown as Band;
}

function roundUp(value: number, effort: EffortKind): number {
  if (effort === "hold" && value >= HOLD_ROUND_FROM) {
    return Math.ceil(value / HOLD_ROUND) * HOLD_ROUND;
  }
  return Math.ceil(value);
}

function roundDown(value: number, effort: EffortKind): number {
  if (effort === "hold" && value >= HOLD_ROUND_FROM) {
    return Math.floor(value / HOLD_ROUND) * HOLD_ROUND;
  }
  return Math.floor(value);
}

interface Links {
  id: string;
  easierId?: string;
  harderId?: string;
}

/**
 * Easier or harder from the catalogue: the parent is this move's easierId
 * (or names it as harderId), or the other way round. Null when the two are
 * not linked; throws when the links contradict each other.
 */
export function stepFromLinks(move: Links, parent: Links): Step | null {
  const harder = move.easierId === parent.id || parent.harderId === move.id;
  const easier = move.harderId === parent.id || parent.easierId === move.id;
  if (harder && easier) {
    throw new Error(`Catalogue links ${move.id} as both easier and harder than ${parent.id}`);
  }
  if (harder) {
    return "harder";
  }
  return easier ? "easier" : null;
}

const SAME = /(?:x|×)\s?1\.0\b|\bsame band\b|\bcopied from\b|\bequal difficulty\b|\bkept (?:at )?(?:the )?[a-z -]*anchor x1\.0/i;
const EASIER = /(?:x|×|\*)\s?1\.(?:2|44)\b|\beasier\b/i;
const HARDER = /(?:\/|÷)\s?1\.(?:2|44)\b|divided by 1\.2|\bharder\b/i;

/**
 * Easier or harder from the research method text, used when the catalogue
 * does not link the move to its parent: an explicit ×1.0 or "copied from"
 * means the same band; otherwise ×1.2 / "easier" or ÷1.2 / "harder". Null
 * when the text gives both directions or neither.
 */
export function stepFromMethod(method: string): Step | null {
  if (SAME.test(method)) {
    return "same";
  }
  const easier = EASIER.test(method);
  const harder = HARDER.test(method);
  if (easier === harder) {
    return null;
  }
  return easier ? "easier" : "harder";
}

/**
 * Bands for every derived node, computed parent first. Throws on a missing
 * parent, a parent with another effort (reps vs hold), or a cycle.
 */
export function deriveChains(anchors: ReadonlyMap<string, Anchor>, nodes: readonly DerivedNode[]): Derivation {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  for (const node of nodes) {
    if (anchors.has(node.id)) {
      throw new Error(`${node.id} is both an anchor and derived`);
    }
    const parent = anchors.get(node.parentId) ?? byId.get(node.parentId);
    if (!parent) {
      throw new Error(`${node.id}: parent ${node.parentId} is neither an anchor nor derived`);
    }
    if (parent.effort !== node.effort) {
      throw new Error(`${node.id} (${node.effort}) cannot derive from ${node.parentId} (${parent.effort})`);
    }
  }

  const children = new Map<string, DerivedNode[]>();
  for (const node of nodes) {
    children.set(node.parentId, [...(children.get(node.parentId) ?? []), node]);
  }
  const bands = new Map<string, Band>();
  const order: string[] = [];
  const queue = [...anchors.keys()].sort();
  for (let i = 0; i < queue.length; i += 1) {
    const parentId = queue[i]!;
    const parentBand = anchors.get(parentId)?.band ?? bands.get(parentId)!;
    for (const child of [...(children.get(parentId) ?? [])].sort((a, b) => a.id.localeCompare(b.id))) {
      bands.set(child.id, stepBand(parentBand, child.step, child.effort));
      order.push(child.id);
      queue.push(child.id);
    }
  }
  if (order.length !== nodes.length) {
    const stuck = nodes.filter((node) => !bands.has(node.id)).map((node) => `${node.id} <- ${node.parentId}`);
    throw new Error(`Cycle in derived parents (no anchor reached): ${stuck.join(", ")}`);
  }
  return { bands, order };
}

/**
 * Easier → harder pairs where the easier move has a lower number at some
 * tier. Pairs are "easierId > harderId"; moves without a band or with
 * different efforts are skipped.
 */
export function variantOrderViolations(
  pairs: Iterable<readonly [string, string]>,
  bandOf: (id: string) => { band: Band; effort: EffortKind } | undefined,
): string[] {
  const out = new Set<string>();
  for (const [easierId, harderId] of pairs) {
    const easier = bandOf(easierId);
    const harder = bandOf(harderId);
    if (!easier || !harder || easier.effort !== harder.effort) {
      continue;
    }
    if (easier.band.some((value, i) => value < harder.band[i]!)) {
      out.add(`${easierId} > ${harderId}`);
    }
  }
  return [...out].sort();
}
