import type { EquipmentId, HistoryEntry } from "../domain/program";
import type { ExerciseMemory, MuscleGroup, Pattern, SkillTier } from "../domain/types";
import type { SeedExercise } from "../data/seed";
import { sourceRank } from "../data/sourceRank";
import { displayExerciseName } from "../library/displayName";
import { missingGear } from "../safety/gear";
import {
  aggregateBodyView,
  entryCompletedAtMs,
  strongestWeightPerGroup,
  windowWeight,
  type BodyViewMode,
  type MuscleLoadMap,
} from "./aggregate";

/**
 * Body tab model (#234): "what is the balance?". Pure; every input is
 * injected so the rules can be proven without storage or the clock.
 */

export const BODY_WINDOWS: readonly BodyViewMode[] = ["overall", "month", "quarter", "half_year", "year"];

export const WINDOW_LABELS: Readonly<Record<BodyViewMode, string>> = {
  overall: "Overall",
  month: "Month",
  quarter: "3 months",
  half_year: "Half year",
  year: "Year",
};

const WINDOW_SPANS: Readonly<Record<Exclude<BodyViewMode, "overall">, string>> = {
  month: "30 days",
  quarter: "3 months",
  half_year: "half year",
  year: "year",
};

/** Anatomical display order for every list of areas. */
export const AREA_ORDER: readonly MuscleGroup[] = [
  "neck", "traps", "shoulders", "chest", "biceps", "triceps", "forearms",
  "lats", "middle back", "lower back", "abdominals", "glutes", "quadriceps",
  "hamstrings", "adductors", "abductors", "calves",
];

export type Level = "heavy" | "moderate" | "light" | "none";

/** Heavy at 1.5× the median of trained areas or more; Moderate from 0.75×; Light above 0. */
const HEAVY_RATIO = 1.5;
const MODERATE_RATIO = 0.75;

/**
 * `value >= bound`, forgiving float noise: legacy rows split sets into
 * thirds and Overall decays them, so an exact 2:1 can sum a hair short.
 */
function atLeast(value: number, bound: number): boolean {
  return value >= bound - Math.abs(bound) * 1e-9;
}

// ---------------------------------------------------------------- levels

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Level per area against the median of the trained areas (one trained area is Moderate). */
export function levelsFromScores(scores: MuscleLoadMap): Record<MuscleGroup, Level> {
  const trained = AREA_ORDER.map((area) => scores[area] ?? 0).filter((score) => score > 0);
  const m = trained.length > 0 ? median(trained) : 0;
  const levels = {} as Record<MuscleGroup, Level>;
  for (const area of AREA_ORDER) {
    levels[area] = levelFor(scores[area] ?? 0, m);
  }
  return levels;
}

function levelFor(score: number, medianScore: number): Level {
  if (score <= 0) {
    return "none";
  }
  if (atLeast(score, HEAVY_RATIO * medianScore)) {
    return "heavy";
  }
  return atLeast(score, MODERATE_RATIO * medianScore) ? "moderate" : "light";
}

// ---------------------------------------------------------------- pairs

export type PairId = "push_pull" | "upper_lower" | "front_back" | "squat_hinge" | "abs_lower_back";
export type SideId =
  | "push" | "pull" | "upper" | "lower" | "front" | "back" | "squat" | "hinge" | "abs" | "lower_back";

export type CaricatureId =
  | "mostly-push" | "mostly-pull" | "upper-heavy" | "lower-heavy" | "mostly-squat" | "mostly-hinge"
  | "front-heavy" | "back-heavy"
  | "push-upper" | "push-front" | "pull-upper" | "lower-squat" | "lower-hinge" | "upper-front"
  | "even" | "untrained";

interface SideSpec {
  id: SideId;
  /** "Mostly push" */
  mostly: string;
  /** Figure when this side is the heavy one. Abs v Lower back reuses the front/back figures. */
  caricature: CaricatureId;
  /** "No pulling" */
  none: string;
  /** Headline subject: "Pushing", "Abs". */
  subject: string;
  /** Headline object: "pulling", "lower-back work". */
  noun: string;
  plural?: boolean;
  /** Patterns that feed this side (movement pairs). */
  patterns?: readonly Pattern[];
  /** Areas that feed this side (area pairs), and the areas the sub-line and moves look at. */
  areas: readonly MuscleGroup[];
}

