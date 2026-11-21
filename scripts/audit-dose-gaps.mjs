/**
 * Audit gaps between description prescription ranges and:
 * - warmup holdSeconds / perSide
 * - library tier standards (novice→elite)
 */
import { readFileSync } from "node:fs";

function parsePrescription(text) {
  const t = text.toLowerCase().replace(/×/g, "x").replace(/–/g, "-");
  const perSide = /each side|per side|per leg|then the other|switch sides/.test(t);

  let m = t.match(/(\d+)\s*x\s*(\d+)\s*-\s*(\d+)\s*s(?:ec(?:onds)?)?/);
  if (m) {
    return { rounds: +m[1], min: +m[2], max: +m[3], unit: "sec", perSide, raw: text };
  }
  m = t.match(/(\d+)\s*x\s*(\d+)\s*s(?:ec(?:onds)?)?/);
  if (m) {
    return { rounds: +m[1], min: +m[2], max: +m[2], unit: "sec", perSide, raw: text };
  }
  m = t.match(/two\s+(\d+)\s*s(?:ec(?:onds)?)?/);
  if (m) {
    return { rounds: 2, min: +m[1], max: +m[1], unit: "sec", perSide, raw: text };
  }
  m = t.match(/prescription:\s*(\d+)\s*-\s*(\d+)\s*sec/);
  if (m) {
    return { rounds: 1, min: +m[1], max: +m[2], unit: "sec", perSide, raw: text };
  }
  m = t.match(/prescription:\s*(\d+)\s*-\s*(\d+)\s*reps/);
  if (m) {
    return { rounds: 1, min: +m[1], max: +m[2], unit: "reps", perSide, raw: text };
  }
  m = t.match(/prescription:\s*(\d+)\s*reps/);
  if (m) {
    return { rounds: 1, min: +m[1], max: +m[1], unit: "reps", perSide, raw: text };
  }
  m = t.match(/hold\s+(\d+)\s*-\s*(\d+)\s*seconds/);
  if (m) {
    return { rounds: 1, min: +m[1], max: +m[2], unit: "sec", perSide, raw: text };
  }
  m = t.match(/(\d+)\s*s(?:ec(?:onds)?)?\s*per\s*(?:side|leg)/);
  if (m) {
    return { rounds: 1, min: +m[1], max: +m[1], unit: "sec", perSide: true, raw: text };
  }
  m = t.match(/(\d+)\s*-\s*(\d+)\s*s(?:ec(?:onds)?)?/);
  if (m) {
    return { rounds: 1, min: +m[1], max: +m[2], unit: "sec", perSide, raw: text };
  }
  m = t.match(/(\d+)\s*x\s*(\d+)\s*(?:slow\s*)?reps/);
  if (m) {
    return { rounds: +m[1], min: +m[2], max: +m[2], unit: "reps", perSide, raw: text };
  }
  return null;
}

function expectedTotalSeconds(p) {
  const sides = p.perSide ? 2 : 1;
  return {
    min: p.rounds * p.min * sides,
    max: p.rounds * p.max * sides,
    segments: p.rounds * sides,
    segmentSec: p.min === p.max ? String(p.min) : `${p.min}-${p.max}`,
  };
}

function extractWarmupStations(src) {
  const out = [];
  const chunks = src.split(/\n(?=\s*(?:\{|ramp\(|cooldown))/);
  for (const chunk of chunks) {
    const id = chunk.match(/\bid:\s*"([^"]+)"/)?.[1];
    if (!id) continue;
    const hold = chunk.match(/holdSeconds:\s*(\d+)/)?.[1];
    if (!hold) continue;
    const perSide = /perSide:\s*true/.test(chunk);
    const cues = [...chunk.matchAll(/(?:extraCues|cues):\s*\[([^\]]*)\]/gs)].flatMap((m) =>
      [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]),
    );
    out.push({ id, holdSeconds: +hold, perSide, cues });
  }
  return out;
}

