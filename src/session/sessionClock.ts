/**
 * Elapsed / remaining clock for an active session.
 * Elapsed is wall-clock; remaining is theoretical time still ahead (caller-supplied).
 */

export interface SessionClockSnapshot {
  elapsedSeconds: number;
  remainingSeconds: number;
  /** British UI line: "Elapsed 3:05 · left 34:12" */
  label: string;
}

export function formatClock(totalSeconds: number): string {
  assertNonNegativeSeconds(totalSeconds, "totalSeconds");
  const whole = Math.floor(totalSeconds);
  const minutes = Math.floor(whole / 60);
  const seconds = whole % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function sessionClockSnapshot(
  startedAtMs: number,
  nowMs: number,
  theoreticalRemainingSeconds: number,
): SessionClockSnapshot {
  assertFinite(startedAtMs, "startedAtMs");
  assertFinite(nowMs, "nowMs");
  assertFinite(theoreticalRemainingSeconds, "theoreticalRemainingSeconds");
  if (nowMs < startedAtMs) {
    throw new Error(
      `nowMs must be >= startedAtMs; got now=${nowMs} start=${startedAtMs}`,
    );
  }
  const elapsedSeconds = Math.floor((nowMs - startedAtMs) / 1000);
  const remainingSeconds = Math.max(0, Math.floor(theoreticalRemainingSeconds));
  return {
    elapsedSeconds,
    remainingSeconds,
    label: `Elapsed ${formatClock(elapsedSeconds)} · left ${formatClock(remainingSeconds)}`,
  };
}

function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number; got ${value}`);
  }
}

function assertNonNegativeSeconds(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative number; got ${value}`);
  }
}
