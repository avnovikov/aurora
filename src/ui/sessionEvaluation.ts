import type {
  HistoryEntry,
  HistoryPulse,
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
  /** Built from the live session buffer; omit when empty. */
  pulse?: HistoryPulse;
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
  pulse,
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
      ...optionalPulse(pulse),
    },
    memories: applySetLogToMemory(memories, log, { lightDay: planned.lightDay }),
  };
}

function optionalPulse(pulse: HistoryPulse | undefined): { pulse?: HistoryPulse } {
  return pulse ? { pulse } : {};
}

function toHistorySetRecord(entry: SetLogEntry): HistorySetRecord {
  return {
    exerciseId: entry.exerciseId,
    setIndex: entry.setIndex,
    prescribedReps: entry.prescribedReps,
    completedReps: entry.completedReps,
    loggedAt: entry.loggedAt,
    stopReason: entry.stopReason,
    ...optionalAverageBpm(entry.averageBpm),
  };
}

function optionalAverageBpm(
  averageBpm: number | undefined,
): { averageBpm?: number } {
  return averageBpm === undefined ? {} : { averageBpm };
}