function auditWarmup() {
  const src = readFileSync("src/data/warmupStations.ts", "utf8");
  const stations = extractWarmupStations(src);
  const rows = [];
  for (const s of stations) {
    for (const cue of s.cues) {
      const p = parsePrescription(cue);
      if (!p || p.unit !== "sec") continue;
      // station perSide wins if set
      const dose = { ...p, perSide: s.perSide || p.perSide };
      const exp = expectedTotalSeconds(dose);
      const actual = s.holdSeconds;
      const mid = (exp.min + exp.max) / 2;
      const delta = actual - mid;
      const notExpanded = dose.rounds > 1 || (dose.perSide && dose.rounds >= 1 && exp.segments > 2);
      const mismatch =
        actual < exp.min - 5 ||
        actual > exp.max + 20 ||
        Math.abs(delta) >= 20 ||
        (dose.rounds > 1 && dose.perSide);
      if (!mismatch && !notExpanded) continue;
      rows.push({
        id: s.id,
        cue,
        holdSeconds: actual,
        perSide: s.perSide,
        descMinTotal: exp.min,
        descMaxTotal: exp.max,
        segments: exp.segments,
        segmentSec: exp.segmentSec,
        deltaFromMid: Math.round(delta),
        issue:
          dose.rounds > 1 && dose.perSide
            ? `cue wants ${exp.segments}×${exp.segmentSec}s; app: 1 timer ${actual}s + 1 switch`
            : dose.rounds > 1
              ? `cue wants ${dose.rounds} segments; app: 1 timer ${actual}s`
              : `total timer ${actual}s vs cue total ${exp.min}-${exp.max}s`,
      });
    }
  }
  rows.sort((a, b) => Math.abs(b.deltaFromMid) - Math.abs(a.deltaFromMid));
  return rows;
}

function auditDescriptionsVsStandards() {
  // Parse descriptions.ts for Hold 20-30 + id, and enrich standards from exercise graph via a small tsx run.
  const descSrc = readFileSync("src/data/generated/descriptions.ts", "utf8");
  // Format: export const DESCRIPTIONS: Record<string, CuratedDescription> = { "id": { ... }, }
  const byId = new Map();
  let currentId = null;
  let buf = [];
  const lines = descSrc.split("\n");
  for (const line of lines) {
    const idMatch = line.match(/^\s*"([^"]+)":\s*\{$/);
    if (idMatch) {
      if (currentId) flush(currentId, buf, byId);
      currentId = idMatch[1];
      buf = [];
      continue;
    }
    if (currentId) buf.push(line);
  }
  if (currentId) flush(currentId, buf, byId);

  const holdRangeIds = [];
  for (const [id, text] of byId) {
    const p = parsePrescription(text);
    if (!p) continue;
    holdRangeIds.push({ id, ...p });
  }
  return holdRangeIds;
}

function flush(id, buf, byId) {
  const text = buf.join("\n");
  byId.set(id, text);
}

function auditSeedTemplateDoses() {
  const seed = readFileSync("src/data/seed.ts", "utf8");
  const standards = {};
  const stdBlock = seed.match(/const SEED_STANDARDS[\s\S]*?^};/m)?.[0] ?? "";
  for (const m of stdBlock.matchAll(/(\w+):\s*std\(([^)]+)\)/g)) {
    const [n, b, i, a, e] = m[2].split(",").map((x) => +x.trim());
    standards[m[1]] = { novice: n, beginner: b, intermediate: i, advanced: a, elite: e };
  }

  const rows = [];
  // template doses: exerciseId + dose: { sets, reps }
  for (const m of seed.matchAll(/exerciseId:\s*"([^"]+)"[\s\S]{0,200}?dose:\s*\{\s*sets:\s*(\d+),\s*reps:\s*(\d+)/g)) {
    const id = m[1];
    const sets = +m[2];
    const reps = +m[3];
    const s = standards[id];
    if (!s) {
      rows.push({ id, sets, reps, issue: "seed dose but no SEED_STANDARDS" });
      continue;
    }
    // hard clamp should be description range; standards span novice..elite
    const stdMin = s.novice;
    const stdMax = s.elite;
    if (reps < stdMin || reps > stdMax) {
      rows.push({
        id,
        sets,
        reps,
        standards: `${stdMin}→${stdMax}`,
        issue: `template reps ${reps} outside standards ${stdMin}-${stdMax}`,
        gap: reps < stdMin ? stdMin - reps : reps - stdMax,
      });
    } else {
      // how far from beginner working band
      const beginner = s.beginner;
      const delta = reps - beginner;
      if (Math.abs(delta) >= 10) {
        rows.push({
          id,
          sets,
          reps,
          standards: `${stdMin}→${stdMax}`,
          beginner,
          issue: `template reps ${reps} far from beginner standard ${beginner}`,
          gap: Math.abs(delta),
        });
      }
    }
  }
  rows.sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0));
  return { standards, rows };
}

