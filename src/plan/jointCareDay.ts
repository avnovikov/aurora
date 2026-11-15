import { LIBRARY_CATALOGUE } from "../data/libraryCatalogue";
import { TEMPLATE_BY_ID, type SeedExercise } from "../data/seed";
import type { JointHistoryEntry, SessionTemplate, TemplateSlot } from "../domain/program";
import { resolveExerciseTiming } from "../domain/timing";
import { estimateSessionDuration } from "../rules/sessionDuration";
import { assessExercise } from "../safety/jointCare";
import { prehabFor } from "../safety/prehab";
import { DAY_KIND_LABELS, MOBILITY_TEMPLATE_ID } from "./dayKinds";
import type { StepContext } from "./ladderSteps";
import { GENERATED_DAY_PREFIX, newDayId } from "./planDays";

/** With no joint history: general care for the two joints bodyweight training loads most. */
const GENERAL_CARE: readonly JointHistoryEntry[] = [
  { joint: "shoulder", side: "both", kind: "other" },
  { joint: "hip", side: "both", kind: "other" },
];
const MAX_MOVES = 6;

/**
 * A care slot, dosed like the seed Mobility day: pinned (the planner never
 * advances or regresses it), 2 sets, 10 reps or a 30 second hold, RIR 3,
 * rest from the library timing model.
 */
export function careSlotFor(move: SeedExercise, id: string, label: string): TemplateSlot {
  const timing = resolveExerciseTiming(move);
  return {
    id,
    label,
    exerciseId: move.id,
    pattern: move.pattern,
    dose: { sets: 2, reps: timing.effort === "hold" ? 30 : 10, targetRir: 3, addedLoadKg: 0 },
    restSeconds: timing.defaultRestSeconds,
    pinned: true,
  };
}

function mobilitySeed(): SessionTemplate {
  const seed = TEMPLATE_BY_ID[MOBILITY_TEMPLATE_ID];
  if (!seed) {
    throw new Error(`Missing seed template ${MOBILITY_TEMPLATE_ID}`);
  }
  return seed;
}

/** Usable prehab moves, taking turns between the joints so each one gets care. */
function careMoves(joints: readonly JointHistoryEntry[], ctx: StepContext): SeedExercise[] {
  const perJoint = joints.map((entry) =>
    prehabFor([entry], LIBRARY_CATALOGUE, ctx.equipment)
      .filter((move) => !ctx.excluded.includes(move.id))
      .filter((move) => !assessExercise(move.name, ctx.jointHistory).avoid),
  );
  const longest = Math.max(0, ...perJoint.map((list) => list.length));
  const seen = new Set<string>();
  const moves: SeedExercise[] = [];
  for (let turn = 0; turn < longest; turn += 1) {
    for (const list of perJoint) {
      const move = list[turn];
      if (move && !seen.has(move.id)) {
        seen.add(move.id);
        moves.push(move);
      }
    }
  }
  return moves;
}

export function isGeneralCare(ctx: Pick<StepContext, "jointHistory">): boolean {
  return ctx.jointHistory.length === 0;
}

/**
 * A short, light day from the athlete's prehab list (gear owned, not
 * excluded, no joint avoid), for days they cannot train hard. Uses the seed
 * Mobility day's warm-up and its 10 to 20 minute band: moves are dropped
 * from the end until the session fits.
 */
export function generateJointCareDay(ctx: StepContext, newId: () => string = newDayId): SessionTemplate {
  const general = isGeneralCare(ctx);
  const joints = general ? GENERAL_CARE : ctx.jointHistory;
  const moves = careMoves(joints, ctx).slice(0, MAX_MOVES);
  if (moves.length === 0) {
    throw new Error("No joint care moves fit your equipment and exclusions");
  }
  const seed = mobilitySeed();
  const id = `${GENERATED_DAY_PREFIX}care_${newId()}`;
  const build = (count: number): SessionTemplate => ({
    id,
    name: general ? `${DAY_KIND_LABELS.joint_care} · general` : DAY_KIND_LABELS.joint_care,
    focus: "joint_care",
    kind: "joint_care",
    targetExerciseIds: [],
    warmupStationIds: [...seed.warmupStationIds],
    cooldownStationIds: [...seed.cooldownStationIds],
    slots: moves.slice(0, count).map((move, index) => careSlotFor(move, `${id}_${index}`, "Care")),
    repeat: false,
    targetMinutes: seed.targetMinutes,
  });
  const maxSeconds = (seed.targetMinutes?.maxMinutes ?? 20) * 60;
  let count = moves.length;
  while (count > 1 && estimateSessionDuration(build(count)).totalSeconds > maxSeconds) {
    count -= 1;
  }
  return build(count);
}

