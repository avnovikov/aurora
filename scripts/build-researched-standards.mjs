#!/usr/bin/env node
/**
 * Builds src/data/enrich/researchedStandards.ts from the per-exercise tier
 * research (#262). Spec: docs/superpowers/specs/2026-11-21-researched-tier-standards-design.md
 *
 *   npm run standards:researched              (or tsx scripts/build-researched-standards.mjs)
 *   npm run standards:researched -- --parents  (also print each derived row's parent)
 *
 * Kept: sourced and derived rows with a valid band (five tiers, ≥ 1, strictly
 * increasing) and every not_max_test row. Dropped: empty bands, checker
 * rejects, no_data rows and invalid bands (left on the generic table), and
 * rows the coaching list already covers (printed below).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const INPUT = join(ROOT, "docs/superpowers/specs/2026-11-21-researched-tier-standards/tier-research.json");
const OUTPUT = join(ROOT, "src/data/enrich/researchedStandards.ts");

/**
 * Parent moves named in derived rows' method text, in display form. The
 * earliest match in the text wins, so "Derived from High plank hold (itself
 * derived from forearm plank …)" names the high plank.
 */
const PARENTS = [
  [/reverse crunch/i, "reverse crunch"],
  [/high plank/i, "high plank"],
  [/forearm plank|dynamic plank base/i, "forearm plank"],
  [/side[- ]plank/i, "side plank"],
  [/single-leg bridge|SLBT/i, "single-leg bridge test"],
  [/ab wheel/i, "ab wheel rollout"],
  [/bicycle crunch/i, "bicycle crunch"],
  [/abdominal crunch|crunch standard/i, "abdominal crunch"],
  [/hanging leg raise/i, "hanging leg raise"],
  [/hanging[- ]knee[- ]raise/i, "hanging knee raise"],
  [/straddle L-sit/i, "straddle L-sit"],
  [/L-sit/i, "L-sit"],
  [/hollow hold|hollow-hold/i, "hollow hold"],
  [/superman/i, "superman"],
  [/mountain climber/i, "mountain climber"],
  [/russian twist/i, "Russian twist"],
  [/V-up/i, "V-up"],
  [/sit-up|sit up/i, "sit-up"],
  [/inverted row/i, "inverted row"],
  [/flexed-arm-hang|flexed arm hang/i, "flexed-arm hang"],
  [/tuck front lever/i, "tuck front lever"],
  [/full front lever|front lever/i, "front lever"],
  [/pull-up anchor|pull-up/i, "pull-up"],
  [/dead hang|dead-hang/i, "dead hang"],
  [/dip anchor|dip/i, "dip"],
  [/pike push-up/i, "pike push-up"],
  [/push-up|pushup/i, "push-up"],
  [/maltese/i, "Maltese cross"],
  [/iron cross/i, "iron cross"],
  [/back bridge/i, "back bridge"],
  [/press to handstand/i, "press to handstand"],
  [/wall handstand/i, "wall handstand"],
  [/pistol/i, "pistol squat"],
  [/split squat/i, "split squat"],
  [/single-leg RDL|single-leg romanian/i, "single-leg Romanian deadlift"],
  [/lunge-style get-up/i, "Turkish get-up (lunge style)"],
  [/lunge/i, "lunge"],
  [/double push press/i, "double kettlebell push press"],
  [/alternating (KB |kettlebell )?press/i, "alternating kettlebell press"],
  [/single-bell/i, "kettlebell snatch"],
  [/hyperextension/i, "hyperextension"],
  [/\bHLR\b/, "hanging leg raise"],
  [/\bHKR\b/, "hanging knee raise"],
];

/**
 * Rows whose method text names no parent, or whose first-named move is not
 * the parent; set by hand from the method.
 */
const PARENT_OVERRIDES = {
  hf_108: "coaching stage criterion",
  hf_130: "NASM coaching note",
  fedb_kettlebell_turkish_get_up_lunge_style: "coaching prescription (3–6 reps per side)",
  // The first-named move in the method text is not the parent:
  hf_119: "abdominal crunch",
  hf_124: "mountain climber",
  hf_127: "pistol squat",
  hf_134: "hollow hold",
  ntc_cross_body_climber: "forearm plank",
  ntc_floor_windshield_wiper: "hanging knee raise",
  wger_2694: "dead hang",
  // No parent move; the band comes from one data source or coaching targets:
  fedb_flutter_kicks: "Strength Level flutter kicks table",
  fedb_hyperextensions_with_no_hyperextension_bench: "back-extension endurance study",
  hf_135: "coaching targets",
};

/**
 * Researched rows the coaching list (`SPECIFIC` in standards.ts) already
 * covers, so the table would never apply them. Left out to keep one band per
 * move; `researchedStandards.test.ts` fails if another one appears.
 */
