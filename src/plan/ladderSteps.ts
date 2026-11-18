import { EXERCISE_GRAPH, isPlannable, sourceRank } from "../data/exerciseGraph";
import type { SeedExercise } from "../data/seed";
import type { EquipmentId, JointHistoryEntry } from "../domain/program";
import { tierIndex } from "../domain/skillTier";
import type { ExerciseMemory, SkillTier } from "../domain/types";
import { libraryFamilyLadderIndex, type FamilyLadderIndex } from "../progress/familyLadderIndex";
import { areaOf, primaryBuckets } from "../library/facets";
import { effectiveSkillTier } from "../rules/skillDose";
import { missingGear } from "../safety/gear";
import { assessExercise } from "../safety/jointCare";
import { FAMILY_AREA } from "./recipes";

/** Everything that decides which ladder members this athlete can be given. */
export interface StepContext {
  memories: Readonly<Record<string, ExerciseMemory>>;
  equipment?: readonly EquipmentId[];
  jointHistory: readonly JointHistoryEntry[];
  excluded: readonly string[];
  /**
   * The plan's level, when the athlete set one: every ladder starts at this
   * tier, and the level is declared on the chosen moves (as in the Library)
   * so the planner doses them at it. Unset, each ladder's level comes from
   * results.
   */
  level?: SkillTier;
  /** Injected in tests; defaults to the Library ladder index. */
  index?: FamilyLadderIndex;
}

export interface LadderMember {
  exercise: SeedExercise;
  rank: number;
}

const DEFAULT_TIER: SkillTier = "beginner";

/**
 * The name matcher sometimes puts an off-area move on a ladder (an abs move on
 * the pull ladder). Core ladders accept any move with the core as a primary
 * muscle: planks and rollouts also load the shoulders, which would otherwise
 * file them under upper body.
 */
function inFamilyArea(familyId: string, exercise: SeedExercise): boolean {
  const wanted = FAMILY_AREA[familyId];
  const area = areaOf(exercise);
  if (!wanted || area === undefined || area === "full" || area === wanted) {
    return true;
  }
  return wanted === "core" && primaryBuckets(exercise).includes("core");
}

/** Whether this athlete may be given a move at all: plannable, gear owned, no joint avoid, not excluded. */
export function canBeGiven(
  exercise: SeedExercise,
  ctx: Pick<StepContext, "equipment" | "jointHistory" | "excluded">,
): boolean {
  return (
    isPlannable(exercise) &&
    !ctx.excluded.includes(exercise.id) &&
    missingGear(exercise, ctx.equipment).length === 0 &&
    !assessExercise(exercise.name, ctx.jointHistory).avoid
  );
}

/**
 * Plannable members of a ladder this athlete may be given (gear owned, no
 * joint avoid, not excluded, in the ladder's area), easiest first. Within a
 * rank the Library's own order: source, then name.
 */
export function usableMembers(familyId: string, ctx: StepContext): LadderMember[] {
  const index = ctx.index ?? libraryFamilyLadderIndex();
  const members: LadderMember[] = [];
  for (const entry of index.byFamily.get(familyId) ?? []) {
    const exercise = EXERCISE_GRAPH[entry.id];
    if (exercise !== undefined && inFamilyArea(familyId, exercise) && canBeGiven(exercise, ctx)) {
      members.push({ exercise, rank: entry.rank });
    }
  }
  return members.sort(
    (a, b) =>
      a.rank - b.rank ||
      sourceRank(a.exercise.id) - sourceRank(b.exercise.id) ||
      a.exercise.name.localeCompare(b.exercise.name),
  );
}

/**
 * The athlete's tier on a ladder: the highest effective tier of any member,
 * from stored tier, best reps and declared tier (the Library's family cascade
 * already raises easier members). Beginner with no data.
 */
export function familyTier(familyId: string, ctx: StepContext): SkillTier {
  if (ctx.level) {
    return ctx.level;
  }
  const index = ctx.index ?? libraryFamilyLadderIndex();
  let best: SkillTier = DEFAULT_TIER;
  for (const entry of index.byFamily.get(familyId) ?? []) {
    const exercise = EXERCISE_GRAPH[entry.id];
    const memory = ctx.memories[entry.id];
    if (exercise && memory) {
      const tier = effectiveSkillTier(memory, exercise);
      best = tierIndex(tier) > tierIndex(best) ? tier : best;
    }
  }
  // "novice" is the athlete's floor, not a move level: treat it as beginner.
  return best === "novice" ? DEFAULT_TIER : best;
}

function difficultyIndex(member: LadderMember): number {
  return tierIndex(member.exercise.difficulty ?? DEFAULT_TIER);
}

/**
 * Where to start this athlete on a ladder: the same rule as the Library's
 * "Generate plan" (`pickLevelAppropriateStep`): the first move at their tier,
 * else the move nearest their tier (the easier one on a tie). The planner
 * advances or regresses it from there. `avoid` steers a block's other days
 * to different moves at that level.
 */
export function workingStep(
  familyId: string,
  ctx: StepContext,
  avoid: ReadonlySet<string> = new Set(),
): LadderMember | undefined {
  const members = usableMembers(familyId, ctx);
  if (members.length === 0) {
    return undefined;
  }
  const want = tierIndex(familyTier(familyId, ctx));
  const nearest = Math.min(...members.map((member) => Math.abs(difficultyIndex(member) - want)));
  const pool = members.filter((member) => Math.abs(difficultyIndex(member) - want) === nearest);
  return pool.find((member) => !avoid.has(member.exercise.id)) ?? pool[0];
}

/** The move one rank below `from` on the ladder, if there is one. */
export function easierStep(
  familyId: string,
  from: LadderMember,
  ctx: StepContext,
  avoid: ReadonlySet<string> = new Set(),
): LadderMember | undefined {
  const lower = usableMembers(familyId, ctx).filter((member) => member.rank < from.rank);
  if (lower.length === 0) {
    return undefined;
  }
  const top = Math.max(...lower.map((member) => member.rank));
  const pool = lower.filter((member) => member.rank === top);
  return pool.find((member) => !avoid.has(member.exercise.id)) ?? pool[0];
}

/** The ladder a move sits on, if it sits on one. */
export function familyOf(exerciseId: string, ctx: Pick<StepContext, "index"> = {}): string | undefined {
  return (ctx.index ?? libraryFamilyLadderIndex()).byId.get(exerciseId)?.familyId;
}
