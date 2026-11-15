import { decodeEntities, stripTags } from "../enrich/stripTags";

/** Filler sentences common in imported instructions; they add nothing. */
const BOILERPLATE = [
  "this will be your starting position",
  "this is your starting position",
  "repeat for the recommended amount",
  "repeat for the desired number",
  "repeat for the prescribed",
  "repeat as necessary",
  "repeat to complete the set",
  "repeat for the recommended number",
];

/** Normalise one imported instruction line; empty when it is pure filler. */
export function cleanSentence(raw: string): string {
  const text = decodeEntities(stripTags(raw))
    .replaceAll(/\s+/g, " ")
    .replace(/^\s*(\d+[.)]|[-•*])\s*/, "")
    .trim();
  if (!text) {
    return "";
  }
  const kept = text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !BOILERPLATE.some((phrase) => sentence.toLowerCase().includes(phrase)))
    .join(" ")
    .trim();
  if (!kept) {
    return "";
  }
  const capitalised = kept.charAt(0).toUpperCase() + kept.slice(1);
  return /[.!?:]$/.test(capitalised) ? capitalised : `${capitalised}.`;
}

export function cleanLines(lines: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const cleaned = cleanSentence(line);
    const key = cleaned.toLowerCase();
    if (cleaned && !seen.has(key)) {
      seen.add(key);
      out.push(cleaned);
    }
  }
  return out;
}
