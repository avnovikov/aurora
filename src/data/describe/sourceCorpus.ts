/**
 * Original (pre-curation) description text per Library id.
 * Uses unenriched catalogues + folded FEDB/wger duplicate lines — never
 * LIBRARY_CATALOGUE after enrichCatalogue, which already replaced text.
 *
 * Callers that need disk I/O (scripts / Vitest) read the raw JSON and pass it in.
 */
import { buildFedbCatalogue, parseFedbJson } from "../fedb/buildCatalogue";
import { FEDB_ATTRIBUTION } from "../fedb/types";
import { FEDB_CATALOGUE } from "../generated/fedbCatalogue";
import { HF_CATALOGUE } from "../generated/hfCatalogue";
import { WGER_CATALOGUE } from "../generated/wgerCatalogue";
import { buildLibraryCatalogue } from "../libraryCatalogue";
import { mergeSeedDuplicates } from "../mergeSeedDuplicates";
import { NTC_CATALOGUE } from "../ntc/ntcCatalogue";
import { SEED_EXERCISES, type SeedExercise } from "../seed";
import { buildWgerCatalogue } from "../wger/buildCatalogue";
import { wgerAttribution, wgerDescriptionLines } from "../wger/mapWgerExercise";
import type { WgerExerciseRecord } from "../wger/types";
import { cleanLines } from "./cleanText";

export interface SourceTextBlock {
  source: string;
  name: string;
  lines: string[];
}

export interface SourceCorpusEntry {
  id: string;
  name: string;
  texts: SourceTextBlock[];
  /**
   * Own cleaned lines for this id (unenriched catalogue). Fidelity scores
   * against this — not folded duplicate Wikipedia/marketing blurbs.
   */
  corpus: string;
  sourceChars: number;
}

function ownText(exercise: SeedExercise): SourceTextBlock {
  const lines = exercise.description
    ? [...new Set([exercise.description, ...exercise.cues])]
    : exercise.cues;
  return {
    source: exercise.attribution ?? "Aurora seed (written in-house)",
    name: exercise.name,
    lines: cleanLines(lines),
  };
}

function unenrichedCatalogue(): SeedExercise[] {
  const merged = mergeSeedDuplicates(
    SEED_EXERCISES,
    buildLibraryCatalogue([], HF_CATALOGUE, NTC_CATALOGUE, FEDB_CATALOGUE, WGER_CATALOGUE),
  );
  return buildLibraryCatalogue(merged.seed, merged.imported);
}

function appendBlock(
  extras: Map<string, SourceTextBlock[]>,
  intoId: string,
  text: SourceTextBlock,
): void {
  if (text.lines.length === 0) {
    return;
  }
  extras.set(intoId, [...(extras.get(intoId) ?? []), text]);
}

/** Folded duplicate lines keyed by the Library id they merged into. */
function foldedExtras(
  fedbJson: string,
  wgerRaw: WgerExerciseRecord[],
): Map<string, SourceTextBlock[]> {
  const extras = new Map<string, SourceTextBlock[]>();
  const prior = [...SEED_EXERCISES, ...HF_CATALOGUE, ...NTC_CATALOGUE];

  const fedb = buildFedbCatalogue(parseFedbJson(fedbJson), prior);
  for (const { record, intoId } of fedb.duplicates) {
    appendBlock(extras, intoId, {
      source: FEDB_ATTRIBUTION,
      name: record.name,
      lines: cleanLines(record.instructions),
    });
  }

  const wger = buildWgerCatalogue(wgerRaw, [...prior, ...FEDB_CATALOGUE]);
  for (const { record, intoId } of wger.duplicates) {
    appendBlock(extras, intoId, {
      source: wgerAttribution(record),
      name: record.name,
      lines: cleanLines(wgerDescriptionLines(record.description)),
    });
  }
  return extras;
}

function entryFor(
  exercise: SeedExercise,
  extras: Map<string, SourceTextBlock[]>,
): SourceCorpusEntry {
  const own = ownText(exercise);
  const texts = [own, ...(extras.get(exercise.id) ?? [])].filter((block) => block.lines.length > 0);
  if (texts.length === 0) {
    texts.push(own);
  }
  const corpus = own.lines.join(" ");
  return {
    id: exercise.id,
    name: exercise.name,
    texts,
    corpus,
    sourceChars: corpus.length,
  };
}

/**
 * Build original source lines for every Library id from already-loaded raw JSON.
 */
export function buildSourceCorpus(
  fedbJson: string,
  wgerRaw: WgerExerciseRecord[],
): Map<string, SourceCorpusEntry> {
  const extras = foldedExtras(fedbJson, wgerRaw);
  const out = new Map<string, SourceCorpusEntry>();
  for (const exercise of unenrichedCatalogue()) {
    out.set(exercise.id, entryFor(exercise, extras));
  }
  return out;
}
