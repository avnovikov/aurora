/**
 * Which Library moves without a doodle the planner actually schedules, and
 * how often: seed days, every area block, every skill block and the joint
 * care days, at every plan level, each run three times through so the
 * variety rule rotates moves in. Use it to pick the next doodles to draw.
 *
 *   npm run doodles:missing [-- body,bar,parallettes]   (default: every gear)
 */
import { doodleFor } from "../src/data/doodles.ts";
import { EXERCISE_GRAPH } from "../src/data/exerciseGraph.ts";
import { GENERATED_DOODLES } from "../src/data/generated/doodleMap.ts";
import { SESSION_TEMPLATES } from "../src/data/seed.ts";
import { EQUIPMENT_IDS, isEquipmentId, type EquipmentId, type SessionTemplate } from "../src/domain/program.ts";
import type { SkillTier } from "../src/domain/types.ts";
import { AREA_KINDS } from "../src/plan/dayKinds.ts";
import { previewQueue, type AthleteState } from "../src/plan/dayPreview.ts";
import { generateBlock } from "../src/plan/generateBlock.ts";
import { generateJointCareDay } from "../src/plan/jointCareDay.ts";
import type { StepContext } from "../src/plan/ladderSteps.ts";

const LEVELS: readonly (SkillTier | undefined)[] = ["beginner", "intermediate", "advanced", "elite", undefined];
const JOINTS = [
  { joint: "shoulder", side: "both", kind: "injury" },
  { joint: "knee", side: "both", kind: "injury" },
] as const;

function gearFromArgs(): EquipmentId[] {
  const arg = process.argv[2];
  if (!arg) return [...EQUIPMENT_IDS];
  return arg.split(",").filter(isEquipmentId);
}

function hasDoodle(id: string): boolean {
  return Boolean(GENERATED_DOODLES[id] ?? doodleFor(id, EXERCISE_GRAPH[id]?.doodlePath));
}

function daysToRun(context: StepContext, newId: () => string): [string, SessionTemplate[]][] {
  const runs: [string, SessionTemplate[]][] = [["seed day", [...SESSION_TEMPLATES]]];
  const tryAdd = (where: string, make: () => SessionTemplate[]): void => {
    try {
      runs.push([where, make()]);
    } catch {
      // No usable moves for this gear; nothing to count.
    }
  };
  for (const kind of AREA_KINDS) tryAdd("area day", () => generateBlock({ kind, context, newId }));
  const targets = new Set(SESSION_TEMPLATES.flatMap((template) => template.targetExerciseIds));
  for (const target of targets) {
    if (EXERCISE_GRAPH[target]) tryAdd("skill day", () => generateBlock({ kind: "skill", target, context, newId }));
  }
  for (const jointHistory of [[], ...JOINTS.map((joint) => [joint])]) {
    tryAdd("joint care day", () => [generateJointCareDay({ ...context, jointHistory }, newId)]);
  }
  return runs;
}

type Tally = Map<string, { times: number; where: Set<string> }>;

function tally(counts: Tally, exerciseId: string, where: string): void {
  if (hasDoodle(exerciseId)) return;
  const entry = counts.get(exerciseId) ?? { times: 0, where: new Set<string>() };
  entry.times++;
  entry.where.add(where);
  counts.set(exerciseId, entry);
}

function main(): void {
  const equipment = gearFromArgs();
  let next = 0;
  const newId = (): string => `rank${next++}`;
  const counts: Tally = new Map();
  for (const level of LEVELS) {
    const state: AthleteState = { memories: {}, history: [], jointHistory: [], equipment, excluded: [], deloadActive: false, level };
    const context: StepContext = { memories: {}, equipment, jointHistory: [], excluded: [], level };
    for (const [where, days] of daysToRun(context, newId)) {
      for (const items of previewQueue([...days, ...days, ...days], state)) {
        for (const item of items) tally(counts, item.exerciseId, where);
      }
    }
  }
  const rows = [...counts].sort((a, b) => b[1].times - a[1].times);
  console.log(`${rows.length} scheduled moves without a doodle (gear: ${equipment.join(", ")})`);
  for (const [id, entry] of rows) {
    console.log([id, EXERCISE_GRAPH[id]?.name ?? id, entry.times, [...entry.where].join(", ")].join("\t"));
  }
}

main();
