import type { Readiness } from "../domain/types";
import type { PlannedSession } from "../rules/planSession";
import type { WorkoutLog } from "./setLog";

const KEY = "aurora.poc.session.v1";

export interface PersistedSession {
  readiness: Readiness;
  planned: PlannedSession;
  log: WorkoutLog;
  phase: "warmup" | "work" | "done";
  warmupIndex: number;
  workIndex: number;
  setIndex: number;
  nextRepsOverride?: number;
  /** ISO time when the athlete started this session (for the elapsed clock). */
  startedAt?: string;
  savedAt: string;
}

export function saveSession(session: PersistedSession): void {
  assertSession(session);
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function loadSession(): PersistedSession | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as PersistedSession;
    assertSession(parsed);
    return parsed;
  } catch {
    localStorage.removeItem(KEY);
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(KEY);
}

function assertSession(session: PersistedSession): void {
  if (!session.planned || !session.readiness || !session.log) {
    throw new Error("Persisted session is missing required fields");
  }
  if (session.warmupIndex < 0 || session.workIndex < 0 || session.setIndex < 1) {
    throw new Error("Persisted session indexes out of range");
  }
}
