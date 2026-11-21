#!/usr/bin/env node
/**
 * Builds src/data/enrich/researchedStandards.ts from the per-exercise tier
 * research (#262). Spec: docs/superpowers/specs/2026-11-21-researched-tier-standards-design.md
 *
 *   npm run standards:researched              (or tsx scripts/build-researched-standards.mjs)
 *   npm run standards:researched -- --parents  (also print each derived row's parent and step)
 *   npm run standards:researched -- --report   (also print band changes and variant-order checks)
 *
 * Anchors are fixed: Endura twins, the coaching list, seed bands, family
 * members (src/data/enrich/bandFamilies.ts, user decisions 2026-11-21),
 * sourced research rows, derived rows whose parent is a single data source
 * rather than a move, and derived rows that convert a
 * hold to reps (or back) from a fixed anchor. Every other derived row is computed
 * from its parent, one ×1.2 step at a time, in topological order
 * (scripts/lib/tierDerivation.ts). The research `final` of a derived row is
 * the research proposal and is not applied.
 *
 * Kept: sourced and derived rows with a valid band and every not_max_test
 * row. Dropped: checker rejects, no_data rows and invalid anchor bands (left
 * on the generic table), and rows the coaching list already covers.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deriveChains, stepFromLinks, stepFromMethod, variantOrderViolations } from "./lib/tierDerivation.ts";

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
 * The move each parent label stands for. `null`: the label names a data
 * source or coaching target, not a move, so the row's band is a
 * single-source anchor and is kept as researched.
 */
const PARENT_IDS = {
  "reverse crunch": "hf_119",
  "high plank": "ntc_high_plank",
  "forearm plank": "hf_99",
  "side plank": "hf_100",
  "single-leg bridge test": null,
  "ab wheel rollout": "hf_113",
  "bicycle crunch": "hf_115",
  "abdominal crunch": "wger_1933",
  "hanging leg raise": "hf_110",
  "hanging knee raise": "hanging_knee_raise",
  "straddle L-sit": "wger_1847",
  "L-sit": "hf_105",
  "hollow hold": "hollow_hold",
  superman: "hf_117",
  "mountain climber": "hf_121",
  "Russian twist": "hf_114",
  "V-up": "hf_120",
  "sit-up": "fedb_sit_up",
  "inverted row": "hf_39",
  "flexed-arm hang": null,
  "tuck front lever": "hf_57",
  "front lever": "hf_58",
  "pull-up": "pullup",
  "dead hang": "pullup_dead_hang",
  dip: "hf_25",
  "pike push-up": "hf_19",
  "push-up": "hf_2",
  "Maltese cross": "hf_131",
  "iron cross": "hf_130",
  "back bridge": "hf_134",
  "press to handstand": "hf_127",
  "wall handstand": "wall_handstand",
  "pistol squat": "pistol_squat",
  "split squat": "fedb_split_squats",
  "single-leg Romanian deadlift": "hf_85",
  "Turkish get-up (lunge style)": "fedb_kettlebell_turkish_get_up_lunge_style",
  lunge: "wger_1324",
  "double kettlebell push press": "fedb_double_kettlebell_push_press",
  "alternating kettlebell press": "fedb_alternating_kettlebell_press",
  "kettlebell snatch": null,
  hyperextension: "fedb_hyperextensions_with_no_hyperextension_bench",
  crunch: "fedb_crunches",
  "Bulgarian split squat": "bulgarian_split",
  "archer Australian pull-up": "ntc_archer_inverted_row",
  "bent-knee Australian pull-up": "ntc_bent_knee_australian_pull_up",
  "coaching stage criterion": null,
  "NASM coaching note": null,
  "coaching prescription (3–6 reps per side)": null,
  "Strength Level flutter kicks table": null,
  "back-extension endurance study": null,
  "coaching targets": null,
  "TopEndSports bent-knee horizontal pull-up norms": null,
};

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
  fedb_elbow_to_knee: "crunch",
  fedb_oblique_crunches_on_the_floor: "fedb_oblique_crunches",
  hf_91: "hf_75",
  // "3/4 sit-up / 1.2": the 3/4 sit-up, not the sit-up the text also names.
  wger_1476: "fedb_3_4_sit_up",
  // "hanging knee raise ÷ 1.2 twice": one step below the hanging leg raise, itself HKR ÷ 1.2.
  hf_123: "hanging leg raise",
  wger_1954: "hanging leg raise",
  hf_124: "push-up",
  hf_127: "pistol squat",
  hf_134: "hollow hold",
  ntc_cross_body_climber: "forearm plank",
  ntc_floor_windshield_wiper: "hanging knee raise",
  wger_2694: "dead hang",
  // Third pass (#262): the method names the trusted neighbour, not an anchor in PARENTS order:
  ntc_reverse_lunge_knee_drive: "Bulgarian split squat",
  wger_1907: "wger_2557",
  wger_1324: "wger_2557",
  fedb_bodyweight_walking_lunge: "wger_2557",
  hf_79: "wger_2557",
  hf_42: "archer Australian pull-up",
  hf_39: "bent-knee Australian pull-up",
  // No parent move; the band comes from one data source or coaching targets:
  fedb_flutter_kicks: "Strength Level flutter kicks table",
  fedb_hyperextensions_with_no_hyperextension_bench: "back-extension endurance study",
  hf_135: "coaching targets",
  // Fourth step (#262): one measured table, the rows' anchor:
  ntc_bent_knee_australian_pull_up: "TopEndSports bent-knee horizontal pull-up norms",
};

