import type { CuratedDescription } from "./types";

const BANNED = [
  "starting position",
  "recommended amount",
  "recommended number",
  "repeat for",
  "desired number of",
  "nike",
  "this exercise",
];

interface Limit {
  min: number;
  max: number;
  maxChars: number;
}

const LIMITS: Record<"steps" | "cues" | "mistakes", Limit> = {
  steps: { min: 2, max: 7, maxChars: 180 },
  cues: { min: 1, max: 5, maxChars: 55 },
  mistakes: { min: 0, max: 4, maxChars: 130 },
};

function listProblems(field: keyof typeof LIMITS, list: unknown): string[] {
  const limit = LIMITS[field];
  if (!Array.isArray(list) || list.length < limit.min || list.length > limit.max) {
    return [`${field} count ${Array.isArray(list) ? list.length : "missing"}`];
  }
  return list.flatMap((line: unknown, index) =>
    typeof line === "string" && line.trim() && line.length <= limit.maxChars
      ? []
      : [`${field}[${index}] length`],
  );
}

function bannedPhrases(entry: CuratedDescription): string[] {
  const text = [entry.summary, ...entry.steps, ...entry.cues, ...entry.mistakes]
    .join(" ")
    .toLowerCase();
  return BANNED.filter((phrase) => text.includes(phrase)).map((phrase) => `banned phrase "${phrase}"`);
}

/** House-style checks; returns human-readable problems (empty when valid). */
export function descriptionProblems(entry: CuratedDescription): string[] {
  const summary = typeof entry.summary === "string" ? entry.summary.trim() : "";
  const problems = summary.length < 30 || summary.length > 220 ? [`summary length ${summary.length}`] : [];
  const listIssues = (["steps", "cues", "mistakes"] as const).flatMap((field) =>
    listProblems(field, entry[field]),
  );
  if (listIssues.length > 0) {
    return [...problems, ...listIssues];
  }
  return [...problems, ...bannedPhrases(entry)];
}
