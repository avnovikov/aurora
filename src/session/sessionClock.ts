/**
 * Elapsed / remaining clock for an active session (wall-clock seconds).
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
  plannedTotalSeconds: number,
  nowMs: number,
): SessionClockSnapshot {
  assertFiniteMs(startedAtMs, "startedAtMs");
  assertFiniteMs(nowMs, "nowMs");
  assertNonNegativeSeconds(plannedTotalSeconds, "plannedTotalSeconds");
  if (nowMs < startedAtMs) {
    throw new Error(
      `nowMs must be >= startedAtMs; got now=${nowMs} start=${startedAtMs}`,
    );
  }
  const elapsedSeconds = Math.floor((nowMs - startedAtMs) / 1000);
  const remainingSeconds = Math.max(0, Math.floor(plannedTotalSeconds) - elapsedSeconds);
  return {
    elapsedSeconds,
    remainingSeconds,
    label: `Elapsed ${formatClock(elapsedSeconds)} · left ${formatClock(remainingSeconds)}`,
  };
}

function assertFiniteMs(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number; got ${value}`);
  }
}

function assertNonNegativeSeconds(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative number; got ${value}`);
  }
}
