import type { Readiness } from "../domain/types";
import type { PlannedSession } from "../rules/planSession";
import { createKeyValueStore } from "../storage/keyValueStore";
import { SESSION_KEY } from "../storage/storageKeys";
import type { WorkoutLog } from "./setLog";

const store = createKeyValueStore(SESSION_KEY);

export interface PersistedSession {
  readiness: Readiness;
  planned: PlannedSession;
  log: WorkoutLog;
  phase: "warmup" | "work" | "cooldown" | "done";
  warmupIndex: number;
  /** Cool-down station index (absent in sessions saved before the cool-down existed). */
  cooldownIndex?: number;
  workIndex: number;
  setIndex: number;
  nextRepsOverride?: number;
  /** Sticky added load for the current exercise (#251). */
  addedLoadKg?: number;
  /** Unweighted id before an Add-weight cousin swap (#251). */
  loadSwapFromId?: string;
  /** ISO time when the athlete started this session (for the elapsed clock). */
  startedAt?: string;
  savedAt: string;
}

export function saveSession(session: PersistedSession): void {
  assertSession(session);
  store.write(JSON.stringify(session));
}

export function loadSession(): PersistedSession | null {
  const raw = store.read();
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as PersistedSession;
    assertSession(parsed);
    return parsed;
  } catch {
    store.clear();
    return null;
  }
}

export function clearSession(): void {
  store.clear();
}

function assertSession(session: PersistedSession): void {
  if (!session.planned || !session.readiness || !session.log) {
    throw new Error("Persisted session is missing required fields");
  }
  if (
    session.warmupIndex < 0 ||
    session.workIndex < 0 ||
    session.setIndex < 1 ||
    (session.cooldownIndex ?? 0) < 0
  ) {
    throw new Error("Persisted session indexes out of range");
  }
}
