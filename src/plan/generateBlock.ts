import { EXERCISE_GRAPH } from "../data/exerciseGraph";
import { LIBRARY_CATALOGUE } from "../data/libraryCatalogue";
import { SESSION_TEMPLATES, type SeedExercise } from "../data/seed";
import type { BlockEmphasis, JointHistoryEntry, SessionTemplate, TemplateSlot } from "../domain/program";
import { tierIndex } from "../domain/skillTier";
import { resolveExerciseTiming } from "../domain/timing";
import { applySkillDose } from "../rules/skillDose";
import { emptyMemory } from "../session/history";
import { areaOf } from "../library/facets";
import { prehabFor } from "../safety/prehab";
import { JOINT_LABEL } from "../settings/jointHistory";
import { DAY_KIND_LABELS, focusOfKind, skillTitle, type AreaKind } from "./dayKinds";
import {
  easierStep,
  familyOf,
  familyTier,
  workingStep,
  type LadderMember,
  type StepContext,
} from "./ladderSteps";
import { GENERATED_DAY_PREFIX } from "./planDays";
import { AREA_RECIPES, FAMILY_AREA, type LadderSlotSpec } from "./recipes";

export type BlockKind = AreaKind | "skill";

export interface BlockInput {
  kind: BlockKind;
  /** How many days (1 to 3); default 3. */
  count?: number;
  /** The named move of a skill day, or the goal an area day works toward. */
  target?: string;
  context: StepContext;
  /** Injected in tests for stable ids. */
  newId?: () => string;
}

const LETTERS = ["A", "B", "C"] as const;
const EMPHASIS_BY_LETTER: Record<(typeof LETTERS)[number], BlockEmphasis> = {
  A: "working",
  B: "easier",
  C: "focus",
};
const MAX_SLOTS = 5;

/** Which seed day lends its warm-up, cool-down, minutes and default goals. */
const SEED_BY_AREA: Record<AreaKind, string> = {
  upper: "tmpl_bars",
  lower: "tmpl_legs",
  core: "tmpl_abs",
  full: "tmpl_full",
};

/** A joint's care move goes into the days that load it. */
const CARE_JOINTS: Record<AreaKind, readonly JointHistoryEntry["joint"][]> = {
  upper: ["shoulder"],
  lower: ["knee", "hip"],
  core: ["lumbar"],
  full: [],
};

interface SlotPick {
  spec: LadderSlotSpec;
  member: LadderMember;
}

function defaultId(): string {
  return globalThis.crypto.randomUUID().replaceAll("-", "").slice(0, 10);
}

/**
 * The seed day whose warm-up, cool-down and time band a generated day
 * borrows. A named skill takes the seed day that trains the same ladder
 * (a handstand day gets the handstand day's wrist preparation); otherwise
 * the area's seed day.
 */
function seedFor(area: AreaKind, target: string | undefined, ctx: StepContext): SessionTemplate {
  const family = target ? familyOf(target, ctx) : undefined;
  const sameLadder = family
    ? SESSION_TEMPLATES.find((template) =>
        template.targetExerciseIds.length === 1 &&
        template.targetExerciseIds.some((id) => familyOf(id, ctx) === family),
      )
    : undefined;
  const seed = sameLadder ?? SESSION_TEMPLATES.find((template) => template.id === SEED_BY_AREA[area]);
  if (!seed) {
    throw new Error(`Missing seed template ${SEED_BY_AREA[area]}`);
  }
  return seed;
}

/** The strength area a named move belongs to; its ladder's area, else its muscles'. */
function areaKindOfTarget(targetId: string, ctx: StepContext): AreaKind {
  const family = familyOf(targetId, ctx);
  const byFamily = family ? FAMILY_AREA[family] : undefined;
  const byMuscles = areaOf(requireExercise(targetId));
  return byFamily ?? (byMuscles === "upper" || byMuscles === "lower" || byMuscles === "core" ? byMuscles : "full");
}

function requireExercise(exerciseId: string): SeedExercise {
  const exercise = EXERCISE_GRAPH[exerciseId];
  if (!exercise) {
    throw new Error(`Unknown exercise: ${exerciseId}`);
  }
  return exercise;
}

