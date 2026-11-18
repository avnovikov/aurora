import { stationsFor } from "../data/warmupStations";
import type {
  SessionDurationTarget,
  SessionTemplate,
  TemplateSlot,
  WarmupLevel,
} from "../domain/program";
import type { Exercise } from "../domain/types";
import { EXERCISE_GRAPH } from "../data/exerciseGraph";
import type { PlannedSession } from "./planSession";
import { estimatePlannedWorkSeconds, estimateSetWorkFrom } from "./sessionRemaining";
import { DEFAULT_WARMUP_LEVEL } from "./warmupLevel";
import {
  buildCooldownView,
  buildWarmupView,
  warmupTransitionSeconds,
  warmupViewSeconds,
  WARMUP_GAPS,
} from "./warmupPlan";

export type { SessionProgress } from "./sessionRemaining";
export { estimateRemainingSessionSeconds } from "./sessionRemaining";

/** Fallback when a template has no warmup stations listed. */
export const DEFAULT_WARMUP_SECONDS = 60;

export const DEFAULT_SESSION_TARGET: SessionDurationTarget = {
  minMinutes: 25,
  maxMinutes: 45,
};

/** Minutes outside the soft band that still omit "(target …)" on the Plan label (#126). */
export const TARGET_LABEL_SLACK_MINUTES = 5;

/**
 * Hard ceiling for warm-up + work (minutes). The template band is a soft
 * target shown in the label; only this cap is enforced. The optional
 * cool-down is not counted.
 */
export const SESSION_HARD_CAP_MINUTES = 60;

export interface SessionDurationEstimate {
  warmupSeconds: number;
  /** Easy "Get ready" rest between the warm-up ramp and the first work set. */
  transitionSeconds: number;
  workSeconds: number;
  totalSeconds: number;
  totalMinutesRounded: number;
  /** Soft: inside the template's displayed band. */
  withinTarget: boolean;
  /** Hard: at or under `SESSION_HARD_CAP_MINUTES`. */
  withinHardCap: boolean;
  target: SessionDurationTarget;
}

export function estimateSlotSeconds(
  slot: TemplateSlot,
  exercise: Exercise = requireExercise(slot.exerciseId),
): number {
  const work = estimateSetWorkFrom(slot.dose, exercise);
  const restGaps = Math.max(0, slot.dose.sets - 1) * slot.restSeconds;
  return work + restGaps;
}

/** Estimate for one warm-up level (unknown level → beginner). */
export function estimateSessionDuration(
  template: SessionTemplate,
  level: WarmupLevel = DEFAULT_WARMUP_LEVEL,
  warmupSeconds: number = estimateTemplateWarmupSeconds(template, level),
): SessionDurationEstimate {
  assertWarmupSeconds(warmupSeconds);
  const target = template.targetMinutes ?? DEFAULT_SESSION_TARGET;
  assertTarget(target);

  const workSeconds = template.slots.reduce(
    (sum, slot) => sum + estimateSlotSeconds(slot),
    0,
  );
  const transitionSeconds =
    template.slots.length === 0 ? 0 : warmupTransitionSeconds(templateWarmupStations(template, level));
  const totalSeconds = warmupSeconds + transitionSeconds + workSeconds;
  const totalMinutesRounded = Math.round(totalSeconds / 60);
  const withinTarget =
    totalMinutesRounded >= target.minMinutes &&
    totalMinutesRounded <= target.maxMinutes;

  return {
    warmupSeconds,
    transitionSeconds,
    workSeconds,
    totalSeconds,
    totalMinutesRounded,
    withinTarget,
    withinHardCap: totalMinutesRounded <= SESSION_HARD_CAP_MINUTES,
    target,
  };
}

/** True when the estimate is in-band or only a few minutes outside (#126). */
export function nearTargetForLabel(estimate: SessionDurationEstimate): boolean {
  const slack = TARGET_LABEL_SLACK_MINUTES;
  const { minMinutes, maxMinutes } = estimate.target;
  const minutes = estimate.totalMinutesRounded;
  return minutes >= minMinutes - slack && minutes <= maxMinutes + slack;
}

