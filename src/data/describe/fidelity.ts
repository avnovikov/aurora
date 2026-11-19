/**
 * Deterministic fidelity judge: curated Library text vs original source corpus.
 *
 * Thresholds (starting point):
 * - Soft warn: recall < 0.25
 * - Hard fail: recall < 0.15, or template flag with recall < 0.25
 * - Thin originals (source_chars < THIN_SOURCE_CHARS) are allowlisted automatically
 *   (house-written when source is empty / near-empty).
 *
 * Token recall = |informative source tokens ∩ curated| / |source tokens|.
 * Does not invent semantics; low recall means curated dropped too much original.
 */
import type { CuratedDescription } from "./types";

/** Originals shorter than this may be house-written without hard fail. */
export const THIN_SOURCE_CHARS = 40;

export const HARD_RECALL = 0.15;
export const SOFT_RECALL = 0.25;

/** Generic fill patterns that look like agent boilerplate, not house coaching. */
const TEMPLATE_PATTERNS: RegExp[] = [
  /set up for .{0,80}braced torso/i,
  /set up for .+ with a (?:kettlebell|dumbbell|band)?.{0,40}braced torso/i,
  /move through a full range with control, then return without losing posture/i,
  /is a \w[\w\s-]* exercise with a kettlebell, done with steady control/i,
  /get into (a |the )?ready position/i,
  /perform the movement with control/i,
];

/** Sources that are not usable how-to text (video links, metadata, name-only blurbs). */
const NON_INSTRUCTIONAL_SOURCE: RegExp[] = [
  /youtube\.com|youtu\.be/i,
  /view the video/i,
  /see this instructive video/i,
  /part of:\s*limber/i,
  /prescription:\s*\d+/i,
  /roller skating is a fun activity/i,
];

const ACTION_HINTS = new Set([
  "stand",
  "lie",
  "sit",
  "hold",
  "pull",
  "press",
  "bend",
  "lift",
  "step",
  "place",
  "grip",
  "hang",
  "lower",
  "raise",
  "push",
  "kneel",
  "hinge",
  "squat",
  "lunge",
  "curl",
  "row",
  "jump",
  "walk",
  "reach",
  "extend",
  "flex",
]);

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "to",
  "of",
  "in",
  "on",
  "with",
  "your",
  "you",
  "for",
  "from",
  "at",
  "is",
  "are",
  "be",
  "as",
  "into",
  "that",
  "this",
  "then",
  "by",
  "it",
  "its",
  "will",
  "be",
  "should",
  "can",
  "do",
  "not",
  "so",
  "up",
  "down",
  "out",
  "off",
  "both",
  "each",
  "all",
  "one",
  "two",
  "next",
  "back",
  "over",
  "under",
  "until",
  "while",
  "when",
  "than",
  "them",
  "their",
  "there",
  "here",
  "also",
  "using",
  "use",
  "keep",
  "make",
  "take",
  "get",
]);

export interface FidelityScore {
  id: string;
  name: string;
  recall: number;
  template: boolean;
  overTrim: boolean;
  sourceChars: number;
  curatedChars: number;
  thinSource: boolean;
  softWarn: boolean;
  hardFail: boolean;
  allowlisted: boolean;
}

export interface FidelityAllowlist {
  /** Explicit ids exempt from hard fail (documented reasons elsewhere). */
  ids?: readonly string[];
}

/** Informative tokens for overlap scoring. */
export function informativeTokens(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .replaceAll(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
  return new Set(tokens);
}

export function tokenRecall(sourceText: string, curatedText: string): number {
  const source = informativeTokens(sourceText);
  if (source.size === 0) {
    return 1;
  }
  const curated = informativeTokens(curatedText);
  let hit = 0;
  for (const token of source) {
    if (curated.has(token)) {
      hit += 1;
    }
  }
  return hit / source.size;
}

export function curatedCorpus(entry: CuratedDescription): string {
  return [entry.summary, ...entry.steps, ...entry.cues].join(" ");
}

export function looksLikeTemplate(curatedText: string): boolean {
  return TEMPLATE_PATTERNS.some((pattern) => pattern.test(curatedText));
}

/**
 * True when the original cannot ground a fidelity check (too thin, link-only,
 * metadata, or no movement verbs). House-written curated text is allowed.
 */
export function isNonInstructionalSource(sourceCorpus: string, sourceChars: number): boolean {
  if (sourceChars < THIN_SOURCE_CHARS) {
    return true;
  }
  if (NON_INSTRUCTIONAL_SOURCE.some((pattern) => pattern.test(sourceCorpus))) {
    return true;
  }
  const tokens = informativeTokens(sourceCorpus);
  const actionCount = [...tokens].filter((token) => ACTION_HINTS.has(token)).length;
  // Marketing / encyclopedia blurbs often lack real how-to verbs.
  return actionCount < 2;
}

/**
 * Original had real how-to text but curated collapsed to ≤2 steps with a
 * template flag (agent fill), not merely a short legitimate how-to.
 */
export function isOverTrimmed(
  sourceChars: number,
  entry: CuratedDescription,
  recall: number,
  template: boolean,
): boolean {
  if (sourceChars < 120 || !template) {
    return false;
  }
  return entry.steps.length <= 2 && recall < 0.55;
}

export function scoreFidelity(input: {
  id: string;
  name: string;
  sourceCorpus: string;
  sourceChars: number;
  curated: CuratedDescription;
  allowlistIds: ReadonlySet<string>;
}): FidelityScore {
  const curatedText = curatedCorpus(input.curated);
  const recall = tokenRecall(input.sourceCorpus, curatedText);
  const template = looksLikeTemplate(curatedText);
  const overTrim = isOverTrimmed(input.sourceChars, input.curated, recall, template);
  const thinSource = isNonInstructionalSource(input.sourceCorpus, input.sourceChars);
  const allowlisted = thinSource || input.allowlistIds.has(input.id);
  const softWarn = !allowlisted && recall < SOFT_RECALL;
  const hardFail =
    !allowlisted && (recall < HARD_RECALL || template || overTrim);

  return {
    id: input.id,
    name: input.name,
    recall,
    template,
    overTrim,
    sourceChars: input.sourceChars,
    curatedChars: curatedText.length,
    thinSource,
    softWarn,
    hardFail,
    allowlisted,
  };
}

export function loadAllowlistIds(raw: FidelityAllowlist | null | undefined): Set<string> {
  return new Set(raw?.ids ?? []);
}
