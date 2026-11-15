import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { FEDB_CATALOGUE } from "../src/data/generated/fedbCatalogue.ts";
import { HF_CATALOGUE } from "../src/data/generated/hfCatalogue.ts";
import { NTC_CATALOGUE } from "../src/data/ntc/ntcCatalogue.ts";
import { SEED_EXERCISES } from "../src/data/seed.ts";
import {
  buildWgerCatalogue,
  serialiseWgerCatalogueModule,
  slimWgerApiResults,
} from "../src/data/wger/buildCatalogue.ts";
import type { WgerExerciseRecord } from "../src/data/wger/types.ts";

const WGER_API_URL = "https://wger.de/api/v2/exerciseinfo/?limit=1000";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const rawPath = path.join(repoRoot, "data/raw/wger-exercises.json");
const generatedPath = path.join(repoRoot, "src/data/generated/wgerCatalogue.ts");

async function fetchAllPages(): Promise<Parameters<typeof slimWgerApiResults>[0]> {
  const results: Parameters<typeof slimWgerApiResults>[0] = [];
  let next: string | null = WGER_API_URL;
  while (next) {
    const response = await fetch(next);
    if (!response.ok) {
      throw new Error(`wger download failed: ${response.status}`);
    }
    const page = (await response.json()) as { next: string | null; results: typeof results };
    results.push(...page.results);
    next = page.next;
  }
  return results;
}

async function loadRecords(): Promise<WgerExerciseRecord[]> {
  try {
    return JSON.parse(await readFile(rawPath, "utf8")) as WgerExerciseRecord[];
  } catch {
    const slim = slimWgerApiResults(await fetchAllPages());
    await mkdir(path.dirname(rawPath), { recursive: true });
    await writeFile(rawPath, JSON.stringify(slim, null, 1) + "\n", "utf8");
    return slim;
  }
}

async function main(): Promise<void> {
  const records = await loadRecords();
  const existing = [...SEED_EXERCISES, ...HF_CATALOGUE, ...NTC_CATALOGUE, ...FEDB_CATALOGUE];
  const { catalogue, skippedDuplicates } = buildWgerCatalogue(records, existing);
  await mkdir(path.dirname(generatedPath), { recursive: true });
  await writeFile(generatedPath, serialiseWgerCatalogueModule(catalogue), "utf8");
  console.log(`Wrote ${catalogue.length} exercises to ${generatedPath}`);
  console.log(`Skipped ${skippedDuplicates.length} duplicates: ${skippedDuplicates.join(", ")}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
