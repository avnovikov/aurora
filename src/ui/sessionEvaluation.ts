import type {
  HistoryEntry,
  HistorySetRecord,
  SessionEvaluation,
} from "../domain/program";
import type { ExerciseMemory } from "../domain/types";
import type { PlannedSession } from "../rules/planSession";
import { applySetLogToMemory } from "../session/history";
import type { SetLogEntry, WorkoutLog } from "../session/setLog";

export interface CommitSessionEvaluationInput {
  evaluation: SessionEvaluation;
  planned: PlannedSession;
  log: WorkoutLog;
  memories: Record<string, ExerciseMemory>;
}

export interface CommitSessionEvaluationResult {
  history: Omit<HistoryEntry, "id">;
  memories: Record<string, ExerciseMemory>;
}

/**
 * Persist-shaped session close: rating goes on history only; memory comes
 * from each exercise's set log.
 */
export function commitSessionEvaluation({
  evaluation,
  planned,
  log,
  memories,
}: CommitSessionEvaluationInput): CommitSessionEvaluationResult {
  const exerciseIds = planned.work.map((item) => item.exerciseId);
  return {
    history: {
      completedAt: new Date().toISOString(),
      templateId: planned.programId,
      templateName: planned.sessionLabel,
      evaluation,
      setCount: log.entries.length,
      exerciseIds,
      sets: log.entries.map(toHistorySetRecord),
    },
    memories: applySetLogToMemory(memories, log, { lightDay: planned.lightDay }),
  };
}

function toHistorySetRecord(entry: SetLogEntry): HistorySetRecord {
  return {
    exerciseId: entry.exerciseId,
    setIndex: entry.setIndex,
    prescribedReps: entry.prescribedReps,
    completedReps: entry.completedReps,
    loggedAt: entry.loggedAt,
    stopReason: entry.stopReason,
  };
}
