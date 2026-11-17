import { EXERCISE_GRAPH } from "../data/exerciseGraph";
import { maxTier } from "../domain/skillTier";
import type { Exercise, ExerciseMemory, SkillTier } from "../domain/types";
import type {
  HistoryEntry,
  LegacySessionEvaluation,
  SessionEvaluation,
} from "../domain/program";
import { cascadeFamilyTiers } from "../progress/cascadeFamilyTiers";
import { effectiveSkillTier } from "../rules/skillDose";
import { createKeyValueStore, type KeyValueStore } from "../storage/keyValueStore";
import { HISTORY_KEY, MEMORY_KEY } from "../storage/storageKeys";
import { assertNonNegativeWholeSeconds } from "./setDuration";
import type { SetLogEntry, WorkoutLog } from "./setLog";

const historyStore = createKeyValueStore(HISTORY_KEY);
const memoryStore = createKeyValueStore(MEMORY_KEY);

const EVALUATION_LABELS: Record<SessionEvaluation, string> = {
  easy: "Easy",
  on_target: "On target",
  difficult: "Difficult",
  wiped: "Wiped",
};

/** Evaluation buttons and history normalization use this order. */
export const SESSION_EVALUATION_CHOICES: readonly SessionEvaluation[] = Object.keys(
  EVALUATION_LABELS,
) as SessionEvaluation[];

type StoredHistoryEntry = Omit<HistoryEntry, "evaluation"> & {
  evaluation: LegacySessionEvaluation;
};

function isSessionEvaluation(value: string): value is SessionEvaluation {
  return Object.hasOwn(EVALUATION_LABELS, value);
}

/** Map legacy `"failed"` history values to `"difficult"`. */
export function normalizeSessionEvaluation(
  value: LegacySessionEvaluation | string,
): SessionEvaluation {
  if (value === "failed") {
    return "difficult";
  }
  if (isSessionEvaluation(value)) {
    return value;
  }
  throw new Error(`Unknown session evaluation: ${value}`);
}

/** Display label for a session rating (legacy `"failed"` reads as Difficult). */
export function sessionEvaluationLabel(
  value: LegacySessionEvaluation | string,
): string {
  return EVALUATION_LABELS[normalizeSessionEvaluation(value)];
}

export function loadHistory(): HistoryEntry[] {
  const raw = readJson(historyStore, [] as StoredHistoryEntry[]);
  return raw.map((entry) => ({
    ...entry,
    evaluation: normalizeSessionEvaluation(entry.evaluation),
  }));
}

export function appendHistory(entry: Omit<HistoryEntry, "id">): HistoryEntry[] {
  const history = loadHistory();
  const next: HistoryEntry = {
    ...entry,
    id: `hist_${history.length + 1}_${Date.now()}`,
  };
  const updated = [next, ...history].slice(0, 200);
  historyStore.write(JSON.stringify(updated));
  return updated;
}

export function loadMemories(): Record<string, ExerciseMemory> {
  return readJson(memoryStore, {} as Record<string, ExerciseMemory>);
}

export function saveMemories(memories: Record<string, ExerciseMemory>): void {
  memoryStore.write(JSON.stringify(memories));
}

export interface ApplySetLogOptions {
  /** Light-day (and deload) misses do not count toward stall. */
  lightDay?: boolean;
}

type ExerciseSessionOutcome = "untouched" | "at_standard" | "below_floor" | "not_standard";

/**
 * After a session, bump standard/below-floor counts from each exercise's own
 * set log — never from the session-feeling rating.
 */
export function applySetLogToMemory(
  memories: Record<string, ExerciseMemory>,
  log: WorkoutLog,
  options: ApplySetLogOptions = {},
): Record<string, ExerciseMemory> {
  const byExercise = groupEntriesByExercise(log.entries);
  if (byExercise.size === 0) {
    return memories;
  }
  const lightDay = options.lightDay === true;
  const next = { ...memories };
  for (const [exerciseId, entries] of byExercise) {
    const outcome = outcomeForExercise(entries);
    if (outcome === "untouched") {
      continue;
    }
    const current = next[exerciseId] ?? emptyMemory(exerciseId);
    next[exerciseId] = memoryAfterSessionOutcome(current, outcome, lightDay);
  }
  return next;
}

function memoryAfterSessionOutcome(
  current: ExerciseMemory,
  outcome: Exclude<ExerciseSessionOutcome, "untouched">,
  lightDay: boolean,
): ExerciseMemory {
  switch (outcome) {
    case "at_standard":
      return {
        ...current,
        sessionsAtStandard: current.sessionsAtStandard + 1,
        sessionsBelowFloor: 0,
      };
    case "below_floor":
      if (lightDay) {
        return { ...current, sessionsAtStandard: 0 };
      }
      return {
        ...current,
        sessionsBelowFloor: current.sessionsBelowFloor + 1,
        sessionsAtStandard: 0,
      };
    case "not_standard":
      return { ...current, sessionsAtStandard: 0 };
  }
}

