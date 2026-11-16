import { requireExercise } from "../data/exerciseGraph";
import { LIBRARY_CATALOGUE } from "../data/libraryCatalogue";
import { SESSION_TEMPLATES, TEMPLATE_BY_ID, type SeedExercise } from "../data/seed";
import type { BlockEmphasis, JointHistoryEntry, SessionTemplate, TemplateSlot } from "../domain/program";
import { tierIndex } from "../domain/skillTier";
import { resolveExerciseTiming } from "../domain/timing";
import { estimateSessionDuration } from "../rules/sessionDuration";
import { applySkillDose } from "../rules/skillDose";
import { areaOf } from "../library/facets";
import { prehabFor } from "../safety/prehab";
import { JOINT_LABEL } from "../settings/jointHistory";
import { blockDayName, DAY_KIND_LABELS, focusOfKind, storedSkillTitle, type AreaKind } from "./dayKinds";
import {
  easierStep,
  familyOf,
  familyTier,
  workingStep,
  type LadderMember,
  type StepContext,
} from "./ladderSteps";
import { careSlotFor } from "./jointCareDay";
import { memoryAtLevel } from "./levelDeclare";
import { GENERATED_DAY_PREFIX, newDayId } from "./planDays";
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
  const seed = sameLadder ?? TEMPLATE_BY_ID[SEED_BY_AREA[area]];
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

/** Moves already taken: in this day (never repeat) and in the block's earlier days (day C avoids them). */
interface Used {
  day: ReadonlySet<string>;
  block: ReadonlySet<string>;
}

function pickFor(spec: LadderSlotSpec, emphasis: BlockEmphasis, ctx: StepContext, used: Used): LadderMember | undefined {
  const working = workingStep(spec.family, ctx, used.day);
  if (!working) {
    return undefined;
  }
  if (emphasis === "easier") {
    // One rung down; at the bottom of the ladder, a sibling move at the same level.
    return (
      easierStep(spec.family, working, ctx, used.day) ??
      workingStep(spec.family, ctx, new Set([...used.day, working.exercise.id]))
    );
  }
  if (emphasis === "focus") {
    return workingStep(spec.family, ctx, new Set([...used.day, ...used.block]));
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
  // With a plan level set, dose as the planner will once that level is declared on the move.
  const memory = memoryAtLevel(ctx.memories[exercise.id], exercise, ctx.level);
  return applySkillDose({ sets, reps: 8, targetRir: 2, addedLoadKg: 0 }, exercise, memory).dose;
}

/** One light care move for a joint with history, from its prehab list; none if nothing fits. */
function careSlot(area: AreaKind, ctx: StepContext, dayId: string, used: ReadonlySet<string>): TemplateSlot | undefined {
  for (const entry of ctx.jointHistory.filter((item) => CARE_JOINTS[area].includes(item.joint))) {
    const move = prehabFor([entry], LIBRARY_CATALOGUE, ctx.equipment).find(
      (item) => !ctx.excluded.includes(item.id) && !used.has(item.id),
    );
    if (move) {
      return careSlotFor(move, `${dayId}_care`, `${JOINT_LABEL[entry.joint]} care`);
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
    const member = pickFor(spec, emphasis, ctx, { day: inDay, block: inBlock });
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

/** The fewest sets a trimmed later slot keeps: the seed Full body day ends on a 2-set slot. */
const TRIMMED_SETS = 2;
/** The fewest sets the first slot keeps: the seed Full body day leads with 3. */
const TRIMMED_LEAD_SETS = 3;

function withSets(day: SessionTemplate, index: number, sets: number): SessionTemplate {
  return {
    ...day,
    slots: day.slots.map((slot, i) => (i === index ? { ...slot, dose: { ...slot.dose, sets } } : slot)),
  };
}

/**
 * Keeps a day inside its time band. Higher tiers mean more reps and longer
 * sessions, so when a day runs over, the later slots drop to two sets, last
 * slot first, and then the first slot to three, until it fits. Pinned care
 * moves are never trimmed.
 */
function fitToBand(day: SessionTemplate): SessionTemplate {
  const maxSeconds = (day.targetMinutes?.maxMinutes ?? Number.POSITIVE_INFINITY) * 60;
  const over = (candidate: SessionTemplate): boolean => estimateSessionDuration(candidate).totalSeconds > maxSeconds;
  let fitted = day;
  for (let index = day.slots.length - 1; index >= 0 && over(fitted); index -= 1) {
    const slot = fitted.slots[index]!;
    const floor = index === 0 ? TRIMMED_LEAD_SETS : TRIMMED_SETS;
    if (!slot.pinned && slot.dose.sets > floor) {
      fitted = withSets(fitted, index, floor);
    }
  }
  return fitted;
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
  const title = isSkill ? storedSkillTitle(input.target) : DAY_KIND_LABELS[input.kind];
  return fitToBand({
    id: dayId,
    name: blockDayName(title, letter),
    focus: focusOfKind(input.kind),
    kind: input.kind,
    block: { id: `blk_${base}`, letter, emphasis },
    targetExerciseIds: input.target ? [input.target] : [...seed.targetExerciseIds],
    // Per-level lists; the level is picked from the athlete's tier in the day's target family.
    warmupByLevel: seed.warmupByLevel,
    warmupHoldSeconds: seed.warmupHoldSeconds,
    cooldownStationIds: [...seed.cooldownStationIds],
    slots: care ? [...slots, care] : slots,
    repeat: false,
    targetMinutes: seed.targetMinutes,
  });
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
  const base = (input.newId ?? newDayId)();
  const inBlock = new Set<string>();
  return Array.from({ length: count }, (_, index) => buildDay(input, index, base, inBlock));
}
