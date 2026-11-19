import type { HistoryEntry, HistorySetRecord } from "../domain/program";
import type { Exercise, Pattern } from "../domain/types";
import { displayNameOf } from "../library/displayName";

export type HistoryFilter =
  | { kind: "all" }
  | { kind: "pattern"; pattern: Pattern; exerciseIds: readonly string[] }
  | { kind: "exercise"; exerciseId: string };

export type HistoryFeedRowKind = "set" | "legacy_session";

export interface HistoryFeedRow {
  key: string;
  kind: HistoryFeedRowKind;
  exerciseId: string;
  exerciseName: string;
  setIndex: number;
  completedReps: number;
  prescribedReps: number;
  when: string;
  sessionId: string;
  stopReason: string;
  /** Total sets in the session (legacy rows only — per-set detail was never stored). */
  sessionSetCount?: number;
  /** Mean strap bpm for this set when samples existed. */
  averageBpm?: number;
}

export interface HistorySessionPulse {
  sessionId: string;
  templateName: string;
  completedAt: string;
  pulse: NonNullable<HistoryEntry["pulse"]>;
}

export interface HistoryFeedModel {
  filter: HistoryFilter;
  rows: HistoryFeedRow[];
  /** True when at least one legacy (no-sets) session contributed rows or was seen. */
  hasLegacyOnly: boolean;
  /** Sessions in this feed that stored a strap timeseries. */
  sessionPulses: HistorySessionPulse[];
}

/**
 * Flatten history set records newest-first; apply pattern or exercise filter.
 * Sessions saved before set payloads existed get one summary row per exercise.
 */
export function buildHistoryFeed(input: {
  history: readonly HistoryEntry[];
  graph: Record<string, Exercise>;
  filter?: HistoryFilter;
}): HistoryFeedModel {
  const filter = input.filter ?? { kind: "all" };
  const { rows, hasLegacyOnly } = flattenFilteredHistory(
    input.history,
    input.graph,
    filter,
  );
  rows.sort(compareWhenDesc);
  const sessionPulses = sessionPulsesForFeed(input.history, filter, rows);
  return { filter, rows, hasLegacyOnly, sessionPulses };
}

function flattenFilteredHistory(
  history: readonly HistoryEntry[],
  graph: Record<string, Exercise>,
  filter: HistoryFilter,
): { rows: HistoryFeedRow[]; hasLegacyOnly: boolean } {
  const rows: HistoryFeedRow[] = [];
  let hasLegacyOnly = false;

  for (const session of history) {
    const sets = session.sets;
    if (!sets || sets.length === 0) {
      if (session.exerciseIds.length > 0 || session.setCount > 0) {
        hasLegacyOnly = true;
        rows.push(...legacyRowsForSession(session, graph, filter));
      }
      continue;
    }
    for (const set of sets) {
      if (!passesExerciseFilter(set.exerciseId, filter, graph)) {
        continue;
      }
      rows.push(toSetFeedRow(session, set, graph));
    }
  }

  return { rows, hasLegacyOnly };
}

function legacyRowsForSession(
  session: HistoryEntry,
  graph: Record<string, Exercise>,
  filter: HistoryFilter,
): HistoryFeedRow[] {
  return session.exerciseIds
    .filter((exerciseId) => passesExerciseFilter(exerciseId, filter, graph))
    .map((exerciseId) => toLegacyFeedRow(session, exerciseId, graph));
}

function toSetFeedRow(
  session: HistoryEntry,
  set: HistorySetRecord,
  graph: Record<string, Exercise>,
): HistoryFeedRow {
  return {
    key: `${session.id}:${set.exerciseId}:${set.setIndex}:${set.loggedAt}`,
    kind: "set",
    exerciseId: set.exerciseId,
    exerciseName: displayNameOf(set.exerciseId, graph),
    setIndex: set.setIndex,
    completedReps: set.completedReps,
    prescribedReps: set.prescribedReps,
    when: set.loggedAt || session.completedAt,
    sessionId: session.id,
    stopReason: set.stopReason,
    ...(set.averageBpm !== undefined ? { averageBpm: set.averageBpm } : {}),
  };
}

function sessionPulsesForFeed(
  history: readonly HistoryEntry[],
  filter: HistoryFilter,
  rows: readonly HistoryFeedRow[],
): HistorySessionPulse[] {
  const sessionIdsInFeed = new Set(rows.map((row) => row.sessionId));
  const pulses: HistorySessionPulse[] = [];
  for (const session of history) {
    if (!sessionHasPulseSeries(session)) {
      continue;
    }
    if (filter.kind !== "all" && !sessionIdsInFeed.has(session.id)) {
      continue;
    }
    pulses.push({
      sessionId: session.id,
      templateName: session.templateName,
      completedAt: session.completedAt,
      pulse: session.pulse,
    });
  }
  pulses.sort(compareCompletedAtDesc);
  return pulses;
}

function sessionHasPulseSeries(
  session: HistoryEntry,
): session is HistoryEntry & { pulse: NonNullable<HistoryEntry["pulse"]> } {
  return Boolean(session.pulse && session.pulse.series.length > 0);
}

function compareCompletedAtDesc(a: HistorySessionPulse, b: HistorySessionPulse): number {
  if (a.completedAt === b.completedAt) {
    return 0;
  }
  return a.completedAt < b.completedAt ? 1 : -1;
}

function toLegacyFeedRow(
  session: HistoryEntry,
  exerciseId: string,
  graph: Record<string, Exercise>,
): HistoryFeedRow {
  return {
    key: `${session.id}:legacy:${exerciseId}`,
    kind: "legacy_session",
    exerciseId,
    exerciseName: displayNameOf(exerciseId, graph),
    setIndex: 0,
    completedReps: 0,
    prescribedReps: 0,
    when: session.completedAt,
    sessionId: session.id,
    stopReason: "completed",
    sessionSetCount: session.setCount,
  };
}

function compareWhenDesc(a: HistoryFeedRow, b: HistoryFeedRow): number {
  if (a.when === b.when) {
    return 0;
  }
  return a.when < b.when ? 1 : -1;
}

function passesExerciseFilter(
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