/**
 * Easier or harder where neither the catalogue links nor the method text
 * settle it (the text names both directions, or neither). Set by hand from
 * the method.
 */
const STEP_OVERRIDES = {
  // The band is the parent's unchanged ("kept the … anchor", "same movement", "agrees with this parent"):
  wger_500: "same",
  wger_1099: "same",
  wger_1477: "same",
  wger_1808: "same",
  wger_260: "same",
  fedb_wind_sprints: "same",
  fedb_kettlebell_seesaw_press: "same",
  fedb_oblique_crunches_on_the_floor: "same",
  // The lying hip-lift family re-derives the floor reverse crunch itself:
  fedb_bent_knee_hip_raise: "same",
  fedb_bottoms_up: "same",
  fedb_butt_ups: "same",
  // Scaled down from the parent ("below pistol", "x 0.85", "ratios compressed", "scaled down", crunch × 0.64–0.87):
  hf_127: "harder",
  hf_134: "harder",
  wger_2691: "harder",
  fedb_alternating_kettlebell_press: "harder",
  fedb_elbow_to_knee: "harder",
  // The method also quotes the parent's "x1.2" or "same", but the research numbers sit below the parent:
  hf_119: "harder",
  fedb_double_kettlebell_push_press: "harder",
  // "pistol x1.2 twice (via archer level)": one step up from the archer squat.
  hf_91: "easier",
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
/** Kinds whose band is fixed outside the research table. */
const OUTSIDE_ANCHOR_KINDS = new Set(["endura", "coaching", "seed"]);
const toBand = (standards) => TIERS.map((tier) => standards[tier]);

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

/**
 * A parent label that names an anchor or a data source: its move id (null
 * for a source). A catalogue id stands for itself.
 */
function labelled(label, catalogue) {
  if (catalogue?.byId.has(label)) {
    return { label: lower(catalogue.byId.get(label).name), id: label };
  }
  if (!(label in PARENT_IDS)) {
    throw new Error(`Parent label "${label}" has no entry in PARENT_IDS`);
  }
  return { label, id: PARENT_IDS[label] };
}

/**
 * Parent of a derived row as { label, id }, most explicit first: a hand
 * override, an id in the method text, then "easierId/harderId/Parent is
 * <name>", then the earliest known anchor name, then the catalogue's own
 * easier/harder neighbour. `id` is null when the parent is a data source.
 */
function parentOf(row, catalogue) {
  if (PARENT_OVERRIDES[row.id]) {
    return labelled(PARENT_OVERRIDES[row.id], catalogue);
  }
  for (const id of row.method.match(ID_PATTERN) ?? []) {
    if (id !== row.id && catalogue.byId.has(id)) {
      return { label: lower(catalogue.byId.get(id).name), id };
    }
  }
  for (const hit of row.method.matchAll(NAMED_PATTERN)) {
    const name = hit[1].replace(/\b(?:easierId|harderId)\b/gi, "").trim();
    // Only a phrase that is an anchor name or a catalogue move counts; "parent kept" and the like do not.
    const id = catalogue.idByName.get(lower(name));
    if (id && id !== row.id) {
      return { label: lower(name), id };
    }
    const anchor = PARENTS.find(([pattern]) => pattern.test(name));
    if (anchor) {
      return labelled(anchor[1]);
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
    return labelled(best.label);
  }
  if (/\bcrunch(?:es)?\b/i.test(row.method)) {
    return labelled("crunch");
  }
  const links = catalogue.byId.get(row.id);
  const neighbour = links?.easierId ?? links?.harderId;
  if (neighbour && catalogue.byId.has(neighbour)) {
    return { label: lower(catalogue.byId.get(neighbour).name), id: neighbour };
  }
  throw new Error(`No parent found for derived row ${row.id} (${row.name}): ${row.method}`);
}

/**
 * Easier, harder or same against the parent: a hand override, then the
 * catalogue links, then the method text. Null when none settles it.
 */
function stepOf(row, parentId, catalogue) {
  if (STEP_OVERRIDES[row.id]) {
    return { step: STEP_OVERRIDES[row.id], from: "override" };
  }
  const move = catalogue.byId.get(row.id);
  const parent = catalogue.byId.get(parentId);
  const linked = move && parent ? stepFromLinks(move, parent) : null;
  if (linked) {
    return { step: linked, from: "catalogue" };
  }
  const written = stepFromMethod(row.method);
  if (written) {
    return { step: written, from: "method" };
  }
  return null;
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
const { bandFamilyFor } = await import("../src/data/enrich/bandFamilies.ts");
const byId = new Map(LIBRARY_CATALOGUE.map((exercise) => [exercise.id, exercise]));
const idByName = new Map();
for (const exercise of LIBRARY_CATALOGUE) {
  if (!idByName.has(lower(exercise.name))) {
    idByName.set(lower(exercise.name), exercise.id);
  }
}
const catalogue = { byId, idByName };
const rows = JSON.parse(readFileSync(INPUT, "utf8"));
const researchedIds = new Set(rows.map((row) => row.id));

/**
 * Fixed bands: Endura, coaching and seed moves outside the research table,
 * and family members among them (the catalogue already gives those the
 * family band, see bandFamilies.ts).
 */
const anchors = new Map();
for (const exercise of LIBRARY_CATALOGUE) {
  const kind = exercise.standardsSource?.kind;
  const outside = OUTSIDE_ANCHOR_KINDS.has(kind) || (kind === "family" && !researchedIds.has(exercise.id));
  if (exercise.standards && outside) {
    anchors.set(exercise.id, { band: toBand(exercise.standards), effort: exercise.effort });
  }
}

/** The band family of a researched row's move (bandFamilies.ts), or null. */
function familyOf(row) {
  const move = byId.get(row.id);
  return move ? bandFamilyFor({ name: move.name, role: move.role, effort: row.effort, difficulty: move.difficulty, pattern: move.pattern }) : null;
}
const outsideAnchors = anchors.size;

const kept = [];
const dropped = [];
const nodes = [];
const derivedRows = new Map();
const conversions = [];
const unsettled = [];

for (const row of rows) {
  const shadow = byId.get(row.id)?.standardsSource?.kind;
  if (OUTSIDE_ANCHOR_KINDS.has(shadow) && !COVERED_BY_COACHING[row.id]) {
    throw new Error(`${row.id} (${row.name}) is researched but gets a ${shadow} band first`);
  }
  if (row.status === "not_max_test") {
    kept.push({ row, kind: "not_max_test", source: "Not a max-rep test" });
    continue;
  }
  if (COVERED_BY_COACHING[row.id]) {
    dropped.push({ row, reason: `coaching list: ${COVERED_BY_COACHING[row.id]}` });
    continue;
  }
  if (row.status === "no_data" || row.verdict === "reject") {
    dropped.push({ row, reason: row.status === "no_data" ? "no_data" : "rejected" });
    continue;
  }
  // A family member takes the family band whatever its research said (user decisions, 2026-11-21).
  const family = familyOf(row);
  if (family) {
    const band = toBand(family.standards);
    anchors.set(row.id, { band, effort: row.effort });
    kept.push({ row, kind: "family", band, source: family.label, anchor: "family" });
    continue;
  }
  if (row.status === "sourced") {
    const band = parseBand(row.final ?? "");
    if (!band) {
      dropped.push({ row, reason: `invalid band ${row.final}` });
      continue;
    }
    const sources = parseSources(row.sources);
    anchors.set(row.id, { band, effort: row.effort });
    kept.push({ row, kind: "sourced", band, sources, source: sourcedLabel(sources), anchor: "sourced" });
    continue;
  }
  if (row.status !== "derived") {
    dropped.push({ row, reason: `unknown status ${row.status}` });
    continue;
  }
  const parent = parentOf(row, catalogue);
  if (parent.id === null) {
    const band = parseBand(row.final ?? "");
    if (!band) {
      dropped.push({ row, reason: `invalid band ${row.final}` });
      continue;
    }
    anchors.set(row.id, { band, effort: row.effort });
    kept.push({ row, kind: "derived", band, source: `Derived from ${parent.label}`, anchor: "single source" });
    continue;
  }
  const parentEffort = byId.get(parent.id)?.effort;
  if (parentEffort !== row.effort) {
    // Reps from a hold (or the reverse) at a stated pace: a unit conversion, not a ×1.2 step.
    const band = parseBand(row.final ?? "");
    if (!band) {
      dropped.push({ row, reason: `invalid band ${row.final}` });
      continue;
    }
    anchors.set(row.id, { band, effort: row.effort });
    conversions.push({ id: row.id, parentId: parent.id });
    kept.push({ row, kind: "derived", band, source: `Derived from ${parent.label}`, anchor: "conversion" });
    continue;
  }
  const stepped = stepOf(row, parent.id, catalogue);
  if (!stepped) {
    unsettled.push(`${row.id} (${row.name}) against ${parent.id}: ${row.method}`);
    continue;
  }
  const { step, from } = stepped;
  nodes.push({ id: row.id, parentId: parent.id, step, effort: row.effort });
  const entry = { row, kind: "derived", source: `Derived from ${parent.label}`, parentId: parent.id, step, stepFrom: from };
  derivedRows.set(row.id, entry);
  kept.push(entry);
}

if (unsettled.length > 0) {
  throw new Error(`No easier/harder step (add to STEP_OVERRIDES):\n${unsettled.join("\n")}`);
}
for (const { id, parentId } of conversions) {
  if (derivedRows.has(parentId)) {
    throw new Error(`${id} converts units from ${parentId}, which is derived; its band would go stale`);
  }
}
const { bands, order } = deriveChains(anchors, nodes);
for (const [id, entry] of derivedRows) {
  entry.band = [...bands.get(id)];
}

const q = (value) => JSON.stringify(value);
const lines = kept
  .sort((a, b) => a.row.id.localeCompare(b.row.id))
  .map(({ row, kind, band, sources, source, parentId, step }) => {
    const comment = [`  // ${row.name}`];
    for (const item of sources ?? []) {
      comment.push(`  //   ${item.title}${item.url ? ` <${item.url}>` : ""}`);
    }
    const standards = band
      ? ` standards: { ${TIERS.map((tier, i) => `${tier}: ${band[i]}`).join(", ")} },`
      : "";
    const parent = parentId ? ` parent: { id: ${q(parentId)}, step: ${q(step)} },` : "";
    return `${comment.join("\n")}\n  ${q(row.id)}: { kind: ${q(kind)},${standards}${parent} source: ${q(source)} },`;
  });

const header = `// Generated by scripts/build-researched-standards.mjs from
// docs/superpowers/specs/2026-11-21-researched-tier-standards/tier-research.json (#262).
// Do not edit by hand: change the research JSON and rerun the script.
import type { ExerciseStandards } from "../../domain/types";

export type ResearchedKind = "sourced" | "derived" | "family" | "not_max_test";

/** How a computed band relates to its parent's: ×1.2 (easier), ÷1.2 (harder) or unchanged. */
export type DerivationStep = "easier" | "harder" | "same";

export interface ResearchedStandard {
  kind: ResearchedKind;
  /** Absent for not_max_test: tiers do not apply. */
  standards?: ExerciseStandards;
  /** Short Library label: "Sourced: …", "Derived from …", a family band label or "Not a max-rep test". */
  source: string;
  /** Computed rows only: the parent move whose band this one steps from. Absent on anchors. */
  parent?: { id: string; step: DerivationStep };
}

/**
 * Researched tier bands by exercise id. Applied only where Endura and the
 * coaching list have no row (see \`standardsFor\`).
 */
export const RESEARCHED_STANDARDS: Readonly<Record<string, ResearchedStandard>> = {
`;

writeFileSync(OUTPUT, `${header}${lines.join("\n")}\n};\n`);

const count = (predicate) => kept.filter(predicate).length;
console.log(
  `researchedStandards.ts: ${count((item) => item.kind === "sourced")} sourced, ${count((item) => item.kind === "derived")} derived, ` +
    `${count((item) => item.kind === "family")} family, ` +
    `${count((item) => item.kind === "not_max_test")} not_max_test; ${dropped.length} dropped`,
);
console.log(
  `anchors: ${anchors.size} (${outsideAnchors} Endura/coaching/seed outside the table, ${count((item) => item.anchor === "sourced")} sourced, ` +
    `${count((item) => item.anchor === "family")} family, ${count((item) => item.anchor === "single source")} single-source, ` +
    `${count((item) => item.anchor === "conversion")} unit conversion); ` +
    `computed: ${order.length} (steps: ${["catalogue", "method", "override"].map((from) => `${count((item) => item.stepFrom === from)} ${from}`).join(", ")})`,
);
for (const { row, reason } of dropped) {
  console.log(`  dropped: ${row.id} ${row.name} (${reason})`);
}
const bandText = (band) => band.join("/");
if (process.argv.includes("--parents")) {
  for (const id of order) {
    const entry = derivedRows.get(id);
    console.log(`  ${id} ${entry.row.name} <- ${entry.parentId} ${entry.step} (${entry.stepFrom}) = ${bandText(entry.band)}`);
  }
}
if (process.argv.includes("--report")) {
  for (const id of order) {
    const entry = derivedRows.get(id);
    if (entry.row.final && entry.row.final !== bandText(entry.band)) {
      console.log(`  changed: ${id} ${entry.row.name} ${entry.row.final} -> ${bandText(entry.band)}`);
    }
  }
  const pairs = [];
  for (const exercise of LIBRARY_CATALOGUE) {
    if (exercise.easierId) {
      pairs.push([exercise.easierId, exercise.id]);
    }
    if (exercise.harderId) {
      pairs.push([exercise.id, exercise.harderId]);
    }
  }
  const bandOf = (id) =>
    anchors.get(id) ?? (bands.has(id) ? { band: bands.get(id), effort: derivedRows.get(id).row.effort } : undefined);
  const rootOf = (id) => {
    let current = id;
    while (derivedRows.has(current)) {
      current = derivedRows.get(current).parentId;
    }
    return current;
  };
  const kindOf = (id) => (anchors.has(id) ? "anchor" : `derived from ${rootOf(id)}`);
  const roots = new Map();
  for (const pair of variantOrderViolations(pairs, bandOf)) {
    const [easier, harder] = pair.split(" > ");
    console.log(
      `  violation: ${pair} ${bandText(bandOf(easier).band)} vs ${bandText(bandOf(harder).band)} (${kindOf(easier)}; ${kindOf(harder)})`,
    );
    const key = `${rootOf(easier)} > ${rootOf(harder)}`;
    roots.set(key, [...(roots.get(key) ?? []), pair]);
  }
  for (const [key, list] of [...roots].sort()) {
    const [easier, harder] = key.split(" > ");
    const same = easier === harder ? " SAME ROOT: a chain disagrees with itself" : "";
    console.log(`  anchor pair: ${key} ${bandText(anchors.get(easier).band)} vs ${bandText(anchors.get(harder).band)} (${list.length} pairs)${same}`);
  }
}
