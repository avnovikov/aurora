import { SEED_GRAPH } from "../data/seed";
import { resolveExerciseTiming } from "../domain/timing";
import type {
  SessionDurationTarget,
  SessionTemplate,
  TemplateSlot,
} from "../domain/program";
import type { Dose, Exercise } from "../domain/types";
import { WARMUP_GAPS } from "./warmupPlan";

/** Default continuous warmup budget (~10 min of 12s stations). */
export const DEFAULT_WARMUP_SECONDS = 600;

export const DEFAULT_SESSION_TARGET: SessionDurationTarget = {
  minMinutes: 30,
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

export function estimateSetWorkSeconds(
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
  warmupSeconds: number = DEFAULT_WARMUP_SECONDS,
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

/** Warmup chalk copy stays honest about the station budget. */
export function warmupMinutesLabel(
  warmupSeconds: number = DEFAULT_WARMUP_SECONDS,
): string {
  const minutes = Math.round(warmupSeconds / 60);
  return `Warmup · ${minutes} min`;
}

export { WARMUP_GAPS };

function requireExercise(exerciseId: string): Exercise {
  const exercise = SEED_GRAPH[exerciseId];
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
