import { EXERCISE_GRAPH } from "../data/exerciseGraph";
import type { Exercise, ExerciseMemory, FailedCap, SkillTier } from "../domain/types";
import type {
  HistoryEntry,
  LegacySessionEvaluation,
  SessionEvaluation,
} from "../domain/program";
import { libraryFamilyLadderIndex, type FamilyLadderIndex } from "../progress/familyLadderIndex";
import { inferTiers } from "../progress/inferTiers";
import {
  dropInferred,
  emptyMemory,
  evidenceTier,
  liveInferredTier,
  maxOf,
  refreshSkillTier,
} from "../progress/levelEvidence";
import { inferTierFromBest, stepDown } from "../domain/skillTier";
import { createKeyValueStore, readJson } from "../storage/keyValueStore";
import { HISTORY_KEY, MEMORY_V2_KEY } from "../storage/storageKeys";
import { assertNonNegativeWholeSeconds } from "./setDuration";
import type { SetLogEntry, WorkoutLog } from "./setLog";

export { emptyMemory } from "../progress/levelEvidence";

const historyStore = createKeyValueStore(HISTORY_KEY);
const memoryStore = createKeyValueStore(MEMORY_V2_KEY);

/** Highest of an existing logged tier and the tier implied by best reps. */
function maxLoggedOrBestTier(
  logged: SkillTier | undefined,
  bestReps: number,
  exercise: Exercise | undefined,
): SkillTier | undefined {
  const standards = exercise?.standards;
  const fromBest = standards ? inferTierFromBest(bestReps, standards) : undefined;
  return maxOf([logged, fromBest]);
}

/** Lift stale `loggedTier` to match `bestReps` + catalogue standards; never lower (#289). */
function withLoggedTierFromBest(
  memory: ExerciseMemory,
  exercise: Exercise | undefined,
): ExerciseMemory {
  if (memory.bestReps === undefined) {
    return memory;
  }
  const loggedTier = maxLoggedOrBestTier(memory.loggedTier, memory.bestReps, exercise);
  if (loggedTier === undefined || loggedTier === memory.loggedTier) {
    return memory;
  }
  return { ...memory, loggedTier };
}

function refreshLoadedMemory(
  exerciseId: string,
  memory: ExerciseMemory,
  now: Date,
): ExerciseMemory {
  return refreshSkillTier(
    withLoggedTierFromBest(memory, EXERCISE_GRAPH[exerciseId]),
    now,
  );
}

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

export function isSessionEvaluation(value: string): value is SessionEvaluation {
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

/** Most history entries kept (raised from 200 for imported history, #291). */
export const HISTORY_CAP = 1000;

export function appendHistory(entry: Omit<HistoryEntry, "id">): HistoryEntry[] {
  const history = loadHistory();
  const next: HistoryEntry = {
    ...entry,
    id: `hist_${history.length + 1}_${Date.now()}`,
  };
  const updated = [next, ...history].slice(0, HISTORY_CAP);
  historyStore.write(JSON.stringify(updated));
  return updated;
}

export interface MergeHistoryResult {
  history: HistoryEntry[];
  added: number;
  duplicates: number;
}

/**
 * Add imported entries (each with a `source.key`) to history: skip keys already
 * present, keep newest first, cap at HISTORY_CAP. Pure; see saveHistory.
 */
export function mergeHistory(
  history: readonly HistoryEntry[],
  incoming: ReadonlyArray<Omit<HistoryEntry, "id">>,
): MergeHistoryResult {
  const seen = new Set(history.map((entry) => entry.source?.key).filter((key): key is string => key !== undefined));
  const fresh: HistoryEntry[] = [];
  let duplicates = 0;
  for (const entry of incoming) {
    const key = entry.source?.key;
    if (key !== undefined && seen.has(key)) {
      duplicates += 1;
      continue;
    }
    if (key !== undefined) {
      seen.add(key);
    }
    fresh.push({ ...entry, id: `imp_${fresh.length + 1}_${Date.parse(entry.completedAt)}` });
  }
  const merged = [...history, ...fresh].sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt));
  return { history: merged.slice(0, HISTORY_CAP), added: fresh.length, duplicates };
}

export function saveHistory(history: readonly HistoryEntry[]): void {
  historyStore.write(JSON.stringify(history.slice(0, HISTORY_CAP)));
}

export function loadMemories(now: Date = new Date()): Record<string, ExerciseMemory> {
  const raw = readJson(memoryStore, {} as Record<string, ExerciseMemory>);
  return Object.fromEntries(
    Object.entries(raw).map(([id, memory]) => [id, refreshLoadedMemory(id, memory, now)]),
  );
}

export function saveMemories(memories: Record<string, ExerciseMemory>): void {
  memoryStore.write(JSON.stringify(memories));
}

export interface ApplySetLogOptions {
  /** Light-day (and deload) misses do not count toward stall. */
  lightDay?: boolean;
  now?: Date;
  index?: FamilyLadderIndex;
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
  const now = options.now ?? new Date();
  const next = { ...memories };
  const outcomes = new Map<string, Exclude<ExerciseSessionOutcome, "untouched">>();
  for (const [exerciseId, entries] of byExercise) {
    const outcome = outcomeForExercise(entries);
    if (outcome === "untouched") {
      continue;
    }
    outcomes.set(exerciseId, outcome);
    const current = next[exerciseId] ?? emptyMemory(exerciseId);
    next[exerciseId] = memoryAfterSessionOutcome(current, outcome, lightDay);
  }
  return applyLevelEvidence(next, outcomes, lightDay, now, options.index ?? libraryFamilyLadderIndex());
}

