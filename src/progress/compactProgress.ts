import type { ChainMap, ChainNode } from "./chainMap";

/** What the Progress exercise block shows: current + optional next (harder). */
export interface CompactProgressBlock {
  current: ChainNode;
  next: ChainNode | null;
}

/**
 * Trim a full chain to the athlete's current step and the immediate harder one.
 */
export function compactProgressBlock(chain: ChainMap): CompactProgressBlock {
  const current =
    chain.nodes.find((node) => node.position === "current") ??
    chain.nodes.find((node) => node.id === chain.currentId);
  if (!current) {
    throw new Error(
      `Chain "${chain.rootId}" has no current node for ${chain.currentId}`,
    );
  }
  const currentIndex = chain.nodes.findIndex((node) => node.id === current.id);
  const next = currentIndex >= 0 ? (chain.nodes[currentIndex + 1] ?? null) : null;
  return { current, next };
}
