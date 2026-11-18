import { EXERCISE_GRAPH } from "../data/exerciseGraph";
import { resolveExerciseTiming } from "../domain/timing";
import type { Dose, Exercise } from "../domain/types";
import { holdRepeats, pyramidSetSeconds } from "./doseCaps";
import type { PlannedSession, PlannedWorkItem } from "./planSession";
import {
  SIDE_SWITCH_SECONDS,
  sideSwitchAt,
  warmupTransitionSeconds,
  warmupViewSeconds,
  type WarmupStep,
} from "./warmupPlan";

/**
 * Where the athlete is in the live session, for a progress-based "Left" clock.
 * Cool-down is not part of the planned total, so its surfaces return 0.
 */
export interface SessionProgress {
  surface: "warmup" | "work" | "cooldown" | "done";
  phase: "warmup" | "work" | "rest" | "cooldown" | "done";
  warmupIndex: number;
  workIndex: number;
  /** 1-based current (or next, when resting) set. */
  setIndex: number;
  restLeft: number;
  holdLeft: number;
  sideSwitchLeft: number;
}

/**
 * Theoretical seconds still ahead from current progress (not plan − wall elapsed).
 * Projected finish ≈ elapsed + this value.
 */
export function estimateRemainingSessionSeconds(
  planned: PlannedSession,
  progress: SessionProgress,
): number {
  assertProgress(progress);
  if (progress.surface === "done" || progress.surface === "cooldown") {
    return 0;
  }
  if (progress.surface === "warmup") {
    return remainingWarmupSeconds(planned, progress) + estimateWorkFromIndex(planned.work, 0, 1);
  }
  return remainingWorkSeconds(planned, progress);
}

/** Full work block (all sets + intra-slot rests) for a planned session. */
export function estimatePlannedWorkSeconds(work: PlannedSession["work"]): number {
  return estimateWorkFromIndex(work, 0, 1);
}

function transitionAfterWarmup(planned: PlannedSession): number {
  return planned.work.length === 0 ? 0 : warmupTransitionSeconds(planned.warmup);
}

function remainingWarmupSeconds(
  planned: PlannedSession,
  progress: SessionProgress,
): number {
  const steps = planned.warmup;
  const transition = transitionAfterWarmup(planned);
  if (progress.warmupIndex >= steps.length) {
    return transition;
  }
  const afterCurrent = warmupViewSeconds(steps.slice(progress.warmupIndex + 1));
  const currentRemaining =
    progress.phase === "rest"
      ? progress.restLeft
      : remainingCurrentStationSeconds(steps[progress.warmupIndex]!, progress);
  return currentRemaining + afterCurrent + transition;
}

function remainingCurrentStationSeconds(
  step: Pick<WarmupStep, "holdSeconds" | "gapSecondsAfter" | "perSide">,
  progress: SessionProgress,
): number {
  const switchAt = sideSwitchAt(step);
  const upcomingSwitch =
    switchAt !== null && progress.holdLeft > switchAt ? SIDE_SWITCH_SECONDS : 0;
  return (
    progress.holdLeft +
    progress.sideSwitchLeft +
    upcomingSwitch +
    step.gapSecondsAfter
  );
}

function remainingWorkSeconds(
  planned: PlannedSession,
  progress: SessionProgress,
): number {
  const restLeft = progress.phase === "rest" ? progress.restLeft : 0;
  return (
    restLeft +
    estimateWorkFromIndex(planned.work, progress.workIndex, progress.setIndex)
  );
}

/** Work + intra-slot rests from a 1-based set on `fromWorkIndex` through the end. */
function estimateWorkFromIndex(
  work: readonly PlannedWorkItem[],
  fromWorkIndex: number,
  fromSetIndex: number,
): number {
  if (fromWorkIndex < 0 || fromWorkIndex >= work.length) {
    return 0;
  }
  return work.slice(fromWorkIndex).reduce((total, item, offset) => {
    const setIndex = offset === 0 ? fromSetIndex : 1;
    return total + estimateRemainingSlotSeconds(item, setIndex);
  }, 0);
}

function estimateRemainingSlotSeconds(
  item: PlannedWorkItem,
  fromSetIndex: number,
): number {
  assertPositiveSetIndex(fromSetIndex);
  const exercise = EXERCISE_GRAPH[item.exerciseId];
  if (!exercise) {
    return 0;
  }
  const setsLeft = item.dose.sets - fromSetIndex + 1;
  if (setsLeft <= 0) {
    return 0;
  }
  const effort = estimateSetWorkFrom(item.dose, exercise, fromSetIndex);
  return effort + (setsLeft - 1) * item.restSeconds;
}

/** Working seconds for sets from `fromSetIndex` (1-based) through the dose. */
export function estimateSetWorkFrom(
  dose: Dose,
  exercise: Exercise,
  fromSetIndex: number = 1,
): number {
  assertDose(dose);
  assertPositiveSetIndex(fromSetIndex);
  const repeats = holdRepeats(exercise, dose.sets, dose.reps);
  if (repeats) {
    return repeats
      .slice(fromSetIndex - 1)
      .reduce((sum, count) => sum + pyramidSetSeconds(count, dose.reps), 0);
  }
  const setsLeft = dose.sets - fromSetIndex + 1;
  return Math.max(0, setsLeft) * setEffortSeconds(dose, exercise);
}

function setEffortSeconds(dose: Dose, exercise: Exercise): number {
  const timing = resolveExerciseTiming(exercise);
  return timing.effort === "hold" ? dose.reps : dose.reps * timing.secondsPerRep;
}

function assertDose(dose: Dose): void {
  if (!Number.isInteger(dose.sets) || dose.sets < 1) {
    throw new Error(`dose.sets must be a positive integer; got ${dose.sets}`);
  }
  if (!Number.isFinite(dose.reps) || dose.reps <= 0) {
    throw new Error(`dose.reps must be positive; got ${dose.reps}`);
  }
}

function assertPositiveSetIndex(setIndex: number): void {
  if (!Number.isInteger(setIndex) || setIndex < 1) {
    throw new Error(`setIndex must be a positive integer; got ${setIndex}`);
  }
}

function assertProgress(progress: SessionProgress): void {
  assertNonNegativeInteger(progress.warmupIndex, "warmupIndex");
  assertNonNegativeInteger(progress.workIndex, "workIndex");
  assertNonNegativeNumber(progress.restLeft, "restLeft");
  assertNonNegativeNumber(progress.holdLeft, "holdLeft");
  assertNonNegativeNumber(progress.sideSwitchLeft, "sideSwitchLeft");
  assertPositiveSetIndex(progress.setIndex);
}

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer; got ${value}`);
  }
}

function assertNonNegativeNumber(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative number; got ${value}`);
  }
}
