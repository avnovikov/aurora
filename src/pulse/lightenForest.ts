import type { SleepQuality } from "../domain/types";
import type { WoundUpReason } from "./warmupWoundUp";

/** Encoded sleep: good / fair / poor. */
export const SLEEP_GOOD = 0;
export const SLEEP_FAIR = 1;
export const SLEEP_POOR = 2;

/** Encoded HR wound-up signal. */
export const HR_NORMAL = 0;
export const HR_END_ZONE_HIGH = 1;
export const HR_BASELINE_HIGH = 2;

const MAX_PAIN_JOINTS = 5;
const DEFAULT_TREE_COUNT = 7;
const DEFAULT_MAX_DEPTH = 3;
const DEFAULT_TRAIN_SEED = 42;

/** A three-level encoded feature value. */
type Level3 = 0 | 1 | 2;

/** Encoded features for the tiny forest. */
export interface LightenFeatures {
  /** {@link SLEEP_GOOD} | {@link SLEEP_FAIR} | {@link SLEEP_POOR} */
  readonly sleep: Level3;
  /** Joint pain count, capped at {@link MAX_PAIN_JOINTS}. */
  readonly pain: number;
  /** {@link HR_NORMAL} | {@link HR_END_ZONE_HIGH} | {@link HR_BASELINE_HIGH} */
  readonly hr: Level3;
}

export type LightenLabel = 0 | 1;

export interface LightenExample extends LightenFeatures {
  readonly label: LightenLabel;
  /** Accept/decline = 1; session rating reinforcement = 2. */
  readonly weight: number;
}

interface TreeNode {
  readonly feature?: keyof LightenFeatures;
  readonly threshold?: number;
  readonly left?: TreeNode;
  readonly right?: TreeNode;
  readonly leaf?: LightenLabel;
}

export type LightenForest = readonly TreeNode[];

const FEATURE_KEYS: readonly (keyof LightenFeatures)[] = ["sleep", "pain", "hr"];

export function encodeSleep(sleep: SleepQuality | undefined): 0 | 1 | 2 {
  switch (sleep) {
    case "poor":
      return SLEEP_POOR;
    case "fair":
      return SLEEP_FAIR;
    default:
      return SLEEP_GOOD;
  }
}

export function encodePain(painJoints: readonly string[]): number {
  return Math.min(MAX_PAIN_JOINTS, Math.max(0, painJoints.length));
}

export function encodeHr(woundUpReason: WoundUpReason): 0 | 1 | 2 {
  switch (woundUpReason) {
    case "baseline":
      return HR_BASELINE_HIGH;
    case "end_zone":
      return HR_END_ZONE_HIGH;
    default:
      return HR_NORMAL;
  }
}

export function featuresFromSignals(input: {
  sleepQuality?: SleepQuality;
  painJoints: readonly string[];
  woundUpReason: WoundUpReason;
}): LightenFeatures {
  return {
    sleep: encodeSleep(input.sleepQuality),
    pain: encodePain(input.painJoints),
    hr: encodeHr(input.woundUpReason),
  };
}

/** Cold-start default before enough labeled examples exist. */
export function coldStartPreferLight(features: LightenFeatures): boolean {
  return features.sleep >= SLEEP_POOR || features.pain > 0 || features.hr > HR_NORMAL;
}

/**
 * Tiny random forest: bootstrap samples, shallow trees, majority vote.
 * Deterministic given `seed` so tests stay stable.
 */
export function trainLightenForest(
  examples: readonly LightenExample[],
  options: { treeCount?: number; maxDepth?: number; seed?: number } = {},
): LightenForest {
  if (examples.length === 0) {
    return [];
  }
  const treeCount = options.treeCount ?? DEFAULT_TREE_COUNT;
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  let seed = options.seed ?? DEFAULT_TRAIN_SEED;
  const trees: TreeNode[] = [];
  for (let i = 0; i < treeCount; i += 1) {
    const bag: LightenExample[] = [];
    for (let j = 0; j < examples.length; j += 1) {
      seed = nextSeed(seed);
      bag.push(examples[seed % examples.length]!);
    }
    trees.push(buildTree(bag, maxDepth, 0));
  }
  return trees;
}

