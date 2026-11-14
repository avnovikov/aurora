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

/**
 * Resolves one slot: pain → pin → light day → advance → stall → hold.
 * Pure; no DOM or Bluetooth.
 */
export function resolveSlot(input: ResolveInput): ResolveResult {
  const rules: RuleId[] = [];
  let exercise = input.exercise;
  let dose: Dose = { ...input.dose };

  const swap = painSwap(exercise, input.readiness.painJoints, input.graph);
  if (swap) {
    rules.push("pain");
    return {
      exerciseId: swap.id,
      dose,
      ruleIds: rules,
      reason: `Pain on loaded joint; swapped to ${swap.name}`,
    };
  }

  if (input.pinned) {
    rules.push("pin");
  }

  const light = isLightDay(input.readiness);
  if (light) {
    rules.push("light_day");
    dose = applyLightDayDose(dose);
  }

  if (input.pinned) {
    return {
      exerciseId: exercise.id,
      dose,
      ruleIds: rules,
      reason: light
        ? "Pinned exercise; light-day dose only"
        : "Pinned exercise; dose unchanged",
    };
  }

  if (!light && input.memory.sessionsAtStandard >= 2 && exercise.harderId) {
    const harder = input.graph[exercise.harderId];
    if (harder) {
      rules.push("advance");
      return {
        exerciseId: harder.id,
        dose: { ...dose, reps: Math.min(dose.reps, 3), sets: dose.sets },
        ruleIds: rules,
        reason: `Advanced to ${harder.name} after two sessions at standard`,
      };
    }
  }

  if (!light && input.memory.sessionsBelowFloor >= 2) {
    const weak = pickWeakLink(
      exercise.id,
      input.weakLinks,
      input.lastFailRegion,
    );
    if (weak && input.memory.weakLinkSessionsRemaining <= 0) {
      rules.push("stall_weak_link");
      return {
        exerciseId: exercise.id,
        dose: { ...dose, sets: Math.max(1, dose.sets - 1) },
        ruleIds: rules,
        reason: "Stall; insert weak-link accessory",
        insertedWeakLinkExerciseId: weak.componentExerciseId,
      };
    }
    if (exercise.easierId) {
      const easier = input.graph[exercise.easierId];
      if (easier) {
        rules.push("stall_regress");
        return {
          exerciseId: easier.id,
          dose,
          ruleIds: rules,
          reason: `Regressed to ${easier.name} after stall`,
        };
      }
    }
  }

  rules.push("hold");
  return {
    exerciseId: exercise.id,
    dose,
    ruleIds: rules,
    reason: light ? "Hold exercise with light-day dose" : "Hold prescription",
  };
}
