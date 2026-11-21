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

/** Band or effort changed, or the move became tierless. The source kind is ignored: dev records none. */
const bandChanged = (id) =>
  base.bands[id]?.band !== branch.bands[id]?.band ||
  base.bands[id]?.effort !== branch.bands[id]?.effort ||
  (branch.bands[id]?.kind === "none") !== (base.bands[id]?.kind === "none");
const tierless = (id) => branch.bands[id]?.kind === "none";
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const summary = {};
const unexplained = [];
const reasons = {};
function note(reason) {
  reasons[reason] = (reasons[reason] ?? 0) + 1;
}

/** The slot's move before a stall regression: the same slot in the template's plain plan. */
function slotMoveBeforeRegress(section, key, slotId) {
  const plain = base[section][`${key.split(" | ")[0]} | plain`];
  return plain?.work.find((w) => w.slotId === slotId)?.exerciseId;
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
    } else if (wa.ruleIds?.includes("stall_regress") && bandChanged(slotMoveBeforeRegress(section, key, wa.slotId))) {
      // A stall regression keeps the dose planned for the slot's own move.
      why.add("dose: regressed from a move whose band changed");
    } else {
      const diffKeys = Object.keys({ ...wa, ...wb }).filter((k) => !eq(wa[k], wb[k]));
      unexplained.push(`${section} ${key}: ${wa.exerciseId} ${diffKeys.join(",")} ${JSON.stringify(diffKeys.map((k) => [wa[k], wb[k]]))}`);
    }
  }
  if (!eq(a.warmup, b.warmup)) {
    // The warm-up level comes from the work moves' ladder bands (warmupLevelFor).
    if ([...ida, ...idb].some(bandChanged)) why.add("warm-up: level from a work move's band change");
    else unexplained.push(`${section} ${key}: warm-up differs with no band change`);
  }
  if (!eq(a.cooldown, b.cooldown)) unexplained.push(`${section} ${key}: cooldown differs`);
  for (const w of why) note(`${section}: ${w}`);
  if (why.size === 0 && !unexplained.some((u) => u.startsWith(`${section} ${key}:`))) unexplained.push(`${section} ${key}: differs (unclassified)`);
}

for (const section of ["seed", "blockPlans"]) {
  summary[section] = { total: Object.keys(base[section]).length, changed: 0 };
  for (const key of Object.keys(base[section])) {
    if (!branch[section][key]) { unexplained.push(`${section} ${key}: missing on branch`); continue; }
    explainPlan(section, key, base[section][key], branch[section][key]);
    if (!eq(base[section][key], branch[section][key])) summary[section].changed += 1;
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
  // The generator rotates each slot kind through its ladder across the block's
  // days, so a change in an earlier slot of the same kind moves later picks on.
  const movedOn = new Set();
  const kindOf = (slot) => slot.id.replace(/^day_[^_]+_/, "").replace(/_\d+$/, "");
  for (let i = 0; i < Math.max(sa.length, sb.length); i += 1) {
    const x = sa[i], y = sb[i];
    if (eq(x, y)) continue;
    summary.blocks.slotsChanged += 1;
    if (!x || !y) { unexplained.push(`blocks ${key} slot ${i}: slot count differs`); continue; }
    if (x.exerciseId !== y.exerciseId) {
      const r = tierless(x.exerciseId)
        ? "blocks: base move is tierless now"
        : bandChanged(x.exerciseId) || bandChanged(y.exerciseId)
          ? "blocks: move change with band change"
          : movedOn.has(kindOf(x))
            ? "blocks: rotation moved on after an earlier slot of the same kind changed"
            : null;
      if (r) { note(r); movedOn.add(kindOf(x)); } else unexplained.push(`blocks ${key} slot ${i}: ${x.exerciseId} -> ${y.exerciseId} (no band change)`);
    } else if (bandChanged(x.exerciseId)) {
      note("blocks: dose from band change");
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
// Seed days are left out: a seed slot that holds a tierless move keeps the seed slot's own dose.
for (const [key, plan] of Object.entries(branch.blockPlans)) {
  for (const w of plan.work) {
    if (!branch.bands[w.exerciseId]?.band && w.dose.reps === 8 && w.dose.targetRir === 2) violations.push(`default 8 / RIR 2 planned ${key}: ${w.exerciseId}`);
  }
}
const seedTierless = new Set();
for (const [key, plan] of Object.entries(branch.seed)) for (const w of plan.work) if (tierless(w.exerciseId)) seedTierless.add(w.exerciseId);

console.log(JSON.stringify({ summary, reasons, unexplained: unexplained.slice(0, 60), unexplainedCount: unexplained.length, invariantViolations: violations.slice(0, 30), invariantCount: violations.length, seedTierless: [...seedTierless] }, null, 1));