export function formatDurationLabel(estimate: SessionDurationEstimate): string {
  const approx = `≈ ${estimate.totalMinutesRounded} min`;
  if (nearTargetForLabel(estimate)) {
    return approx;
  }
  return `${approx} (target ${targetBandLabel(estimate.target)})`;
}

function targetBandLabel(target: SessionDurationTarget): string {
  return `${target.minMinutes}–${target.maxMinutes} min`;
}

/**
 * Wall-clock estimate for today's resolved plan (warmup stations, the
 * warm-up → work rest, work + rests).
 */
export function estimatePlannedSessionSeconds(planned: PlannedSession): number {
  const transitionSeconds =
    planned.work.length === 0 ? 0 : warmupTransitionSeconds(planned.warmup);
  const warmupSeconds = warmupViewSeconds(planned.warmup) + transitionSeconds;
  return warmupSeconds + estimatePlannedWorkSeconds(planned.work);
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

function templateWarmupStations(template: SessionTemplate, level: WarmupLevel) {
  return stationsFor(template.warmupByLevel[level], template.warmupHoldSeconds);
}

/** Seconds of the template's warm-up stations at one level (transition rest excluded). */
export function estimateTemplateWarmupSeconds(
  template: SessionTemplate,
  level: WarmupLevel = DEFAULT_WARMUP_LEVEL,
): number {
  if (template.warmupByLevel[level].length === 0) {
    return DEFAULT_WARMUP_SECONDS;
  }
  return warmupViewSeconds(buildWarmupView(templateWarmupStations(template, level)));
}

/** True when the template's warm-up differs by level (Mobility has one list). */
export function hasTieredWarmup(template: SessionTemplate): boolean {
  const { beginner, intermediate, advanced } = template.warmupByLevel;
  const key = (ids: readonly string[]) => ids.join(",");
  return key(beginner) !== key(intermediate) || key(beginner) !== key(advanced);
}

/** Seconds of the template's optional cool-down (0 when it has none). */
export function estimateTemplateCooldownSeconds(template: SessionTemplate): number {
  return warmupViewSeconds(buildCooldownView(stationsFor(template.cooldownStationIds)));
}

/** Whole minutes for a station sequence label (at least 1 when non-empty). */
function stationMinutes(seconds: number): number {
  assertWarmupSeconds(seconds);
  return seconds === 0 ? 0 : Math.max(1, Math.round(seconds / 60));
}

/** Done-screen offer copy, e.g. "Cool-down · ~4 min". */
export function cooldownOfferLabel(cooldownSeconds: number): string {
  return `Cool-down · ~${stationMinutes(cooldownSeconds)} min`;
}

/**
 * Preview copy for Today / Plan, e.g. "Warm-up · intermediate · 8 min · +4 min
 * cool-down": the level (when the warm-up has levels), its length (counted in
 * the session estimate) and the optional cool-down shown separately.
 */
export function warmupCooldownLabel(
  template: SessionTemplate,
  level: WarmupLevel = DEFAULT_WARMUP_LEVEL,
): string {
  const minutes = stationMinutes(estimateTemplateWarmupSeconds(template, level));
  const levelPart = hasTieredWarmup(template) ? ` · ${level}` : "";
  const warmup = `Warm-up${levelPart} · ${minutes} min`;
  const cooldownSeconds = estimateTemplateCooldownSeconds(template);
  if (cooldownSeconds === 0) {
    return warmup;
  }
  return `${warmup} · +${stationMinutes(cooldownSeconds)} min cool-down`;
}

export { WARMUP_GAPS };

function requireExercise(exerciseId: string): Exercise {
  const exercise = EXERCISE_GRAPH[exerciseId];
  if (!exercise) {
    throw new Error(`Unknown exercise for duration estimate: ${exerciseId}`);
  }
  return exercise;
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