interface PairSpec {
  id: PairId;
  label: string;
  basis: "pattern" | "area";
  sides: readonly [SideSpec, SideSpec];
}

const PUSH_AREAS: readonly MuscleGroup[] = ["chest", "shoulders", "triceps"];
const PULL_AREAS: readonly MuscleGroup[] = ["lats", "middle back", "traps", "biceps"];
const SQUAT_AREAS: readonly MuscleGroup[] = ["quadriceps", "glutes", "adductors"];
const HINGE_AREAS: readonly MuscleGroup[] = ["hamstrings", "glutes", "lower back"];
const PUSH_PATTERNS: readonly Pattern[] = ["horizontal_push", "vertical_push"];
const PULL_PATTERNS: readonly Pattern[] = ["horizontal_pull", "vertical_pull"];

/** Front v Back areas (user override); shoulders, forearms, neck, adductors and abductors sit out. */
const FRONT_AREAS: readonly MuscleGroup[] = ["chest", "abdominals", "quadriceps", "biceps"];
const BACK_AREAS: readonly MuscleGroup[] = [
  "traps", "lats", "middle back", "lower back", "glutes", "hamstrings", "calves", "triceps",
];

export const PAIRS: readonly PairSpec[] = [
  {
    id: "push_pull", label: "Push v Pull", basis: "pattern",
    sides: [
      { id: "push", mostly: "Mostly push", caricature: "mostly-push", none: "No pushing", subject: "Pushing", noun: "pushing", patterns: PUSH_PATTERNS, areas: PUSH_AREAS },
      { id: "pull", mostly: "Mostly pull", caricature: "mostly-pull", none: "No pulling", subject: "Pulling", noun: "pulling", patterns: PULL_PATTERNS, areas: PULL_AREAS },
    ],
  },
  {
    id: "upper_lower", label: "Upper v Lower", basis: "pattern",
    sides: [
      { id: "upper", mostly: "Mostly upper", caricature: "upper-heavy", none: "No upper body", subject: "Upper body", noun: "upper-body work", patterns: [...PUSH_PATTERNS, ...PULL_PATTERNS], areas: [...PUSH_AREAS, ...PULL_AREAS] },
      { id: "lower", mostly: "Mostly lower", caricature: "lower-heavy", none: "No lower body", subject: "Lower body", noun: "lower-body work", patterns: ["squat", "hinge"], areas: ["quadriceps", "glutes", "hamstrings", "lower back", "adductors", "calves"] },
    ],
  },
  {
    id: "front_back", label: "Front v Back", basis: "area",
    sides: [
      { id: "front", mostly: "Mostly front", caricature: "front-heavy", none: "No front", subject: "The front", noun: "front work", areas: FRONT_AREAS },
      { id: "back", mostly: "Mostly back", caricature: "back-heavy", none: "No back", subject: "The back", noun: "back work", areas: BACK_AREAS },
    ],
  },
  {
    id: "squat_hinge", label: "Squat v Hinge", basis: "pattern",
    sides: [
      { id: "squat", mostly: "Mostly squat", caricature: "mostly-squat", none: "No squatting", subject: "Squatting", noun: "squatting", patterns: ["squat"], areas: SQUAT_AREAS },
      { id: "hinge", mostly: "Mostly hinge", caricature: "mostly-hinge", none: "No hinging", subject: "Hinging", noun: "hinging", patterns: ["hinge"], areas: HINGE_AREAS },
    ],
  },
  {
    id: "abs_lower_back", label: "Abs v Lower back", basis: "area",
    sides: [
      { id: "abs", mostly: "Mostly abs", caricature: "front-heavy", none: "No ab work", subject: "Abs", noun: "ab work", plural: true, areas: ["abdominals"] },
      { id: "lower_back", mostly: "Mostly lower back", caricature: "back-heavy", none: "No lower back work", subject: "Lower back", noun: "lower-back work", areas: ["lower back"] },
    ],
  },
];

export type TakeawayKind = "even" | "mostly" | "no" | "neither" | "no_data";