function leadSpec(targetId: string, ctx: StepContext): LadderSlotSpec | undefined {
  const family = familyOf(targetId, ctx);
  if (!family) {
    return undefined;
  }
  const exercise = requireExercise(targetId);
  return { id: "lead", label: exercise.name, family, pattern: exercise.pattern };
}

/** The ladders a block trains, with the goal's ladder (if any) first. */
function recipeFor(input: BlockInput): { specs: LadderSlotSpec[]; lead?: LadderSlotSpec; area: AreaKind } {
  const { kind, target, context } = input;
  if (kind === "skill" && !target) {
    throw new Error("A skill day needs a named move");
  }
  const area = kind === "skill" ? areaKindOfTarget(target!, context) : kind;
  const lead = target ? leadSpec(target, context) : undefined;
  const base = AREA_RECIPES[area].filter((spec) => spec.family !== lead?.family);
  const specs = lead ? [lead, ...base] : [...base];
  return { specs: specs.slice(0, MAX_SLOTS), lead, area };
}

/** The ladder the athlete is weakest on (lowest tier); ties keep recipe order. */
function weakestSpec(specs: readonly LadderSlotSpec[], ctx: StepContext): LadderSlotSpec | undefined {
  return specs.reduce<LadderSlotSpec | undefined>(
    (weakest, spec) =>
      weakest === undefined || tierIndex(familyTier(spec.family, ctx)) < tierIndex(familyTier(weakest.family, ctx))
        ? spec
        : weakest,
    undefined,
  );
}

function pickFor(
  spec: LadderSlotSpec,
  emphasis: BlockEmphasis,
  ctx: StepContext,
  inBlock: ReadonlySet<string>,
  inDay: ReadonlySet<string>,
): LadderMember | undefined {
  const working = workingStep(spec.family, ctx, inDay);
  if (!working) {
    return undefined;
  }
  if (emphasis === "easier") {
    // One rung down; at the bottom of the ladder, a sibling move at the same level.
    return easierStep(spec.family, working, ctx, inDay) ?? workingStep(spec.family, ctx, new Set([...inDay, working.exercise.id]));
  }
  if (emphasis === "focus") {
    return workingStep(spec.family, ctx, new Set([...inDay, ...inBlock]));
  }
  return working;
}

type Lead = "skill" | "area";

/** Sets as in the seed days: a skill day's first slot 5, an area day's first slot 4, the rest 3. */
const LEAD_SETS: Record<Lead, number> = { skill: 5, area: 4 };
const OTHER_SETS = 3;

/**
 * Reps are the planner's own tier-standard reps for this athlete and move
 * (`applySkillDose`, target RIR 2 like every seed slot), so the stored day
 * is what the session will prescribe. Nothing here sets a training load.
 */
function doseFor(exercise: SeedExercise, ctx: StepContext, lead: Lead | undefined): TemplateSlot["dose"] {
  const sets = lead ? LEAD_SETS[lead] : OTHER_SETS;
  const memory = ctx.memories[exercise.id] ?? emptyMemory(exercise.id);
  return applySkillDose({ sets, reps: 8, targetRir: 2, addedLoadKg: 0 }, exercise, memory).dose;
}

/** One light care move for a joint with history, from its prehab list; none if nothing fits. */
function careSlot(area: AreaKind, ctx: StepContext, dayId: string, used: ReadonlySet<string>): TemplateSlot | undefined {
  for (const entry of ctx.jointHistory.filter((item) => CARE_JOINTS[area].includes(item.joint))) {
    const move = prehabFor([entry], LIBRARY_CATALOGUE, ctx.equipment).find(
      (item) => !ctx.excluded.includes(item.id) && !used.has(item.id),
    );
    if (move) {
      const hold = resolveExerciseTiming(move).effort === "hold";
      return {
        id: `${dayId}_care`,
        label: `${JOINT_LABEL[entry.joint]} care`,
        exerciseId: move.id,
        pattern: move.pattern,
        dose: { sets: 2, reps: hold ? 30 : 10, targetRir: 3, addedLoadKg: 0 },
        restSeconds: resolveExerciseTiming(move).defaultRestSeconds,
        pinned: false,
      };
    }
  }
  return undefined;
}

