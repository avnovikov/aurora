import type {
  Dose,
  Exercise,
  ResolveInput,
  ResolveResult,
  RuleId,
  WeakLink,
} from "../domain/types";
import { applyLightDayDose, isLightDay } from "./lightDay";
import {
  applySkillDose,
  shouldAdvanceProgression,
} from "./skillDose";

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
  if (!shouldAdvanceProgression(exercise, memory)) {
    return null;
  }
  const harder = exercise.harderId ? graph[exercise.harderId] : undefined;
  if (!harder) {
    return null;
  }
  const starter = applySkillDose(
    { ...dose, reps: Math.min(dose.reps, 3) },
    harder,
    {
      ...memory,
      exerciseId: harder.id,
      sessionsAtStandard: 0,
      bestReps: undefined,
    },
  );
  return result(
    harder.id,
    starter.dose,
    [...ruleIds, "advance"],
    `Advanced to ${harder.name} (skill / standard met)`,
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

function applyReadinessDose(
  dose: Dose,
  readiness: ResolveInput["readiness"],
  ruleIds: RuleId[],
): { dose: Dose; light: boolean } {
  const light = isLightDay(readiness);
  if (!light) {
    return { dose, light: false };
  }
  ruleIds.push("light_day");
  return { dose: applyLightDayDose(dose), light: true };
}

function applyUnpinnedResolution(
  input: ResolveInput,
  dose: Dose,
  ruleIds: RuleId[],
  light: boolean,
): ResolveResult {
  const skilled = applySkillDose(dose, input.exercise, input.memory);
  const nextDose = skilled.dose;
  if (skilled.applied) {
    ruleIds.push("skill_dose");
  }
  if (!light) {
    const advanced = tryAdvance(
      input.exercise,
      nextDose,
      input.memory,
      input.graph,
      ruleIds,
    );
    if (advanced) {
      return advanced;
    }
    const stalled = tryStall(input.exercise, nextDose, input, ruleIds);
    if (stalled) {
      return stalled;
    }
  }
  const tierNote = skilled.applied ? ` · ${skilled.tier} dose` : "";
  return result(
    input.exercise.id,
    nextDose,
    [...ruleIds, "hold"],
    light
      ? "Hold exercise with light-day dose"
      : `Hold prescription${tierNote}`,
  );
}

/**
 * Resolves one slot: pain → pin → light day → skill dose → advance → stall → hold.
 * Pure; no DOM or Bluetooth.
 */
export function resolveSlot(input: ResolveInput): ResolveResult {
  const ruleIds: RuleId[] = [];
  const doseStart: Dose = { ...input.dose };

  const swap = painSwap(input.exercise, input.readiness.painJoints, input.graph);
  if (swap) {
    return result(
      swap.id,
      doseStart,
      ["pain"],
      `Pain on loaded joint; swapped to ${swap.name}`,
    );
  }

  if (input.pinned) {
    ruleIds.push("pin");
  }

  const readiness = applyReadinessDose(doseStart, input.readiness, ruleIds);
  if (input.pinned) {
    return result(
      input.exercise.id,
      readiness.dose,
      ruleIds,
      readiness.light
        ? "Pinned exercise; light-day dose only"
        : "Pinned exercise; dose unchanged",
    );
  }

  return applyUnpinnedResolution(
    input,
    readiness.dose,
    ruleIds,
    readiness.light,
  );
}
