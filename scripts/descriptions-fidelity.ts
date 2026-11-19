/**
 * Fidelity judge: score every curated description against original source corpus.
 *
 *   npm run descriptions:fidelity
 *
 * Writes reports/description-fidelity.tsv and exits 1 when any hard fail remains
 * (after thin-source + explicit allowlist). See src/data/describe/fidelity.ts.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  loadAllowlistIds,
  scoreFidelity,
  type FidelityAllowlist,
  type FidelityScore,
} from "../src/data/describe/fidelity.ts";
import { DESCRIPTIONS } from "../src/data/generated/descriptions.ts";
import { LIBRARY_CATALOGUE } from "../src/data/libraryCatalogue.ts";
import { loadSourceCorpus } from "./load-source-corpus.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function tsvRow(score: FidelityScore): string {
  return [
    score.id,
    score.name.replaceAll(/\t/g, " "),
    score.recall.toFixed(4),
    score.template ? "1" : "0",
    score.overTrim ? "1" : "0",
    String(score.sourceChars),
    String(score.curatedChars),
    score.thinSource ? "1" : "0",
    score.allowlisted ? "1" : "0",
    score.softWarn ? "1" : "0",
    score.hardFail ? "1" : "0",
  ].join("\t");
}

async function main(): Promise<void> {
  const allowlistPath = path.join(repoRoot, "data/curated/description-fidelity-allowlist.json");
  const allowlist = loadAllowlistIds(
    JSON.parse(await readFile(allowlistPath, "utf8")) as FidelityAllowlist,
  );
  const corpus = await loadSourceCorpus(repoRoot);

  const scores: FidelityScore[] = [];
  const missing: string[] = [];
  for (const exercise of LIBRARY_CATALOGUE) {
    const curated = DESCRIPTIONS[exercise.id];
    if (!curated) {
      missing.push(exercise.id);
      continue;
    }
    const source = corpus.get(exercise.id);
    if (!source) {
      throw new Error(`no source corpus for ${exercise.id}`);
    }
    scores.push(
      scoreFidelity({
        id: exercise.id,
        name: exercise.name,
        sourceCorpus: source.corpus,
        sourceChars: source.sourceChars,
        curated,
        allowlistIds: allowlist,
      }),
    );
  }

  scores.sort((a, b) => a.recall - b.recall || a.id.localeCompare(b.id));

  const reportDir = path.join(repoRoot, "reports");
  await mkdir(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, "description-fidelity.tsv");
  const header =
    "id\tname\trecall\ttemplate\tover_trim\tsource_chars\tcurated_chars\tthin\tallowlisted\tsoft_warn\thard_fail\n";
  await writeFile(reportPath, header + scores.map(tsvRow).join("\n") + "\n");

  const hardFails = scores.filter((score) => score.hardFail);
  const softWarns = scores.filter((score) => score.softWarn && !score.hardFail);
  const thin = scores.filter((score) => score.thinSource);

  console.log(
    `Fidelity: ${scores.length} scored, ${hardFails.length} hard fail, ${softWarns.length} soft warn, ${thin.length} thin-source, ${missing.length} missing curated`,
  );
  console.log(`Report: ${reportPath}`);
  if (hardFails.length > 0) {
    console.error("Hard fails (rewrite from originals):");
    for (const fail of hardFails.slice(0, 40)) {
      console.error(
        `  ${fail.id}\trecall=${fail.recall.toFixed(3)}\ttemplate=${fail.template}\toverTrim=${fail.overTrim}\tsrc=${fail.sourceChars}`,
      );
    }
    if (hardFails.length > 40) {
      console.error(`  … and ${hardFails.length - 40} more`);
    }
    process.exitCode = 1;
  }
  if (missing.length > 0) {
    console.error(`Missing curated descriptions: ${missing.join(", ")}`);
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