/** The ladders of one day in order: the goal's ladder first, or on day C the weakest. */
function orderedSpecs(input: BlockInput, emphasis: BlockEmphasis): { ordered: LadderSlotSpec[]; area: AreaKind } {
  const { specs, lead, area } = recipeFor(input);
  const first = lead ?? (emphasis === "focus" ? weakestSpec(specs, input.context) : undefined);
  return { ordered: first ? [first, ...specs.filter((spec) => spec !== first)] : specs, area };
}

/** One move per ladder, never the same move twice in a day; ladders with nothing usable are left out. */
function pickMoves(
  ordered: readonly LadderSlotSpec[],
  emphasis: BlockEmphasis,
  ctx: StepContext,
  inBlock: ReadonlySet<string>,
): SlotPick[] {
  const inDay = new Set<string>();
  const picks: SlotPick[] = [];
  for (const spec of ordered) {
    const member = pickFor(spec, emphasis, ctx, inBlock, inDay);
    if (member) {
      inDay.add(member.exercise.id);
      picks.push({ spec, member });
    }
  }
  return picks;
}

function toSlots(picks: readonly SlotPick[], dayId: string, lead: Lead, ctx: StepContext): TemplateSlot[] {
  return picks.map(({ spec, member }, position) => ({
    id: `${dayId}_${spec.id}`,
    label: spec.label,
    exerciseId: member.exercise.id,
    pattern: member.exercise.pattern,
    dose: doseFor(member.exercise, ctx, position === 0 ? lead : undefined),
    restSeconds: resolveExerciseTiming(member.exercise).defaultRestSeconds,
    pinned: false,
  }));
}

function buildDay(input: BlockInput, index: number, base: string, inBlock: Set<string>): SessionTemplate {
  const letter = LETTERS[index]!;
  const emphasis = EMPHASIS_BY_LETTER[letter];
  const isSkill = input.kind === "skill";
  const { ordered, area } = orderedSpecs(input, emphasis);
  const dayId = `${GENERATED_DAY_PREFIX}${base}${letter.toLowerCase()}`;

  const picks = pickMoves(ordered, emphasis, input.context, inBlock);
  if (picks.length === 0) {
    throw new Error(`No usable exercises for ${DAY_KIND_LABELS[input.kind]} with your equipment, joints and exclusions`);
  }
  const slots = toSlots(picks, dayId, isSkill ? "skill" : "area", input.context);
  const used = new Set(picks.map(({ member }) => member.exercise.id));
  const care = careSlot(area, input.context, dayId, used);
  used.forEach((id) => inBlock.add(id));

  const seed = seedFor(area, isSkill ? input.target : undefined, input.context);
  const title = isSkill ? skillTitle(input.target) : DAY_KIND_LABELS[input.kind];
  return {
    id: dayId,
    name: `${title} · ${letter}`,
    focus: focusOfKind(input.kind),
    kind: input.kind,
    block: { id: `blk_${base}`, letter, emphasis },
    targetExerciseIds: input.target ? [input.target] : [...seed.targetExerciseIds],
    warmupStationIds: [...seed.warmupStationIds],
    cooldownStationIds: [...seed.cooldownStationIds],
    slots: care ? [...slots, care] : slots,
    repeat: false,
    targetMinutes: seed.targetMinutes,
  };
}

/**
 * A block of 1 to 3 days for one area (or one named skill). Every day trains
 * the area's ladders; they differ only in which move is chosen: A the
 * athlete's working step, B one step easier, C the goal's ladder (or the
 * weakest) first using different moves from A and B where the ladder has
 * them. Doses come from the library and the seed days, nothing here sets a
 * training load. Pure: the caller decides what to save and where to queue.
 */
export function generateBlock(input: BlockInput): SessionTemplate[] {
  const count = input.count ?? LETTERS.length;
  if (!Number.isInteger(count) || count < 1 || count > LETTERS.length) {
    throw new Error(`A block has 1 to ${LETTERS.length} days; got ${count}`);
  }
  if (input.target) {
    requireExercise(input.target);
  }
  const base = (input.newId ?? defaultId)();
  const inBlock = new Set<string>();
  return Array.from({ length: count }, (_, index) => buildDay(input, index, base, inBlock));
}