export function predictPreferLight(
  forest: LightenForest,
  features: LightenFeatures,
): boolean {
  if (forest.length === 0) {
    return coldStartPreferLight(features);
  }
  let votes = 0;
  for (const tree of forest) {
    votes += walkTree(tree, features);
  }
  // Tie → prefer light (conservative for a wound-up athlete).
  return votes * 2 >= forest.length;
}

function buildTree(
  examples: readonly LightenExample[],
  maxDepth: number,
  depth: number,
): TreeNode {
  const majority = weightedMajority(examples);
  if (depth >= maxDepth || examples.length < 2 || pure(examples)) {
    return { leaf: majority };
  }
  const best = bestSplit(examples);
  if (!best) {
    return { leaf: majority };
  }
  const left = examples.filter((ex) => ex[best.feature] <= best.threshold);
  const right = examples.filter((ex) => ex[best.feature] > best.threshold);
  return {
    feature: best.feature,
    threshold: best.threshold,
    left: buildTree(left, maxDepth, depth + 1),
    right: buildTree(right, maxDepth, depth + 1),
  };
}

interface Split {
  feature: keyof LightenFeatures;
  threshold: number;
  score: number;
}

/** Lowest weighted-Gini split over every feature and threshold; first found wins ties. */
function bestSplit(examples: readonly LightenExample[]): Split | null {
  let best: Split | null = null;
  for (const feature of FEATURE_KEYS) {
    const values = [...new Set(examples.map((ex) => ex[feature]))].sort((a, b) => a - b);
    for (const threshold of values) {
      const score = splitScore(examples, feature, threshold);
      if (score !== null && (!best || score < best.score)) {
        best = { feature, threshold, score };
      }
    }
  }
  return best;
}

/** Weighted Gini of a split, or null when one side would be empty. */
function splitScore(
  examples: readonly LightenExample[],
  feature: keyof LightenFeatures,
  threshold: number,
): number | null {
  const left = examples.filter((ex) => ex[feature] <= threshold);
  const right = examples.filter((ex) => ex[feature] > threshold);
  if (left.length === 0 || right.length === 0) {
    return null;
  }
  return weightedGini(left) * left.length + weightedGini(right) * right.length;
}

function walkTree(node: TreeNode, features: LightenFeatures): LightenLabel {
  if (node.leaf !== undefined) {
    return node.leaf;
  }
  assert(node.feature !== undefined && node.threshold !== undefined, "split node incomplete");
  assert(node.left !== undefined && node.right !== undefined, "split node missing children");
  return features[node.feature] <= node.threshold
    ? walkTree(node.left, features)
    : walkTree(node.right, features);
}

function pure(examples: readonly LightenExample[]): boolean {
  const first = examples[0]?.label;
  return examples.every((ex) => ex.label === first);
}

function weightedOnesAndTotal(examples: readonly LightenExample[]): {
  ones: number;
  total: number;
} {
  let ones = 0;
  let total = 0;
  for (const ex of examples) {
    ones += ex.label * ex.weight;
    total += ex.weight;
  }
  return { ones, total };
}

function weightedMajority(examples: readonly LightenExample[]): LightenLabel {
  const { ones, total } = weightedOnesAndTotal(examples);
  return ones * 2 >= total ? 1 : 0;
}

function weightedGini(examples: readonly LightenExample[]): number {
  const { ones, total } = weightedOnesAndTotal(examples);
  if (total === 0) {
    return 0;
  }
  const p = ones / total;
  return 1 - (p * p + (1 - p) * (1 - p));
}

function nextSeed(seed: number): number {
  return (seed * 1664525 + 1013904223) >>> 0;
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
