import type { Exercise, Pattern } from "../domain/types";

export type HistoryFilter =
  | { kind: "all" }
  | { kind: "pattern"; pattern: Pattern; exerciseIds: readonly string[] }
  | { kind: "exercise"; exerciseId: string };

/** Whether an exercise id belongs in the active History filter. */
export function passesHistoryExerciseFilter(
  exerciseId: string,
  filter: HistoryFilter,
  graph: Record<string, Exercise>,
): boolean {
  switch (filter.kind) {
    case "all":
      return true;
    case "exercise":
      return exerciseId === filter.exerciseId;
    case "pattern":
      if (filter.exerciseIds.includes(exerciseId)) {
        return true;
      }
      return graph[exerciseId]?.pattern === filter.pattern;
  }
}

/** True when a history session has no set payload (summary-only). */
export function isLegacyHistorySession(session: {
  sets?: readonly unknown[];
  exerciseIds: readonly string[];
  setCount: number;
}): boolean {
  const sets = session.sets;
  if (sets && sets.length > 0) {
    return false;
  }
  return session.exerciseIds.length > 0 || session.setCount > 0;
}