export interface PairResult {
  id: PairId;
  /** Raw amounts, first side then second. */
  amounts: readonly [number, number];
  kind: TakeawayKind;
  word: string;
  /** Index of the bigger side when uneven. */
  heavySide?: 0 | 1;
  /** Smaller side's share of the total, 0..0.5; undefined when there is no work. */
  smallerShare?: number;
}

/** Takeaway: smaller share ≥ ⅓ → Even, above 0 → Mostly <bigger>, 0 → No <smaller>. */
export function takeaway(
  spec: PairSpec,
  a: number,
  b: number,
): Pick<PairResult, "kind" | "word" | "heavySide" | "smallerShare"> {
  const total = a + b;
  if (total <= 0) {
    return { kind: "neither", word: "Neither in this window" };
  }
  const smaller = Math.min(a, b);
  const smallerShare = smaller / total;
  if (atLeast(3 * smaller, total)) {
    return { kind: "even", word: "Even", smallerShare };
  }
  const heavySide: 0 | 1 = a >= b ? 0 : 1;
  const light = spec.sides[1 - heavySide]!;
  const heavy = spec.sides[heavySide];
  return smaller === 0
    ? { kind: "no", word: light.none, heavySide, smallerShare }
    : { kind: "mostly", word: heavy.mostly, heavySide, smallerShare };
}

/** "Push v Pull". */
export function pairLabel(pair: PairResult): string {
  return pairSpec(pair.id).label;
}

/** Whole-number shares summing to 100 (0/0 when neither side has work). */
export function pairShares(pair: PairResult): readonly [number, number] {
  const [a, b] = pair.amounts;
  const total = a + b;
  if (total <= 0) {
    return [0, 0];
  }
  const first = Math.round((100 * a) / total);
  return [first, 100 - first];
}

/** A pair with something to compare (not "neither" or "no data"). */
export function hasWork(pair: PairResult): boolean {
  return pair.kind !== "neither" && pair.kind !== "no_data";
}

function pairResult(spec: PairSpec, a: number, b: number): PairResult {
  return { id: spec.id, amounts: [a, b], ...takeaway(spec, a, b) };
}

function noDataPair(spec: PairSpec): PairResult {
  return { id: spec.id, amounts: [0, 0], kind: "no_data", word: "No data in this window" };
}

function isUneven(pair: PairResult): boolean {
  return pair.kind === "mostly" || pair.kind === "no";
}

/** Uneven pairs, most uneven first (smallest minority share; ties keep pair order). */
export function unevenRanked(pairs: readonly PairResult[]): PairResult[] {
  return pairs
    .map((pair, index) => ({ pair, index }))
    .filter(({ pair }) => isUneven(pair))
    .sort((x, y) => x.pair.smallerShare! - y.pair.smallerShare! || x.index - y.index)
    .map(({ pair }) => pair);
}

// ---------------------------------------------------------------- set counting

/**
 * Sets per exercise for one session. With a set log, each logged (not skipped)
 * set counts for its own move; legacy rows spread `setCount` evenly over
 * `exerciseIds`.
 */
export function setsPerExercise(entry: HistoryEntry): Map<string, number> {
  return entry.sets && entry.sets.length > 0 ? loggedSets(entry.sets) : legacySets(entry);
}

function loggedSets(sets: NonNullable<HistoryEntry["sets"]>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const set of sets) {
    if (set.stopReason !== "skipped") {
      counts.set(set.exerciseId, (counts.get(set.exerciseId) ?? 0) + 1);
    }
  }
  return counts;
}

function legacySets(entry: HistoryEntry): Map<string, number> {
  const counts = new Map<string, number>();
  const ids = entry.exerciseIds;
  if (ids.length === 0 || !Number.isFinite(entry.setCount) || entry.setCount <= 0) {
    return counts;
  }
  const share = entry.setCount / ids.length;
  for (const id of ids) {
    counts.set(id, (counts.get(id) ?? 0) + share);
  }
  return counts;
}

