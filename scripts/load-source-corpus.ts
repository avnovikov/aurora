/** Disk helper: read raw FEDB/wger JSON and build the description source corpus. */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildSourceCorpus, type SourceCorpusEntry } from "../src/data/describe/sourceCorpus.ts";
import type { WgerExerciseRecord } from "../src/data/wger/types.ts";

export async function loadSourceCorpus(repoRoot: string): Promise<Map<string, SourceCorpusEntry>> {
  const fedbJson = await readFile(path.join(repoRoot, "data/raw/free-exercise-db.json"), "utf8");
  const wgerRaw = JSON.parse(
    await readFile(path.join(repoRoot, "data/raw/wger-exercises.json"), "utf8"),
  ) as WgerExerciseRecord[];
  return buildSourceCorpus(fedbJson, wgerRaw);
}
