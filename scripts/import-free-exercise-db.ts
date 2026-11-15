import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildFedbCatalogue,
  parseFedbJson,
  serialiseFedbCatalogueModule,
} from "../src/data/fedb/buildCatalogue.ts";
import { HF_CATALOGUE } from "../src/data/generated/hfCatalogue.ts";
import { NTC_CATALOGUE } from "../src/data/ntc/ntcCatalogue.ts";
import { SEED_EXERCISES } from "../src/data/seed.ts";

const FEDB_JSON_URL =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const rawPath = path.join(repoRoot, "data/raw/free-exercise-db.json");
const generatedPath = path.join(repoRoot, "src/data/generated/fedbCatalogue.ts");

async function loadJson(): Promise<string> {
  try {
    return await readFile(rawPath, "utf8");
  } catch {
    await mkdir(path.dirname(rawPath), { recursive: true });
    const response = await fetch(FEDB_JSON_URL);
    if (!response.ok) {
      throw new Error(`free-exercise-db download failed: ${response.status}`);
    }
    const body = await response.text();
    await writeFile(rawPath, body, "utf8");
    return body;
  }
}

async function main(): Promise<void> {
  const records = parseFedbJson(await loadJson());
  const existing = [...SEED_EXERCISES, ...HF_CATALOGUE, ...NTC_CATALOGUE];
  const { catalogue, skippedDuplicates } = buildFedbCatalogue(records, existing);
  await mkdir(path.dirname(generatedPath), { recursive: true });
  await writeFile(generatedPath, serialiseFedbCatalogueModule(catalogue), "utf8");
  console.log(`Wrote ${catalogue.length} exercises to ${generatedPath}`);
  console.log(`Skipped ${skippedDuplicates.length} duplicates: ${skippedDuplicates.join(", ")}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
