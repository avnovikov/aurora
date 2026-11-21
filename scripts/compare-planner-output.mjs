/**
 * Compares two audit-planner-output.mts dumps (#262) and explains every
 * difference as a band change or a move that is tierless now. Also checks
 * that no generated slot holds a tierless move, a move without standards or
 * the 8 reps at RIR 2 placeholder.
 *
 *   node scripts/compare-planner-output.mjs base.json branch.json
 */
import { readFileSync } from "node:fs";

const base = JSON.parse(readFileSync(process.argv[2], "utf8"));
const branch = JSON.parse(readFileSync(process.argv[3], "utf8"));

const bandChanged = (id) => JSON.stringify(base.bands[id]) !== JSON.stringify(branch.bands[id]);
const tierless = (id) => branch.bands[id]?.kind === "none";
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const summary = {};
const unexplained = [];
const reasons = {};
function note(section, key, reason) {
  reasons[reason] = (reasons[reason] ?? 0) + 1;
  summary[section].changed += 1;
}

function explainPlan(section, key, a, b) {
  if (eq(a, b)) return;
  const ida = a.work.map((w) => w.exerciseId);
  const idb = b.work.map((w) => w.exerciseId);
  const why = new Set();
  if (!eq(ida, idb)) {
    const involved = [...new Set([...ida, ...idb])].filter((id) => !(ida.includes(id) && idb.includes(id)));
    if (involved.some(tierless)) why.add("selection: base move is tierless now");
    else if (involved.some(bandChanged)) why.add("selection: band change");
    else unexplained.push(`${section} ${key}: work ids ${ida} -> ${idb}`);
  }
  for (let i = 0; i < Math.min(a.work.length, b.work.length); i += 1) {
    const wa = a.work[i], wb = b.work[i];
    if (wa.exerciseId !== wb.exerciseId || eq(wa, wb)) continue;
    if (bandChanged(wa.exerciseId)) {
      why.add(tierless(wa.exerciseId) ? "dose: tierless now (seed slot dose kept)" : "dose: band change");
    } else {
      const diffKeys = Object.keys({ ...wa, ...wb }).filter((k) => !eq(wa[k], wb[k]));
      unexplained.push(`${section} ${key}: ${wa.exerciseId} ${diffKeys.join(",")} ${JSON.stringify(diffKeys.map((k) => [wa[k], wb[k]]))}`);
    }
  }
  if (!eq(a.warmup, b.warmup)) {
    why.add("warm-up");
  }
  if (!eq(a.cooldown, b.cooldown)) unexplained.push(`${section} ${key}: cooldown differs`);
  for (const w of why) note(section, key, `${section}: ${w}`);
  if (why.size === 0 && !unexplained.some((u) => u.startsWith(`${section} ${key}:`))) unexplained.push(`${section} ${key}: differs (unclassified)`);
}

for (const section of ["seed", "blockPlans"]) {
  summary[section] = { total: Object.keys(base[section]).length, changed: 0 };
  for (const key of Object.keys(base[section])) {
    if (!branch[section][key]) { unexplained.push(`${section} ${key}: missing on branch`); continue; }
    const before = summary[section].changed;
    explainPlan(section, key, base[section][key], branch[section][key]);
    summary[section].changed = before + (eq(base[section][key], branch[section][key]) ? 0 : 1);
  }
  for (const key of Object.keys(branch[section])) if (!base[section][key]) unexplained.push(`${section} ${key}: new on branch`);
}

summary.blocks = { total: Object.keys(base.blocks).length, changed: 0, slotsChanged: 0, slotsTotal: 0 };
for (const key of Object.keys(base.blocks)) {
  const a = base.blocks[key], b = branch.blocks[key];
  if (eq(a, b)) { summary.blocks.slotsTotal += Array.isArray(a) ? a.flatMap((d) => d.slots).length : 0; continue; }
  summary.blocks.changed += 1;
  if (!Array.isArray(a) || !Array.isArray(b)) { unexplained.push(`blocks ${key}: error state differs`); continue; }
  const sa = a.flatMap((d) => d.slots), sb = b.flatMap((d) => d.slots);
  summary.blocks.slotsTotal += sa.length;
  for (let i = 0; i < Math.max(sa.length, sb.length); i += 1) {
    const x = sa[i], y = sb[i];
    if (eq(x, y)) continue;
    summary.blocks.slotsChanged += 1;
    if (!x || !y) { reasons["blocks: slot count differs"] = (reasons["blocks: slot count differs"] ?? 0) + 1; continue; }
    if (x.exerciseId !== y.exerciseId) {
      const r = tierless(x.exerciseId) ? "blocks: base move is tierless now" : bandChanged(x.exerciseId) || bandChanged(y.exerciseId) ? "blocks: move change with band change" : null;
      if (r) reasons[r] = (reasons[r] ?? 0) + 1; else unexplained.push(`blocks ${key} slot ${i}: ${x.exerciseId} -> ${y.exerciseId} (no band change)`);
    } else if (bandChanged(x.exerciseId)) {
      reasons["blocks: dose from band change"] = (reasons["blocks: dose from band change"] ?? 0) + 1;
    } else {
      unexplained.push(`blocks ${key} slot ${i}: ${x.exerciseId} ${JSON.stringify(x.dose)} -> ${JSON.stringify(y.dose)} (no band change)`);
    }
  }
}

// Invariants on the branch.
const violations = [];
for (const [key, days] of Object.entries(branch.blocks)) {
  if (!Array.isArray(days)) continue;
  for (const slot of days.flatMap((d) => d.slots)) {
    const info = branch.bands[slot.exerciseId];
    if (info?.kind === "none") violations.push(`tierless in generated block ${key}: ${slot.exerciseId}`);
    if (!info?.band && !slot.id.endsWith("_care")) violations.push(`no standards in generated block ${key}: ${slot.exerciseId} ${JSON.stringify(slot.dose)}`);
    if (!info?.band && slot.dose.reps === 8 && slot.dose.targetRir === 2) violations.push(`default 8 / RIR 2 in ${key}: ${slot.exerciseId}`);
  }
}
for (const section of ["seed", "blockPlans"]) {
  for (const [key, plan] of Object.entries(branch[section])) {
    for (const w of plan.work) {
      if (!branch.bands[w.exerciseId]?.band && w.dose.reps === 8 && w.dose.targetRir === 2 && section === "blockPlans") violations.push(`default 8 / RIR 2 planned ${key}: ${w.exerciseId}`);
    }
  }
}
const seedTierless = new Set();
for (const [key, plan] of Object.entries(branch.seed)) for (const w of plan.work) if (tierless(w.exerciseId)) seedTierless.add(w.exerciseId);

console.log(JSON.stringify({ summary, reasons, unexplained: unexplained.slice(0, 60), unexplainedCount: unexplained.length, invariantViolations: violations.slice(0, 30), invariantCount: violations.length, seedTierless: [...seedTierless] }, null, 1));
