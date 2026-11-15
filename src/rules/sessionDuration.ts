import { EXERCISE_GRAPH } from "../data/exerciseGraph";
import { requireWarmupStation } from "../data/warmupStations";
import { resolveExerciseTiming } from "../domain/timing";
import type {
  SessionDurationTarget,
  SessionTemplate,
  TemplateSlot,
} from "../domain/program";
import type { Dose, Exercise } from "../domain/types";
import type { PlannedSession } from "./planSession";
import {
  buildWarmupView,
  warmupViewSeconds,
  WARMUP_GAPS,
} from "./warmupPlan";

/** Fallback when a template has no warmup stations listed. */
export const DEFAULT_WARMUP_SECONDS = 60;

export const DEFAULT_SESSION_TARGET: SessionDurationTarget = {
  minMinutes: 25,
  maxMinutes: 45,
};

export interface SessionDurationEstimate {
  warmupSeconds: number;
  workSeconds: number;
  totalSeconds: number;
  totalMinutesRounded: number;
  withinTarget: boolean;
  target: SessionDurationTarget;
}

function estimateSetWorkSeconds(
  dose: Dose,
  exercise: Exercise,
): number {
  assertDose(dose);
  const timing = resolveExerciseTiming(exercise);
  const unitSeconds =
    timing.effort === "hold" ? dose.reps : dose.reps * timing.secondsPerRep;
  return dose.sets * unitSeconds;
}

export function estimateSlotSeconds(
  slot: TemplateSlot,
  exercise: Exercise = requireExercise(slot.exerciseId),
): number {
  const work = estimateSetWorkSeconds(slot.dose, exercise);
  const restGaps = Math.max(0, slot.dose.sets - 1) * slot.restSeconds;
  return work + restGaps;
}

export function estimateSessionDuration(
  template: SessionTemplate,
  warmupSeconds: number = estimateTemplateWarmupSeconds(template),
): SessionDurationEstimate {
  assertWarmupSeconds(warmupSeconds);
  const target = template.targetMinutes ?? DEFAULT_SESSION_TARGET;
  assertTarget(target);

  const workSeconds = template.slots.reduce(
    (sum, slot) => sum + estimateSlotSeconds(slot),
    0,
  );
  const totalSeconds = warmupSeconds + workSeconds;
  const totalMinutesRounded = Math.round(totalSeconds / 60);
  const withinTarget =
    totalMinutesRounded >= target.minMinutes &&
    totalMinutesRounded <= target.maxMinutes;

  return {
    warmupSeconds,
    workSeconds,
    totalSeconds,
    totalMinutesRounded,
    withinTarget,
    target,
  };
}

export function formatDurationLabel(estimate: SessionDurationEstimate): string {
  const band = `${estimate.target.minMinutes}–${estimate.target.maxMinutes} min`;
  if (estimate.withinTarget) {
    return `≈ ${estimate.totalMinutesRounded} min`;
  }
  return `≈ ${estimate.totalMinutesRounded} min (target ${band})`;
}

/**
 * Wall-clock estimate for today's resolved plan (warmup stations + work + rests).
 */
export function estimatePlannedSessionSeconds(planned: PlannedSession): number {
  const warmupSeconds = warmupViewSeconds(planned.warmup);
  const workSeconds = planned.work.reduce((sum, item) => {
    const exercise = EXERCISE_GRAPH[item.exerciseId];
    if (!exercise) {
      return sum;
    }
    const effort = estimateSetWorkSeconds(item.dose, exercise);
    const rests = Math.max(0, item.dose.sets - 1) * item.restSeconds;
    return sum + effort + rests;
  }, 0);
  return warmupSeconds + workSeconds;
}

/** Warmup chalk copy from the prebuilt sequence length. */
export function warmupMinutesLabel(warmupSeconds: number): string {
  assertWarmupSeconds(warmupSeconds);
  if (warmupSeconds < 60) {
    return `Warmup · ${Math.round(warmupSeconds)}s`;
  }
  const minutes = Math.round(warmupSeconds / 60);
  return `Warmup · ${minutes} min`;
}

function estimateTemplateWarmupSeconds(template: SessionTemplate): number {
  if (template.warmupStationIds.length === 0) {
    return DEFAULT_WARMUP_SECONDS;
  }
  const stations = template.warmupStationIds.map((id) => requireWarmupStation(id));
  return warmupViewSeconds(buildWarmupView(stations));
}

export { WARMUP_GAPS };

function requireExercise(exerciseId: string): Exercise {
  const exercise = EXERCISE_GRAPH[exerciseId];
  if (!exercise) {
    throw new Error(`Unknown exercise for duration estimate: ${exerciseId}`);
  }
  return exercise;
}

function assertDose(dose: Dose): void {
  if (!Number.isInteger(dose.sets) || dose.sets < 1) {
    throw new Error(`dose.sets must be a positive integer; got ${dose.sets}`);
  }
  if (!Number.isFinite(dose.reps) || dose.reps <= 0) {
    throw new Error(`dose.reps must be positive; got ${dose.reps}`);
  }
}

function assertWarmupSeconds(warmupSeconds: number): void {
  if (!Number.isFinite(warmupSeconds) || warmupSeconds < 0) {
    throw new Error(
      `warmupSeconds must be non-negative; got ${warmupSeconds}`,
    );
  }
}

function assertTarget(target: SessionDurationTarget): void {
  if (target.minMinutes < 1 || target.maxMinutes < target.minMinutes) {
    throw new Error(
      `Invalid duration target: ${target.minMinutes}–${target.maxMinutes}`,
    );
  }
}
