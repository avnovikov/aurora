import type { ExerciseMemory, StopReason } from "../domain/types";

/** Absolute slow-set threshold (seconds). */
export const SLOW_SET_SECONDS = 120;

/** Mid-next-set cue delay when average samples are thin. */
export const FALLBACK_SLOW_SET_CUE_DELAY_SECONDS = 60;

/** Minimum samples before half-average is trusted for the cue delay. */
export const MIN_SAMPLES_FOR_AVG_CUE = 2;

/** Elapsed whole seconds for a set clock; never negative. */
export function elapsedSetSeconds(startedAtMs: number, nowMs: number = Date.now()): number {
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(nowMs)) {
    throw new Error(`set clock needs finite ms; got start=${startedAtMs} now=${nowMs}`);
  }
  return Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
}

/**
 * Duration to persist when leaving a set. Skip never logs duration; missing
 * start stamp means the clock never opened (e.g. hold or resume gap).
 */
export function loggedSetDurationSeconds(
  setStartedAtMs: number | undefined,
  stopReason: StopReason,
  nowMs: number = Date.now(),
): number | undefined {
  if (stopReason === "skipped" || setStartedAtMs === undefined) {
    return undefined;
  }
  return elapsedSetSeconds(setStartedAtMs, nowMs);
}

export function assertNonNegativeWholeSeconds(
  value: number,
  label: string = "durationSeconds",
): void {
  if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
    throw new Error(`${label} must be a non-negative integer; got ${value}`);
  }
}

export function shouldArmSlowSetCue(durationSeconds: number): boolean {
  return Number.isFinite(durationSeconds) && durationSeconds > SLOW_SET_SECONDS;
}

/**
 * Delay before the pace nudge on the next set: half the rolling average when
 * we have enough samples, otherwise the fallback (half of the 2‑minute bar).
 */
export function slowSetCueDelaySeconds(memory: ExerciseMemory | undefined): number {
  const samples = memory?.setDurationSampleCount ?? 0;
  const avg = memory?.avgSetDurationSeconds;
  if (
    samples < MIN_SAMPLES_FOR_AVG_CUE ||
    avg === undefined ||
    !Number.isFinite(avg) ||
    avg <= 0
  ) {
    return FALLBACK_SLOW_SET_CUE_DELAY_SECONDS;
  }
  return Math.max(1, Math.floor(avg / 2));
}