function groupEntriesByExercise(
  entries: readonly SetLogEntry[],
): Map<string, SetLogEntry[]> {
  const byExercise = new Map<string, SetLogEntry[]>();
  for (const entry of entries) {
    const list = byExercise.get(entry.exerciseId);
    if (list) {
      list.push(entry);
    } else {
      byExercise.set(entry.exerciseId, [entry]);
    }
  }
  return byExercise;
}

function outcomeForExercise(entries: readonly SetLogEntry[]): ExerciseSessionOutcome {
  if (entries.length === 0) {
    throw new Error("outcomeForExercise requires at least one log entry");
  }
  const worked = entries.filter(isWorkedSet);
  if (worked.length === 0) {
    return "untouched";
  }
  if (worked.some(isBelowFloorSet)) {
    return "below_floor";
  }
  const allAtPrescribed = worked.every(
    (entry) => entry.completedReps >= entry.prescribedReps,
  );
  const hadSkip = entries.some((entry) => entry.stopReason === "skipped");
  if (allAtPrescribed && !hadSkip) {
    return "at_standard";
  }
  return "not_standard";
}

function isWorkedSet(entry: SetLogEntry): boolean {
  return entry.stopReason !== "skipped";
}

function isBelowFloorSet(entry: SetLogEntry): boolean {
  return (
    entry.stopReason === "muscular_failure" && entry.completedReps < entry.prescribedReps
  );
}

export interface DeclareSkillTierResult {
  memories: Record<string, ExerciseMemory>;
  /** Related family moves whose floor rose (not the exercise you picked). */
  cascadedCount: number;
}

/**
 * Manual tier pick from Library, then raise same-or-easier family floors.
 * Session logging can call `cascadeFamilyTiers` later with the same math.
 */
export function declareSkillTier(
  memories: Record<string, ExerciseMemory>,
  exerciseId: string,
  tier: SkillTier,
): DeclareSkillTierResult {
  const current = memories[exerciseId] ?? emptyMemory(exerciseId);
  const withSource: Record<string, ExerciseMemory> = {
    ...memories,
    [exerciseId]: {
      ...current,
      declaredTier: tier,
      skillTier: maxTier(current.skillTier ?? tier, tier),
    },
  };
  const { memories: cascadedMemories, raisedIds } = cascadeFamilyTiers({
    memories: withSource,
    sourceId: exerciseId,
    declaredTier: tier,
  });
  return {
    memories: cascadedMemories,
    cascadedCount: raisedIds.length,
  };
}

/**
 * After a logged set, raise bestReps and promote skillTier when standards say so.
 */
export function recordBestReps(
  memories: Record<string, ExerciseMemory>,
  exerciseId: string,
  completedReps: number,
  exercise: Exercise | undefined = EXERCISE_GRAPH[exerciseId],
): Record<string, ExerciseMemory> {
  if (completedReps <= 0) {
    return memories;
  }
  const current = memories[exerciseId] ?? emptyMemory(exerciseId);
  const bestReps = Math.max(current.bestReps ?? 0, completedReps);
  const withBest = { ...current, bestReps };
  const skillTier = exercise
    ? effectiveSkillTier(withBest, exercise)
    : (withBest.skillTier ?? withBest.declaredTier ?? "beginner");
  return {
    ...memories,
    [exerciseId]: {
      ...withBest,
      skillTier,
    },
  };
}

/**
 * Fold one logged rep-set duration into the exercise's rolling average.
 */
export function recordSetDuration(
  memories: Record<string, ExerciseMemory>,
  exerciseId: string,
  durationSeconds: number,
): Record<string, ExerciseMemory> {
  assertNonNegativeWholeSeconds(durationSeconds);
  const current = memories[exerciseId] ?? emptyMemory(exerciseId);
  const sampleCount = current.setDurationSampleCount ?? 0;
  const previousAvg = current.avgSetDurationSeconds ?? 0;
  const nextCount = sampleCount + 1;
  const nextAvg = Math.round((previousAvg * sampleCount + durationSeconds) / nextCount);
  return {
    ...memories,
    [exerciseId]: {
      ...current,
      avgSetDurationSeconds: nextAvg,
      setDurationSampleCount: nextCount,
    },
  };
}

export function emptyMemory(exerciseId: string): ExerciseMemory {
  return {
    exerciseId,
    sessionsAtStandard: 0,
    sessionsBelowFloor: 0,
    lastAddedLoadKg: 0,
    weakLinkSessionsRemaining: 0,
  };
}

function readJson<T>(store: KeyValueStore, fallback: T): T {
  const raw = store.read();
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
