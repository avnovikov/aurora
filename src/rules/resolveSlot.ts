import type {
  Dose,
  Exercise,
  ResolveInput,
  ResolveResult,
  RuleId,
  WeakLink,
} from "../domain/types";
import { applyLightDayDose, isLightDay } from "./lightDay";

function painSwap(
  exercise: Exercise,
  painJoints: string[],
  graph: Record<string, Exercise>,
): Exercise | null {
  if (painJoints.length === 0) {
    return null;
  }
  const hitsPain = exercise.joints.some((j) => painJoints.includes(j));
  if (!hitsPain) {
    return null;
  }
  const alternative = Object.values(graph).find(
    (candidate) =>
      candidate.id !== exercise.id &&
      candidate.pattern === exercise.pattern &&
      !candidate.joints.some((j) => painJoints.includes(j)),
  );
  return alternative ?? null;
}

function pickWeakLink(
  exerciseId: string,
  weakLinks: WeakLink[],
  lastFailRegion: ResolveInput["lastFailRegion"],
): WeakLink | undefined {
  const forExercise = weakLinks.filter((w) => w.exerciseId === exerciseId);
  if (forExercise.length === 0) {
    return undefined;
  }
  if (lastFailRegion) {
    const match = forExercise.find((w) => w.region === lastFailRegion);
    if (match) {
      return match;
    }
  }
  return forExercise.find((w) => w.region === "");
}

function result(
  exerciseId: string,
  dose: Dose,
  ruleIds: RuleId[],
  reason: string,
  insertedWeakLinkExerciseId?: string,
): ResolveResult {
  return { exerciseId, dose, ruleIds, reason, insertedWeakLinkExerciseId };
}

function tryAdvance(
  exercise: Exercise,
  dose: Dose,
  memory: ResolveInput["memory"],
  graph: Record<string, Exercise>,
  ruleIds: RuleId[],
): ResolveResult | null {
  if (memory.sessionsAtStandard < 2 || !exercise.harderId) {
    return null;
  }
  const harder = graph[exercise.harderId];
  if (!harder) {
    return null;
  }
  return result(
    harder.id,
    { ...dose, reps: Math.min(dose.reps, 3) },
    [...ruleIds, "advance"],
    `Advanced to ${harder.name} after two sessions at standard`,
  );
}

function tryStall(
  exercise: Exercise,
  dose: Dose,
  input: ResolveInput,
  ruleIds: RuleId[],
): ResolveResult | null {
  if (input.memory.sessionsBelowFloor < 2) {
    return null;
  }
  const weak = pickWeakLink(
    exercise.id,
    input.weakLinks,
    input.lastFailRegion,
  );
  if (weak && input.memory.weakLinkSessionsRemaining <= 0) {
    return result(
      exercise.id,
      { ...dose, sets: Math.max(1, dose.sets - 1) },
      [...ruleIds, "stall_weak_link"],
      "Stall; insert weak-link accessory",
      weak.componentExerciseId,
    );
  }
  if (!exercise.easierId) {
    return null;
  }
  const easier = input.graph[exercise.easierId];
  if (!easier) {
    return null;
  }
  return result(
    easier.id,
    dose,
    [...ruleIds, "stall_regress"],
    `Regressed to ${easier.name} after stall`,
  );
}

/**
 * Resolves one slot: pain → pin → light day → advance → stall → hold.
 * Pure; no DOM or Bluetooth.
 */
export function resolveSlot(input: ResolveInput): ResolveResult {
  const ruleIds: RuleId[] = [];
  const exercise = input.exercise;
  let dose: Dose = { ...input.dose };

  const swap = painSwap(exercise, input.readiness.painJoints, input.graph);
  if (swap) {
    return result(swap.id, dose, ["pain"], `Pain on loaded joint; swapped to ${swap.name}`);
  }

  if (input.pinned) {
    ruleIds.push("pin");
  }

  const light = isLightDay(input.readiness);
  if (light) {
    ruleIds.push("light_day");
    dose = applyLightDayDose(dose);
  }

  if (input.pinned) {
    return result(
      exercise.id,
      dose,
      ruleIds,
      light ? "Pinned exercise; light-day dose only" : "Pinned exercise; dose unchanged",
    );
  }

  if (!light) {
    const advanced = tryAdvance(exercise, dose, input.memory, input.graph, ruleIds);
    if (advanced) {
      return advanced;
    }
    const stalled = tryStall(exercise, dose, input, ruleIds);
    if (stalled) {
      return stalled;
    }
  }

  return result(
    exercise.id,
    dose,
    [...ruleIds, "hold"],
    light ? "Hold exercise with light-day dose" : "Hold prescription",
  );
}
