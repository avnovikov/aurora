import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildHfCatalogue, parseHfJsonl } from "../src/data/hf/buildCatalogue.ts";
import { serialiseHfCatalogueModule } from "../src/data/hf/serialiseCatalogue.ts";

const HF_JSONL_URL =
  "https://huggingface.co/datasets/Martjn/calisthenics_exercises/resolve/main/exercises.jsonl";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const rawPath = path.join(repoRoot, "data/raw/exercises.jsonl");
const generatedPath = path.join(repoRoot, "src/data/generated/hfCatalogue.ts");

async function loadJsonl(): Promise<string> {
  try {
    return await readFile(rawPath, "utf8");
  } catch {
    await mkdir(path.dirname(rawPath), { recursive: true });
    const response = await fetch(HF_JSONL_URL);
    if (!response.ok) {
      throw new Error(`HF download failed: ${response.status} ${response.statusText}`);
    }
    const body = await response.text();
    await writeFile(rawPath, body, "utf8");
    return body;
  }
}

async function main(): Promise<void> {
  const jsonl = await loadJsonl();
  const records = parseHfJsonl(jsonl);
  const catalogue = buildHfCatalogue(records);
  const moduleSource = serialiseHfCatalogueModule(catalogue);
  await mkdir(path.dirname(generatedPath), { recursive: true });
  await writeFile(generatedPath, moduleSource, "utf8");
  console.log(`Wrote ${catalogue.length} exercises to ${generatedPath}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});