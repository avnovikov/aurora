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

/** Below-floor sessions in a row before stall regression. */
export const STALL_BELOW_FLOOR_SESSIONS = 2;

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
  if (input.memory.sessionsBelowFloor < STALL_BELOW_FLOOR_SESSIONS) {
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

interface DoseModifiers {
  dose: Dose;
  /** Readiness (sleep, HR, wiped) called for a lighter day. */
  light: boolean;
  /** Manual deload week is active. */
  deload: boolean;
  /** Rule ids contributed by readiness / deload. */
  ruleIds: RuleId[];
}

/** Light-day signals and manual deload share one dose cut; it is applied once. */
function applyReadinessDose(dose: Dose, input: ResolveInput): DoseModifiers {
  const light = isLightDay(input.readiness);
  const deload = input.deloadActive === true;
  const ruleIds: RuleId[] = [];
  if (light) {
    ruleIds.push("light_day");
  }
  if (deload) {
    ruleIds.push("deload");
  }
  if (!light && !deload) {
    return { dose, light, deload, ruleIds };
  }
  return { dose: applyLightDayDose(dose), light, deload, ruleIds };
}

/** Light days and deload weeks hold the exercise: no advance, no stall move. */
function holdsProgression(modifiers: DoseModifiers): boolean {
  return modifiers.light || modifiers.deload;
}

function describeHold(modifiers: DoseModifiers, tierNote: string): string {
  if (modifiers.deload) {
    return "Deload week: hold exercise with light-day dose, no advance";
  }
  if (modifiers.light) {
    return "Hold exercise with light-day dose";
  }
  return `Hold prescription${tierNote}`;
}

function describePinned(modifiers: DoseModifiers): string {
  if (modifiers.deload) {
    return "Pinned exercise; deload dose only";
  }
  if (modifiers.light) {
    return "Pinned exercise; light-day dose only";
  }
  return "Pinned exercise; dose unchanged";
}

function applyUnpinnedResolution(
  input: ResolveInput,
  modifiers: DoseModifiers,
  ruleIds: RuleId[],
): ResolveResult {
  const skilled = applySkillDose(modifiers.dose, input.exercise, input.memory);
  const nextDose = skilled.dose;
  if (skilled.applied) {
    ruleIds.push("skill_dose");
  }
  if (!holdsProgression(modifiers)) {
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
    describeHold(modifiers, tierNote),
  );
}

/**
 * Resolves one slot: pain → pin → light day / deload → skill dose → advance → stall → hold.
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

  const modifiers = applyReadinessDose(doseStart, input);
  ruleIds.push(...modifiers.ruleIds);
  if (input.pinned) {
    return result(
      input.exercise.id,
      modifiers.dose,
      ruleIds,
      describePinned(modifiers),
    );
  }

  return applyUnpinnedResolution(input, modifiers, ruleIds);
}