type Memories = Record<string, ExerciseMemory>;

/** Clean session: an inferred tier becomes logged; caps from this move lift. */
function confirmInferred(
  next: Memories,
  exerciseId: string,
  now: Date,
  index: FamilyLadderIndex,
  confirmingFamilies: Set<string>,
): void {
  const current = next[exerciseId]!;
  const inferred = liveInferredTier(current, now);
  const loggedTier = maxOf([current.loggedTier, inferred]);
  next[exerciseId] = refreshSkillTier(
    { ...dropInferred(current), loggedTier, lastSessionAt: now.toISOString() },
    now,
  );
  const placement = index.byId.get(exerciseId);
  if (placement) {
    confirmingFamilies.add(placement.familyId);
  }
  clearCapsFrom(next, exerciseId);
}

function clearCapsFrom(next: Memories, exerciseId: string): void {
  for (const [id, memory] of Object.entries(next)) {
    if (memory.failedCaps?.some((cap) => cap.from === exerciseId)) {
      const copy = { ...memory };
      const kept = memory.failedCaps.filter((cap) => cap.from !== exerciseId);
      if (kept.length > 0) {
        copy.failedCaps = kept;
      } else {
        delete copy.failedCaps;
      }
      next[id] = copy;
    }
  }
}

/** Replace any earlier cap from the same source with this one. */
function withCapFrom(target: ExerciseMemory, cap: FailedCap): ExerciseMemory {
  const others = (target.failedCaps ?? []).filter((c) => c.from !== cap.from);
  return { ...target, failedCaps: [...others, cap] };
}

/** Failed set: drop the inferred tier and cap harder rungs in the family. */
function capHarderRungs(
  next: Memories,
  exerciseId: string,
  now: Date,
  index: FamilyLadderIndex,
): void {
  const current = next[exerciseId]!;
  const failedAt = evidenceTier(current, now) ?? "beginner";
  const nowIso = now.toISOString();
  next[exerciseId] = refreshSkillTier({ ...dropInferred(current), lastSessionAt: nowIso }, now);
  const placement = index.byId.get(exerciseId);
  if (!placement) {
    return;
  }
  // Self-cap: the same supporters must not re-infer the failed tier (rule 7).
  const selfCap: FailedCap = { tier: stepDown(failedAt) ?? "novice", from: exerciseId, at: nowIso };
  next[exerciseId] = withCapFrom(next[exerciseId]!, selfCap);
  for (const member of index.byFamily.get(placement.familyId) ?? []) {
    if (member.rank <= placement.rank) {
      continue;
    }
    const existing = next[member.id];
    // #116: only cap harder rungs that already have a memory row.
    if (!existing) {
      continue;
    }
    next[member.id] = withCapFrom(existing, { tier: failedAt, from: exerciseId, at: nowIso });
  }
}

/** #112 rule 7 (confirm / remove inferred), rule 2 (failure caps harder rungs), then re-infer. */
function applyLevelEvidence(
  memories: Memories,
  outcomes: ReadonlyMap<string, Exclude<ExerciseSessionOutcome, "untouched">>,
  lightDay: boolean,
  now: Date,
  index: FamilyLadderIndex,
): Memories {
  const next = { ...memories };
  const confirmingFamilies = new Set<string>();
  for (const [exerciseId, outcome] of outcomes) {
    if (outcome === "at_standard") {
      confirmInferred(next, exerciseId, now, index, confirmingFamilies);
    } else if (outcome === "below_floor" && !lightDay) {
      capHarderRungs(next, exerciseId, now, index);
    } else {
      next[exerciseId] = { ...next[exerciseId]!, lastSessionAt: now.toISOString() };
    }
  }
  return inferTiers({ memories: next, now, index, confirmingFamilies }).memories;
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
  /** Related family moves that now carry an inferred tier. */
  inferredCount: number;
}

/** Manual tier pick from Library (tested evidence), then re-run inference (#112). */
export function declareSkillTier(
  memories: Record<string, ExerciseMemory>,
  exerciseId: string,
  tier: SkillTier,
  now: Date = new Date(),
  index?: FamilyLadderIndex,
): DeclareSkillTierResult {
  const current = memories[exerciseId] ?? emptyMemory(exerciseId);
  const withPick = {
    ...memories,
    [exerciseId]: refreshSkillTier(
      { ...current, declaredTier: tier, declaredAt: now.toISOString() },
      now,
    ),
  };
  const result = inferTiers({ memories: withPick, now, index });
  return {
    memories: result.memories,
    inferredCount: result.inferredIds.length,
  };
}

/** After a logged set: raise bestReps; standards turn it into a tested loggedTier. */
export function recordBestReps(
  memories: Record<string, ExerciseMemory>,
  exerciseId: string,
  completedReps: number,
  exercise: Exercise | undefined = EXERCISE_GRAPH[exerciseId],
  now: Date = new Date(),
): Record<string, ExerciseMemory> {
  if (completedReps <= 0) {
    return memories;
  }
  const current = memories[exerciseId] ?? emptyMemory(exerciseId);
  const bestReps = Math.max(current.bestReps ?? 0, completedReps);
  const loggedTier = maxLoggedOrBestTier(current.loggedTier, bestReps, exercise);
  return {
    ...memories,
    [exerciseId]: refreshSkillTier({ ...current, bestReps, loggedTier, lastSessionAt: now.toISOString() }, now),
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
