/**
 * Compiles data/curated/equipment-audit.tsv (one evidenced row per Library
 * exercise, #111) into src/data/generated/equipment.ts, applying the owner's
 * decisions below. Fails on any token outside the gear vocabulary.
 *
 * Usage: npm run equipment:compile
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { EQUIPMENT_IDS, isEquipmentId, type EquipmentId } from "../src/domain/program.ts";
import { NTC_CATALOGUE } from "../src/data/ntc/ntcCatalogue.ts";
import { SEED_EXERCISES } from "../src/data/seed.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tsvPath = path.join(repoRoot, "data/curated/equipment-audit.tsv");
const out = path.join(repoRoot, "src/data/generated/equipment.ts");

/** Removed from the Library (#111): see WGER_DENY in src/data/wger/selection.ts. */
const REMOVED_IDS = new Set(["wger_688"]);

/** Strap and belt moves use one item: a towel. */
const RENAMED: Readonly<Record<string, EquipmentId>> = { strap: "towel", belt: "towel" };

/**
 * Always available at home, like a bench or wall (owner decision): a foot
 * anchor is a bed, sofa or door. Never a requirement; a move whose only
 * need, or one of whose alternatives, is just this is bodyweight.
 */
const ALWAYS_AVAILABLE = new Set(["foot_anchor"]);

/** Alternatives the app has no gear item for are dropped, not added. */
const DROPPED_ALTERNATIVES = new Set([
  "blocks",
  "stall_bars",
  "captains_chair",
  "stability_ball",
  "push-up handles",
  "parallettes(tall)",
]);

/**
 * Owner review (kept here so the TSV stays the audit as produced): the
 * owner's parallettes handle every parallel-bar move, dips included. A dip
 * station works too, for athletes who have one but no parallettes.
 */
const PARALLEL_BAR_MOVES = [
  "hf_25", // Parallel Bar Dip
  "hf_26", // Forward Lean Dip
  "hf_30", // L-Sit Dip
  "hf_146", // Plyo Dip
  "wger_2706", // Dips
  "wger_1808", // Parallel Bar Hold
  "fedb_knee_hip_raise_on_parallel_bars",
];

const OVERRIDES: Readonly<Record<string, Pick<Row, "proposed_requires" | "alternatives" | "note">>> =
  Object.fromEntries(
    PARALLEL_BAR_MOVES.map((id) => [
      id,
      {
        proposed_requires: "parallettes",
        alternatives: "dip_bars",
        note: "owner review: parallettes handle every parallel-bar move; dip bars also work",
      },
    ]),
  );

type Confidence = "high" | "medium" | "low";

interface Row {
  id: string;
  proposed_requires: string;
  alternatives: string;
  confidence: string;
  evidence_url: string;
  note: string;
}

function gearList(text: string, row: string): EquipmentId[] {
  const items = text
    .split("+")
    .map((token) => token.trim())
    .map((token) => RENAMED[token] ?? token)
    .filter((token) => token !== "body" && !ALWAYS_AVAILABLE.has(token));
  for (const item of items) {
    if (!isEquipmentId(item)) {
      throw new Error(`${row}: "${item}" is not a gear id (${EQUIPMENT_IDS.join(", ")})`);
    }
  }
  return [...new Set(items)].sort() as EquipmentId[];
}

function alternativesOf(text: string, requires: EquipmentId[], row: string): EquipmentId[][] {
  // Alternatives to a bodyweight move change nothing: it is always usable.
  if (requires.length === 0 || !text) {
    return [];
  }
  const sets: EquipmentId[][] = [];
  for (const option of text.split("|").map((token) => token.trim())) {
    if (DROPPED_ALTERNATIVES.has(option)) {
      continue;
    }
    const set = gearList(option, row);
    const key = set.join("+");
    if (set.length > 0 && key !== requires.join("+") && !sets.some((s) => s.join("+") === key)) {
      sets.push(set);
    }
  }
  return sets;
}

function evidenceOf(row: Row): string {
  if (row.evidence_url.startsWith("http")) {
    return row.evidence_url;
  }
  if (SEED_EXERCISES.some((item) => item.id === row.id)) {
    return "in-house text: src/data/seed.ts";
  }
  if (NTC_CATALOGUE.some((item) => item.id === row.id)) {
    return "in-house text: src/data/ntc/ntcCatalogue.ts";
  }
  throw new Error(`${row.id}: no evidence URL and not an in-house move`);
}

function parseTsv(text: string): Row[] {
  const [header, ...lines] = text.trimEnd().split("\n");
  const columns = header!.split("\t");
  return lines.map((line) => {
    const cells = line.split("\t");
    return Object.fromEntries(columns.map((column, index) => [column, cells[index] ?? ""])) as unknown as Row;
  });
}

async function main(): Promise<void> {
  const rows = parseTsv(await readFile(tsvPath, "utf8"));
  const entries: string[] = [];
  const seen = new Set<string>();
  for (const audited of rows) {
    const row: Row = { ...audited, ...OVERRIDES[audited.id] };
    if (REMOVED_IDS.has(row.id)) {
      continue;
    }
    if (seen.has(row.id)) {
      throw new Error(`${row.id}: duplicate row`);
    }
    seen.add(row.id);
    const confidence = row.confidence as Confidence;
    if (!["high", "medium", "low"].includes(confidence)) {
      throw new Error(`${row.id}: confidence "${row.confidence}"`);
    }
    // An alternative made only of always-available gear makes the move free.
    const freeAlternative = row.alternatives
      .split("|")
      .map((option) => option.trim())
      .some((option) => option && !DROPPED_ALTERNATIVES.has(option) && gearList(option, row.id).length === 0);
    const requires = freeAlternative ? [] : gearList(row.proposed_requires, row.id);
    const orRequires = alternativesOf(row.alternatives, requires, row.id);
    const entry = {
      requires,
      ...(orRequires.length > 0 ? { orRequires } : {}),
      confidence,
      evidence: evidenceOf(row),
      ...(row.note ? { note: row.note } : {}),
    };
    entries.push(`  ${JSON.stringify(row.id)}: ${JSON.stringify(entry)},`);
  }
  await writeFile(
    out,
    [
      `import type { CuratedEquipment } from "../curatedEquipment";`,
      ``,
      `/** Generated by scripts/compile-equipment.ts — edit data/curated/equipment-audit.tsv instead. */`,
      `export const CURATED_EQUIPMENT: Readonly<Record<string, CuratedEquipment>> = {`,
      ...entries,
      `};`,
      ``,
    ].join("\n"),
  );
  console.log(`Compiled equipment for ${entries.length} exercises`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