/** Window-weighted sets per movement pattern. */
export function patternSets(
  history: readonly HistoryEntry[],
  mode: BodyViewMode,
  nowMs: number,
  graph: Readonly<Record<string, Pick<SeedExercise, "pattern">>>,
): Partial<Record<Pattern, number>> {
  const totals: Partial<Record<Pattern, number>> = {};
  for (const entry of history) {
    const weight = windowWeight(entry, mode, nowMs);
    if (weight <= 0) {
      continue;
    }
    for (const [id, sets] of setsPerExercise(entry)) {
      const exercise = graph[id];
      if (exercise) {
        totals[exercise.pattern] = (totals[exercise.pattern] ?? 0) + sets * weight;
      }
    }
  }
  return totals;
}

function sessionsInWindow(history: readonly HistoryEntry[], mode: BodyViewMode, nowMs: number): number {
  return history.filter((entry) => windowWeight(entry, mode, nowMs) > 0).length;
}

// ---------------------------------------------------------------- caricature

/** Two heavy-side figures (sorted, "a+b") that have a combined figure of their own. */
const COMBINATIONS: ReadonlyMap<string, CaricatureId> = new Map<string, CaricatureId>([
  ["mostly-push+upper-heavy", "push-upper"],
  ["front-heavy+mostly-push", "push-front"],
  ["mostly-pull+upper-heavy", "pull-upper"],
  ["lower-heavy+mostly-squat", "lower-squat"],
  ["lower-heavy+mostly-hinge", "lower-hinge"],
  ["front-heavy+upper-heavy", "upper-front"],
]);

function pairSpec(id: PairId): PairSpec {
  return PAIRS.find((spec) => spec.id === id)!;
}

function heavySide(pair: PairResult): SideSpec {
  return pairSpec(pair.id).sides[pair.heavySide!];
}

function lightSide(pair: PairResult): SideSpec {
  return pairSpec(pair.id).sides[1 - pair.heavySide!]!;
}

/**
 * 0 uneven pairs → even. 1 → its single. 2+ → the combination of the two most
 * uneven pairs when one exists (two pairs with the same figure stay single),
 * else the most uneven pair's single.
 */
export function chooseCaricature(
  pairs: readonly PairResult[],
  ranked: readonly PairResult[] = unevenRanked(pairs),
): CaricatureId {
  if (!pairs.some(hasWork)) {
    return "untrained";
  }
  if (ranked.length === 0) {
    return "even";
  }
  const first = heavySide(ranked[0]!).caricature;
  if (ranked.length === 1) {
    return first;
  }
  const second = heavySide(ranked[1]!).caricature;
  return COMBINATIONS.get([first, second].sort().join("+")) ?? first;
}

// ---------------------------------------------------------------- text

export function areaName(area: MuscleGroup): string {
  return area.charAt(0).toUpperCase() + area.slice(1);
}