function auditDescRangeVsStandards(descRx, standards) {
  // For holds with 20-30 in description: compare to standards band
  const rows = [];
  for (const d of descRx) {
    if (d.unit !== "sec" && d.unit !== "reps") continue;
    const s = standards[d.id];
    // also try without checking - many imported ids
    if (!s) {
      // generic: if description is narrow mobility hold 20-30 but exercise might get HOLDS beginner 20-220
      continue;
    }
    const descMin = d.min;
    const descMax = d.max;
    const stdMin = s.novice;
    const stdMax = s.elite;
    // disagreement: standards extend far beyond description, or description outside standards
    const beyondHigh = stdMax - descMax;
    const beyondLow = descMin - stdMin;
    const descOutside = descMax < stdMin || descMin > stdMax;
    const large = beyondHigh >= 40 || beyondLow >= 15 || descOutside;
    if (!large) continue;
    rows.push({
      id: d.id,
      desc: `${d.rounds}×${descMin}-${descMax} ${d.unit}${d.perSide ? " perSide" : ""}`,
      standards: `${stdMin}→${stdMax}`,
      beyondHigh,
      issue: descOutside
        ? "description range outside tier standards"
        : `standards elite ${stdMax} vs desc max ${descMax} (gap ${beyondHigh})`,
    });
  }
  rows.sort((a, b) => (b.beyondHigh ?? 0) - (a.beyondHigh ?? 0));
  return rows;
}

// Also compare curated Hold 20-30 exercises that HAVE standards via exercise graph dump
async function loadGraphStandards() {
  // Use npx tsx to evaluate
  const { spawnSync } = await import("node:child_process");
  const code = `
import { EXERCISE_GRAPH } from "./src/data/exerciseGraph.ts";
const out = {};
for (const [id, ex] of Object.entries(EXERCISE_GRAPH)) {
  if (ex.standards) out[id] = ex.standards;
}
console.log(JSON.stringify(out));
`;
  const r = spawnSync("npx", ["tsx", "-e", code], {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 20_000_000,
  });
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    return {};
  }
  try {
    return JSON.parse(r.stdout.trim().split("\n").at(-1));
  } catch (e) {
    console.error("parse fail", r.stdout.slice(0, 500));
    return {};
  }
}

const warmupGaps = auditWarmup();
const { standards: seedStd, rows: seedDoseGaps } = auditSeedTemplateDoses();
const descRx = auditDescriptionsVsStandards();

console.log("\n=== 1. WARMUP: cue/description dose vs authored holdSeconds ===\n");
console.log(JSON.stringify(warmupGaps.slice(0, 25), null, 2));
console.log(`\n(total warmup mismatches: ${warmupGaps.length})\n`);

console.log("\n=== 2. SEED TEMPLATES: fixed dose vs SEED_STANDARDS ===\n");
console.log(JSON.stringify(seedDoseGaps.slice(0, 25), null, 2));

const graphStd = await loadGraphStandards();
const mergedStd = { ...graphStd, ...seedStd };
const descVsStd = auditDescRangeVsStandards(descRx, mergedStd);

// Also: all desc prescriptions with perSide / multi-round regardless of standards
const multi = descRx
  .filter((d) => d.rounds > 1 || d.perSide)
  .map((d) => ({
    id: d.id,
    dose: `${d.rounds}×${d.min}${d.min !== d.max ? `-${d.max}` : ""} ${d.unit}${d.perSide ? " perSide" : ""}`,
    hasStandards: Boolean(mergedStd[d.id]),
    standards: mergedStd[d.id]
      ? `${mergedStd[d.id].novice}→${mergedStd[d.id].elite}`
      : null,
  }));

console.log("\n=== 3. DESCRIPTION ranges vs tier standards (large gaps) ===\n");
console.log(JSON.stringify(descVsStd.slice(0, 40), null, 2));
console.log(`\n(total large gaps: ${descVsStd.length})\n`);

console.log("\n=== 4. Descriptions with multi-round or perSide (need structured fields) ===\n");
console.log(JSON.stringify(multi.slice(0, 40), null, 2));
console.log(`\n(total multi/perSide prescriptions found: ${multi.length})\n`);

// Highlight classic conflicts: hold desc 20-30 vs HOLDS beginner elite 220
const genericHoldConflicts = [];
for (const d of descRx) {
  if (d.unit !== "sec") continue;
  if (d.max > 60) continue; // only short prescription text
  const s = mergedStd[d.id];
  if (!s) continue;
  if (s.elite >= d.max + 40) {
    genericHoldConflicts.push({
      id: d.id,
      descMax: d.max,
      elite: s.elite,
      gap: s.elite - d.max,
      beginner: s.beginner,
    });
  }
}
genericHoldConflicts.sort((a, b) => b.gap - a.gap);
console.log("\n=== 5. Short desc holds (≤60s) vs much higher elite standard ===\n");
console.log(JSON.stringify(genericHoldConflicts.slice(0, 30), null, 2));
console.log(`\n(total: ${genericHoldConflicts.length})\n`);
