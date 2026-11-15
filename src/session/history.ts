import type { ExerciseMemory } from "../domain/types";
import type { HistoryEntry, SessionEvaluation } from "../domain/program";

const HISTORY_KEY = "aurora.poc.history.v1";
const MEMORY_KEY = "aurora.poc.memory.v1";

export function loadHistory(): HistoryEntry[] {
  return readJson(HISTORY_KEY, [] as HistoryEntry[]);
}

export function appendHistory(entry: Omit<HistoryEntry, "id">): HistoryEntry[] {
  const history = loadHistory();
  const next: HistoryEntry = {
    ...entry,
    id: `hist_${history.length + 1}_${Date.now()}`,
  };
  const updated = [next, ...history].slice(0, 200);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  return updated;
}

export function loadMemories(): Record<string, ExerciseMemory> {
  return readJson(MEMORY_KEY, {} as Record<string, ExerciseMemory>);
}

export function saveMemories(memories: Record<string, ExerciseMemory>): void {
  localStorage.setItem(MEMORY_KEY, JSON.stringify(memories));
}

/**
 * After a session, bump standard/below-floor counts from evaluation.
 * Rough POC signal so the resolver can guess the next level.
 */
export function applyEvaluationToMemory(
  memories: Record<string, ExerciseMemory>,
  exerciseIds: string[],
  evaluation: SessionEvaluation,
): Record<string, ExerciseMemory> {
  const next = { ...memories };
  for (const exerciseId of exerciseIds) {
    const current = next[exerciseId] ?? emptyMemory(exerciseId);
    if (evaluation === "easy" || evaluation === "on_target") {
      next[exerciseId] = {
        ...current,
        sessionsAtStandard: current.sessionsAtStandard + 1,
        sessionsBelowFloor: 0,
      };
    } else if (evaluation === "failed") {
      next[exerciseId] = {
        ...current,
        sessionsBelowFloor: current.sessionsBelowFloor + 1,
        sessionsAtStandard: 0,
      };
    } else {
      next[exerciseId] = { ...current, sessionsAtStandard: 0 };
    }
  }
  return next;
}

function emptyMemory(exerciseId: string): ExerciseMemory {
  return {
    exerciseId,
    sessionsAtStandard: 0,
    sessionsBelowFloor: 0,
    lastAddedLoadKg: 0,
    weakLinkSessionsRemaining: 0,
  };
}

function readJson<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