const COVERED_BY_COACHING = {
  hf_100: "Side Plank keeps McGill 1999 (same numbers)",
};

const TIERS = ["novice", "beginner", "intermediate", "advanced", "elite"];

function parseBand(text) {
  const values = text.split("/").map((part) => Number(part.trim()));
  if (values.length !== 5 || values.some((value) => !Number.isInteger(value) || value < 1)) {
    return null;
  }
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] <= values[i - 1]) {
      return null;
    }
  }
  return values;
}

const ID_PATTERN = /\b(?:hf|wger|fedb|ntc)_[a-z0-9_]*[a-z0-9]/g;
const NAMED_PATTERN =
  /(?:easierId|harderId|\bparent(?:\s+(?:is|stays|kept))?)\s+(?:is\s+)?(?:the\s+)?([A-Za-z][A-Za-z' -]*?)(?=\s*(?:\(|,|\.|;|:|\d|\bso\b|\band\b|\bat\b|\bx\b|\/|$))/gi;

const lower = (name) => name.trim().toLowerCase();

/** Display form for a free-text move name: a known anchor label if one matches, else the name lowercased. */
function labelForName(name) {
  const hit = PARENTS.find(([pattern]) => pattern.test(name));
  return hit ? hit[1] : lower(name);
}

/**
 * Parent move of a derived row, most explicit first: an id in the method
 * text, then "easierId/harderId/Parent is <name>", then the earliest known
 * anchor name, then the catalogue's own easier/harder neighbour.
 */
function parentOf(row, nameById, linksById) {
  if (PARENT_OVERRIDES[row.id]) {
    return PARENT_OVERRIDES[row.id];
  }
  for (const id of row.method.match(ID_PATTERN) ?? []) {
    if (id !== row.id && nameById.has(id)) {
      return lower(nameById.get(id));
    }
  }
  for (const hit of row.method.matchAll(NAMED_PATTERN)) {
    const name = hit[1].replace(/\b(?:easierId|harderId)\b/gi, "").trim();
    // Only a phrase that is an anchor name or a catalogue move counts; "parent kept" and the like do not.
    const known = [...nameById.values()].some((candidate) => lower(candidate) === lower(name));
    if (known || PARENTS.some(([pattern]) => pattern.test(name))) {
      return labelForName(name);
    }
  }
  let best = null;
  for (const [pattern, label] of PARENTS) {
    const hit = pattern.exec(row.method);
    if (hit && (best === null || hit.index < best.index)) {
      best = { index: hit.index, label };
    }
  }
  if (best) {
    return best.label;
  }
  if (/\bcrunch(?:es)?\b/i.test(row.method)) {
    return "crunch";
  }
  const links = linksById.get(row.id);
  const neighbour = links?.easierId ?? links?.harderId;
  if (neighbour && nameById.has(neighbour)) {
    return lower(nameById.get(neighbour));
  }
  throw new Error(`No parent found for derived row ${row.id} (${row.name}): ${row.method}`);
}

/** "Strength Level - Ab Wheel Rollout (current table) <url>" → { title, url }. */
function parseSources(text) {
  return text
    .split(" ; ")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = /^(.*?)\s*<([^>]+)>\s*$/.exec(part);
      return match ? { title: match[1].trim(), url: match[2] } : { title: part, url: "" };
    });
}

/** Publishers named in source titles, in Library form. First match wins. */
const PUBLISHERS = [
  [/strength ?level/i, "StrengthLevel"],
  [/fitnessvolt/i, "FitnessVolt"],
  [/cooper/i, "Cooper Institute"],
  [/topend/i, "Topend Sports"],
  [/fitnessnorms/i, "Fitnessnorms"],
  [/calisthenai/i, "Calisthenai"],
  [/gymnastic bodies/i, "Gymnastic Bodies forum"],
  [/marathon handbook/i, "Marathon Handbook"],
  [/healthline/i, "Healthline"],
  [/AOL|Brewer/, "AOL (Brewer)"],
  [/bodybuilding\.com/i, "Bodybuilding.com"],
  [/eat ?this/i, "Eat This"],
  [/fittux/i, "Fittux"],
  [/fitwill/i, "Fitwill"],
  [/simonster/i, "Simonster Strength"],
  [/breaking muscle/i, "Breaking Muscle"],
  [/awesome ninja/i, "Awesome Ninja Fitness"],
  [/calisteniapp/i, "Calisteniapp"],
  [/physio-pedia/i, "Physio-pedia"],
  [/SRAlab|Demoulin/i, "Demoulin 2006"],
  [/Mbada/i, "Mbada 2009"],
  [/Biering-Sorensen young/i, "Biering-Sørensen norms"],
  [/Nigerian young adults/i, "Nigerian young-adult norms"],
  [/Police academy/i, "Police academy chart"],
  [/Community training spreadsheet/i, "community spreadsheet"],
  [/Gymnastic Rings Support Hold/i, "rings support-hold guide"],
  [/Skill Track/i, "Skill Track"],
];

