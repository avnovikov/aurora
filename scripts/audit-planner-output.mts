/**
 * Planner-output audit (#262): dumps seed-day plans across scenarios and
 * generated blocks (with their plans) for one source tree, as JSON.
 *
 *   AUDIT_ROOT=<tree> npx tsx scripts/audit-planner-output.mts > out.json
 *
 * Run it on the base tree (git archive <base> | tar -x -C <dir>, node_modules
 * linked) and on the branch, then compare with compare-planner-output.mjs.
 */
const ROOT = process.env.AUDIT_ROOT!;
const seed = await import(`${ROOT}/src/data/seed.ts`);
const { planSession } = await import(`${ROOT}/src/rules/planSession.ts`);
const { generateBlock } = await import(`${ROOT}/src/plan/generateBlock.ts`);
const { EXERCISE_GRAPH } = await import(`${ROOT}/src/data/exerciseGraph.ts`);
const { EQUIPMENT_IDS } = await import(`${ROOT}/src/domain/program.ts`);
const { AREA_KINDS } = await import(`${ROOT}/src/plan/dayKinds.ts`);

type Mem = Record<string, any>;
const mem = (id: string, over: Mem = {}) => ({
  exerciseId: id, sessionsAtStandard: 0, sessionsBelowFloor: 0, lastAddedLoadKg: 0, weakLinkSessionsRemaining: 0, ...over,
});
const memsFor = (ids: string[], over: Mem) => Object.fromEntries(ids.map((id) => [id, mem(id, over)]));
const workIds = (day: any): string[] => day.slots.map((slot: any) => slot.exerciseId);

const good = { painJoints: [] as string[], sleepQuality: "good" };
interface Scenario { name: string; readiness: any; memories: (day: any) => Mem; options: Mem }
const SCENARIOS: Scenario[] = [
  { name: "plain", readiness: good, memories: () => ({}), options: {} },
  { name: "poor sleep", readiness: { ...good, sleepQuality: "poor" }, memories: () => ({}), options: {} },
  { name: "deload", readiness: good, memories: () => ({}), options: { deloadActive: true } },
  { name: "pain shoulder", readiness: { ...good, painJoints: ["shoulder"] }, memories: () => ({}), options: {} },
  { name: "pain knee", readiness: { ...good, painJoints: ["knee"] }, memories: () => ({}), options: {} },
  { name: "joint history", readiness: good, memories: () => ({}), options: { jointHistory: [{ joint: "shoulder", side: "left", kind: "dislocation" }, { joint: "knee", side: "right", kind: "ligament" }] } },
  { name: "no gear", readiness: good, memories: () => ({}), options: { equipment: ["body"] } },
  { name: "all gear", readiness: good, memories: () => ({}), options: { equipment: [...EQUIPMENT_IDS] } },
  { name: "advance", readiness: good, memories: (day) => memsFor(workIds(day), { sessionsAtStandard: 3, bestReps: 30 }), options: {} },
  { name: "stall", readiness: good, memories: (day) => memsFor(workIds(day), { sessionsBelowFloor: 3, bestReps: 2 }), options: {} },
  { name: "declared advanced", readiness: good, memories: (day) => memsFor(workIds(day), { declaredTier: "advanced", declaredAt: "2026-11-01T00:00:00.000Z" }), options: {} },
];

const strip = (planned: any) => ({
  warmup: planned.warmup,
  work: planned.work,
  cooldown: planned.cooldown,
});

const out: any = { seed: {}, blocks: {}, blockPlans: {} };
for (const day of seed.SESSION_TEMPLATES) {
  for (const sc of SCENARIOS) {
    const planned = planSession(sc.readiness, seed.templateToStarter(day), sc.memories(day), { focus: day.focus, ...sc.options });
    out.seed[`${day.id} | ${sc.name}`] = strip(planned);
  }
}

const CONTEXTS: Record<string, any> = {
  plain: { memories: {}, jointHistory: [], excluded: [] },
  "no gear": { memories: {}, jointHistory: [], excluded: [], equipment: ["body"] },
  "all gear": { memories: {}, jointHistory: [], excluded: [], equipment: [...EQUIPMENT_IDS] },
  "joint history": { memories: {}, jointHistory: [{ joint: "shoulder", side: "left", kind: "dislocation" }, { joint: "knee", side: "right", kind: "ligament" }], excluded: [] },
  "level beginner": { memories: {}, jointHistory: [], excluded: [], level: "beginner" },
  "declared advanced": { memories: {}, jointHistory: [], excluded: [], level: "advanced" },
};
const targets = [...new Set(seed.SESSION_TEMPLATES.flatMap((t: any) => t.targetExerciseIds ?? []))] as string[];
const kinds: [string, string | undefined][] = [
  ...AREA_KINDS.map((k: string) => [k, undefined] as [string, undefined]),
  ...targets.map((t) => ["skill", t] as [string, string]),
];
for (const [kind, target] of kinds) {
  for (const [cname, context] of Object.entries(CONTEXTS)) {
    let n = 0;
    const key = `${kind}${target ? `:${target}` : ""} | ${cname}`;
    try {
      const days = generateBlock({ kind, target, context, newId: () => `id${++n}` });
      out.blocks[key] = days.map((d: any) => ({ id: d.id, focus: d.focus, slots: d.slots }));
      for (const d of days) {
        for (const sc of [SCENARIOS[0]!, SCENARIOS[2]!]) {
          const planned = planSession(sc.readiness, seed.templateToStarter(d), {}, { focus: d.focus, ...sc.options, equipment: context.equipment, jointHistory: context.jointHistory });
          out.blockPlans[`${key} | ${d.id} | ${sc.name}`] = strip(planned);
        }
      }
    } catch (error) {
      out.blocks[key] = { error: String((error as Error).message) };
    }
  }
}
const band = (s: any) => (s ? [s.novice, s.beginner, s.intermediate, s.advanced, s.elite].join("/") : null);
out.bands = Object.fromEntries(Object.entries(EXERCISE_GRAPH).map(([id, e]: [string, any]) => [id, { band: band(e.standards), kind: e.standardsSource?.kind ?? null, effort: e.effort ?? null }]));
process.stdout.write(JSON.stringify(out));
