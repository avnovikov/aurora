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
  return {
    source: exercise.attribution ?? "Aurora seed (written in-house)",
    name: exercise.name,
    lines: cleanLines(
      exercise.description ? [...new Set([exercise.description, ...exercise.cues])] : exercise.cues,
    ),
  };
}

function unenrichedCatalogue(): SeedExercise[] {
  const merged = mergeSeedDuplicates(
    SEED_EXERCISES,
    buildLibraryCatalogue([], HF_CATALOGUE, NTC_CATALOGUE, FEDB_CATALOGUE, WGER_CATALOGUE),
  );
  return buildLibraryCatalogue(merged.seed, merged.imported);
}

/**
 * Build original source lines for every Library id from already-loaded raw JSON.
 */
export function buildSourceCorpus(
  fedbJson: string,
  wgerRaw: WgerExerciseRecord[],
): Map<string, SourceCorpusEntry> {
  const catalogue = unenrichedCatalogue();
  const byId = new Map(catalogue.map((exercise) => [exercise.id, exercise]));
  const extras = new Map<string, SourceTextBlock[]>();

  const add = (intoId: string, text: SourceTextBlock): void => {
    if (text.lines.length === 0) {
      return;
    }
    extras.set(intoId, [...(extras.get(intoId) ?? []), text]);
  };

  const fedbRaw = parseFedbJson(fedbJson);
  const prior = [...SEED_EXERCISES, ...HF_CATALOGUE, ...NTC_CATALOGUE];
  const fedb = buildFedbCatalogue(fedbRaw, prior);
  for (const { record, intoId } of fedb.duplicates) {
    add(intoId, {
      source: FEDB_ATTRIBUTION,
      name: record.name,
      lines: cleanLines(record.instructions),
    });
  }

  const wger = buildWgerCatalogue(wgerRaw, [...prior, ...FEDB_CATALOGUE]);
  for (const { record, intoId } of wger.duplicates) {
    add(intoId, {
      source: wgerAttribution(record),
      name: record.name,
      lines: cleanLines(wgerDescriptionLines(record.description)),
    });
  }

  const out = new Map<string, SourceCorpusEntry>();
  for (const exercise of catalogue) {
    const own = ownText(exercise);
    const folded = extras.get(exercise.id) ?? [];
    const texts = [own, ...folded].filter((block) => block.lines.length > 0);
    if (texts.length === 0) {
      texts.push(own);
    }
    const corpus = own.lines.join(" ");
    out.set(exercise.id, {
      id: exercise.id,
      name: exercise.name,
      texts,
      corpus,
      sourceChars: corpus.length,
    });
  }

  for (const id of byId.keys()) {
    if (!out.has(id)) {
      throw new Error(`source corpus missing library id ${id}`);
    }
  }
  return out;
}