/** Short publisher name for a source title; throws for an unknown one. */
function shortTitle(title) {
  const hit = PUBLISHERS.find(([pattern]) => pattern.test(title));
  if (!hit) {
    throw new Error(`No publisher for source title: ${title}`);
  }
  return hit[1];
}

function sourcedLabel(sources) {
  const names = [...new Set(sources.map((source) => shortTitle(source.title)))];
  return `Sourced: ${names.join(", ")}`;
}

const { LIBRARY_CATALOGUE } = await import("../src/data/libraryCatalogue.ts");
const nameById = new Map(LIBRARY_CATALOGUE.map((exercise) => [exercise.id, exercise.name]));
const linksById = new Map(LIBRARY_CATALOGUE.map((exercise) => [exercise.id, exercise]));
const rows = JSON.parse(readFileSync(INPUT, "utf8"));
const kept = [];
const dropped = [];

for (const row of rows) {
  if (row.status === "not_max_test") {
    kept.push({ row, kind: "not_max_test", source: "Not a max-rep test" });
    continue;
  }
  if (COVERED_BY_COACHING[row.id]) {
    dropped.push({ row, reason: `coaching list: ${COVERED_BY_COACHING[row.id]}` });
    continue;
  }
  if (row.status === "no_data" || row.verdict === "reject" || !row.final) {
    dropped.push({ row, reason: row.status === "no_data" ? "no_data" : row.verdict === "reject" ? "rejected" : "no band" });
    continue;
  }
  const band = parseBand(row.final);
  if (!band) {
    dropped.push({ row, reason: `invalid band ${row.final}` });
    continue;
  }
  if (row.status === "sourced") {
    const sources = parseSources(row.sources);
    kept.push({ row, kind: "sourced", band, sources, source: sourcedLabel(sources) });
  } else if (row.status === "derived") {
    kept.push({ row, kind: "derived", band, source: `Derived from ${parentOf(row, nameById, linksById)}` });
  } else {
    dropped.push({ row, reason: `unknown status ${row.status}` });
  }
}

const q = (value) => JSON.stringify(value);
const lines = kept
  .sort((a, b) => a.row.id.localeCompare(b.row.id))
  .map(({ row, kind, band, sources, source }) => {
    const comment = [`  // ${row.name}`];
    for (const item of sources ?? []) {
      comment.push(`  //   ${item.title}${item.url ? ` <${item.url}>` : ""}`);
    }
    const standards = band
      ? ` standards: { ${TIERS.map((tier, i) => `${tier}: ${band[i]}`).join(", ")} },`
      : "";
    return `${comment.join("\n")}\n  ${q(row.id)}: { kind: ${q(kind)},${standards} source: ${q(source)} },`;
  });

const header = `// Generated by scripts/build-researched-standards.mjs from
// docs/superpowers/specs/2026-11-21-researched-tier-standards/tier-research.json (#262).
// Do not edit by hand: change the research JSON and rerun the script.
import type { ExerciseStandards } from "../../domain/types";

export type ResearchedKind = "sourced" | "derived" | "not_max_test";

export interface ResearchedStandard {
  kind: ResearchedKind;
  /** Absent for not_max_test: tiers do not apply. */
  standards?: ExerciseStandards;
  /** Short Library label: "Sourced: …", "Derived from …" or "Not a max-rep test". */
  source: string;
}

/**
 * Researched tier bands by exercise id. Applied only where Endura and the
 * coaching list have no row (see \`standardsFor\`).
 */
export const RESEARCHED_STANDARDS: Readonly<Record<string, ResearchedStandard>> = {
`;

writeFileSync(OUTPUT, `${header}${lines.join("\n")}\n};\n`);

const count = (kind) => kept.filter((item) => item.kind === kind).length;
console.log(
  `researchedStandards.ts: ${count("sourced")} sourced, ${count("derived")} derived, ${count("not_max_test")} not_max_test; ${dropped.length} dropped`,
);
for (const { row, reason } of dropped) {
  console.log(`  dropped: ${row.id} ${row.name} (${reason})`);
}
if (process.argv.includes("--parents")) {
  for (const item of kept.filter((entry) => entry.kind === "derived")) {
    console.log(`  ${item.row.id} ${item.row.name} <- ${item.source}`);
  }
}