function joinList(items: readonly string[]): string {
  if (items.length <= 1) {
    return items.join("");
  }
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const COUNT_WORDS = ["No", "One", "Two", "Three", "Four", "Five"];

/** Sentence for the most uneven pair: "Pushing has no pulling to match." */
function unevenSentence(pair: PairResult): string {
  const heavy = heavySide(pair);
  const light = lightSide(pair);
  if (pair.kind === "no") {
    return `${heavy.subject} ${heavy.plural ? "have" : "has"} no ${light.noun} to match.`;
  }
  return `${heavy.subject} ${heavy.plural ? "outweigh" : "outweighs"} ${light.noun}.`;
}

/** Balance headline: pair names only, even first, then what is missing. */
export function headlineFor(
  pairs: readonly PairResult[],
  ranked: readonly PairResult[] = unevenRanked(pairs),
): string {
  if (!pairs.some(hasWork)) {
    return "No push, pull, squat, hinge or core work in this window.";
  }
  const even = pairs.filter((pair) => pair.kind === "even");
  if (ranked.length === 0) {
    return even.length === PAIRS.length
      ? `All ${COUNT_WORDS[PAIRS.length]!.toLowerCase()} pairs are even in this window.`
      : "Every pair with work is even in this window.";
  }
  return [evenPhrase(even), unevenSentence(ranked[0]!)].filter(Boolean).join(" ");
}

/** "Push and pull are even.", from the sides' "Mostly …" labels. */
function evenSentence(spec: PairSpec): string {
  const [a, b] = spec.sides.map((side) => side.mostly.replace(/^Mostly /, ""));
  return `${a![0]!.toUpperCase()}${a!.slice(1)} and ${b} are even.`;
}

function evenPhrase(even: readonly PairResult[]): string {
  if (even.length === 0) {
    return "";
  }
  return even.length === 1 ? evenSentence(pairSpec(even[0]!.id)) : `${COUNT_WORDS[even.length]} pairs are even.`;
}

/** Areas at one level, in display order. */
function areasAt(levels: Record<MuscleGroup, Level>, level: Level): MuscleGroup[] {
  return AREA_ORDER.filter((area) => levels[area] === level);
}

/** Sub-line naming untrained areas, the light side's first. */
export function sublineFor(
  pairs: readonly PairResult[],
  levels: Record<MuscleGroup, Level>,
  ranked: readonly PairResult[] = unevenRanked(pairs),
): string {
  const untrained = areasAt(levels, "none");
  if (untrained.length === 0) {
    return "Every area had some work in this window.";
  }
  const lightAreas = ranked[0] ? lightSide(ranked[0]).areas : [];
  const focus = untrained.filter((area) => lightAreas.includes(area));
  const named = (focus.length > 0 ? focus : untrained).map((area, index) =>
    index === 0 ? areaName(area) : area,
  );
  const shown = named.slice(0, 3);
  const extra = named.length - shown.length;
  const list = extra > 0 ? `${shown.join(", ")} and ${extra} more` : joinList(shown);
  return `${list} had none in this window.`;
}

// ---------------------------------------------------------------- moves

export interface MoveSuggestion {
  exerciseId: string;
  /** Display name: sentence case, proper nouns kept ("Kneeling Superman"). */
  name: string;
  /** Not trained or Light primary areas the move covers, in display order. */
  areas: MuscleGroup[];
}

const MOVE_PATTERNS: readonly Pattern[] = [
  ...PUSH_PATTERNS, ...PULL_PATTERNS, "squat", "hinge", "core_compression", "core_anti_extension",
];

const DIFFICULTY_RANK: Readonly<Record<SkillTier, number>> = {
  novice: 0, beginner: 1, intermediate: 2, advanced: 3, elite: 4,
};

export const MAX_MOVES = 3;

export interface MoveInput {
  pairs: readonly PairResult[];
  levels: Record<MuscleGroup, Level>;
  graph: Readonly<Record<string, SeedExercise>>;
  equipment: readonly EquipmentId[];
  excluded?: readonly string[];
  memories?: Readonly<Record<string, ExerciseMemory>>;
  /** `unevenRanked(pairs)` when the caller already has it. */
  ranked?: readonly PairResult[];
}

/** A Library move that can be suggested, with what ranking needs precomputed. */
interface Candidate {
  exercise: SeedExercise;
  /** Primary areas, weight 1. */
  primaries: readonly MuscleGroup[];
  sourceRank: number;
  /** Position in the graph; keeps ties in graph order. */
  order: number;
}

interface CandidateIndex {
  all: readonly Candidate[];
  byPattern: ReadonlyMap<Pattern, readonly Candidate[]>;
}

const candidateIndexes = new WeakMap<object, CandidateIndex>();

/** Suggestable moves per pattern, built once per graph on first use. */
function candidateIndex(graph: Readonly<Record<string, SeedExercise>>): CandidateIndex {
  let index = candidateIndexes.get(graph);
  if (!index) {
    const all = Object.entries(graph)
      .filter(([key, exercise]) => key === exercise.id && MOVE_PATTERNS.includes(exercise.pattern))
      .map(([, exercise], order): Candidate => ({
        exercise,
        primaries: [...strongestWeightPerGroup(exercise)].filter(([, weight]) => weight === 1).map(([group]) => group),
        sourceRank: sourceRank(exercise.id),
        order,
      }));
    const byPattern = new Map<Pattern, Candidate[]>();
    for (const candidate of all) {
      byPattern.set(candidate.exercise.pattern, [...(byPattern.get(candidate.exercise.pattern) ?? []), candidate]);
    }
    index = { all, byPattern };
    candidateIndexes.set(graph, index);
  }
  return index;
}

/** What ranking a move needs, computed once per suggestion run. */
interface MoveContext {
  /** The side the moves are for; none when every pair is even. */
  side?: SideSpec;
  /** Not trained areas, plus Light ones unless every pair is even. */
  wanted: ReadonlySet<MuscleGroup>;
  memories: Readonly<Record<string, ExerciseMemory>>;
}

/**
 * Up to three Library moves for the light side of the most uneven pair: on
 * that side (by pattern, or by primary area for area pairs), with at least one
 * Not trained or Light primary area, doable with the owned gear, ranked by
 * how many such areas they cover. When every pair is even, moves for Not
 * trained areas only.
 */
export function suggestMoves(input: MoveInput): MoveSuggestion[] {
  const target = moveTarget(input.pairs, input.ranked ?? unevenRanked(input.pairs));
  if (!target) {
    return [];
  }
  const { side, allEven } = target;
  const { levels, graph, equipment } = input;
  const excluded = new Set(input.excluded);
  const context: MoveContext = {
    side,
    wanted: new Set(AREA_ORDER.filter((area) => levels[area] === "none" || (!allEven && levels[area] === "light"))),
    memories: input.memories ?? {},
  };
  const index = candidateIndex(graph);
  const candidates = side?.patterns ? side.patterns.flatMap((pattern) => index.byPattern.get(pattern) ?? []) : index.all;

  const picks = candidates
    .filter(({ exercise }) => !excluded.has(exercise.id) && missingGear(exercise, equipment).length === 0)
    .map((candidate) => rankMove(candidate, context))
    .filter((pick): pick is RankedMove => pick !== undefined)
    .sort(compareMoves);
  return firstDistinct(picks, MAX_MOVES);
}

/** The light side of the most uneven pair; no side (Not trained areas only) when all pairs are even. */
function moveTarget(
  pairs: readonly PairResult[],
  ranked: readonly PairResult[],
): { side?: SideSpec; allEven: boolean } | undefined {
  if (ranked[0]) {
    return { side: lightSide(ranked[0]), allEven: false };
  }
  return pairs.some((pair) => pair.kind === "even") ? { allEven: true } : undefined;
}

interface RankedMove extends MoveSuggestion {
  score: number[];
  order: number;
}

/** The move as a suggestion for this side, or undefined when it is not on the side or covers no wanted area. */
function rankMove({ exercise, primaries, sourceRank, order }: Candidate, context: MoveContext): RankedMove | undefined {
  const { side, wanted, memories } = context;
  // Pattern sides were matched by pattern; area sides (and the all-even case) need a wanted primary area.
  if (!side?.patterns && side && !primaries.some((area) => side.areas.includes(area) && wanted.has(area))) {
    return undefined;
  }
  const areas = AREA_ORDER.filter((area) => primaries.includes(area) && wanted.has(area));
  if (areas.length === 0) {
    return undefined;
  }
  return {
    exerciseId: exercise.id,
    name: displayExerciseName(exercise.name),
    areas,
    order,
    score: [
      -areas.length,
      memories[exercise.id] ? 0 : 1,
      sourceRank,
      DIFFICULTY_RANK[exercise.difficulty ?? "intermediate"],
    ],
  };
}

function compareMoves(x: RankedMove, y: RankedMove): number {
  const index = x.score.findIndex((value, i) => value !== y.score[i]);
  return index >= 0 ? x.score[index]! - y.score[index]! : x.name.localeCompare(y.name) || x.order - y.order;
}

/** The first `limit` moves with distinct names (imported sources repeat names). */
function firstDistinct(picks: readonly RankedMove[], limit: number): MoveSuggestion[] {
  const seen = new Set<string>();
  const out: MoveSuggestion[] = [];
  for (const { exerciseId, name, areas } of picks) {
    const key = name.toLowerCase();
    if (out.length < limit && !seen.has(key)) {
      seen.add(key);
      out.push({ exerciseId, name, areas });
    }
  }
  return out;
}

// ---------------------------------------------------------------- model

export type BalanceState = "ready" | "empty" | "no_sessions";

export interface BalanceInput {
  mode: BodyViewMode;
  nowMs: number;
  history: readonly HistoryEntry[];
  graph: Readonly<Record<string, SeedExercise>>;
  equipment: readonly EquipmentId[];
  excluded?: readonly string[];
  memories?: Readonly<Record<string, ExerciseMemory>>;
  /** Per-area window scores; defaults to aggregate.ts (Overall decayed set-load, periods exercise counts). */
  scores?: MuscleLoadMap;
}

export interface BalanceModel {
  state: BalanceState;
  mode: BodyViewMode;
  headline: string;
  subline: string;
  levels: Record<MuscleGroup, Level>;
  notTrained: MuscleGroup[];
  lighter: MuscleGroup[];
  pairs: PairResult[];
  /** Pair whose takeaway word carries the accent; none when all pairs are even. */
  accent?: PairId;
  caricature: CaricatureId;
  moves: MoveSuggestion[];
  /** For a window with no sessions: the next wider window that has some. */
  tryMode?: BodyViewMode;
}

function sumAreas(scores: MuscleLoadMap, areas: readonly MuscleGroup[]): number {
  return areas.reduce((total, area) => total + (scores[area] ?? 0), 0);
}

function sumPatterns(totals: Partial<Record<Pattern, number>>, patterns: readonly Pattern[]): number {
  return patterns.reduce((total, pattern) => total + (totals[pattern] ?? 0), 0);
}

export function computePairs(
  scores: MuscleLoadMap,
  patternTotals: Partial<Record<Pattern, number>>,
): PairResult[] {
  return PAIRS.map((spec) => {
    const [a, b] = spec.sides.map((side) =>
      spec.basis === "pattern" ? sumPatterns(patternTotals, side.patterns!) : sumAreas(scores, side.areas),
    );
    return pairResult(spec, a!, b!);
  });
}

function noSessionsHeadline(mode: BodyViewMode): string {
  return mode === "overall" ? "No sessions yet" : `No sessions in the last ${WINDOW_SPANS[mode]}`;
}

function stateFor(usable: readonly HistoryEntry[], mode: BodyViewMode, nowMs: number): BalanceState {
  if (usable.length === 0) {
    return "empty";
  }
  return sessionsInWindow(usable, mode, nowMs) === 0 ? "no_sessions" : "ready";
}

/** Empty history, or a window with no sessions: every area Not trained, no pairs, no moves. */
function idleModel(state: Exclude<BalanceState, "ready">, input: BalanceInput, usable: readonly HistoryEntry[]): BalanceModel {
  const { mode, nowMs } = input;
  const wider = BODY_WINDOWS.slice(BODY_WINDOWS.indexOf(mode) + 1);
  return {
    state,
    mode,
    headline: state === "empty" ? "Body fills in after your first finished session." : noSessionsHeadline(mode),
    subline: "",
    levels: levelsFromScores({}),
    notTrained: [...AREA_ORDER],
    lighter: [],
    pairs: PAIRS.map(noDataPair),
    caricature: "untrained",
    moves: [],
    tryMode:
      state === "no_sessions"
        ? (wider.find((next) => sessionsInWindow(usable, next, nowMs) > 0) ?? "overall")
        : undefined,
  };
}

export function buildBalanceModel(input: BalanceInput): BalanceModel {
  const { mode, nowMs, history } = input;
  const usable = history.filter((entry) => entryCompletedAtMs(entry) !== undefined && entry.exerciseIds.length > 0);
  const state = stateFor(usable, mode, nowMs);
  if (state !== "ready") {
    return idleModel(state, input, usable);
  }

  const scores = input.scores ?? aggregateBodyView([...usable], mode, nowMs);
  const levels = levelsFromScores(scores);
  const pairs = computePairs(scores, patternSets(usable, mode, nowMs, input.graph));
  const ranked = unevenRanked(pairs);
  return {
    state,
    mode,
    headline: headlineFor(pairs, ranked),
    subline: sublineFor(pairs, levels, ranked),
    levels,
    notTrained: areasAt(levels, "none"),
    lighter: areasAt(levels, "light"),
    pairs,
    accent: ranked[0]?.id,
    caricature: chooseCaricature(pairs, ranked),
    moves: suggestMoves({ ...input, pairs, levels, ranked }),
  };
}
