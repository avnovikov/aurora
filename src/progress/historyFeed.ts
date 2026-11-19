import type { HistoryEntry, HistorySetRecord } from "../domain/program";
import type { Exercise } from "../domain/types";
import { displayNameOf } from "../library/displayName";
import {
  isLegacyHistorySession,
  passesHistoryExerciseFilter,
  type HistoryFilter,
} from "./historyFilter";

export type { HistoryFilter } from "./historyFilter";

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

export interface HistoryFeedModel {
  filter: HistoryFilter;
  rows: HistoryFeedRow[];
  /** True when history contains at least one legacy (no-sets) session. */
  hasLegacyOnly: boolean;
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
  return { filter, rows, hasLegacyOnly };
}

/** Legacy summary rows for one session, filtered like the set feed. */
export function legacyFeedRowsForSession(
  session: HistoryEntry,
  graph: Record<string, Exercise>,
  filter: HistoryFilter,
): HistoryFeedRow[] {
  return session.exerciseIds
    .filter((exerciseId) =>
      passesHistoryExerciseFilter(exerciseId, filter, graph),
    )
    .map((exerciseId) => toLegacyFeedRow(session, exerciseId, graph));
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
      if (isLegacyHistorySession(session)) {
        hasLegacyOnly = true;
        rows.push(...legacyFeedRowsForSession(session, graph, filter));
      }
      continue;
    }
    for (const set of sets) {
      if (!passesHistoryExerciseFilter(set.exerciseId, filter, graph)) {
        continue;
      }
      rows.push(toSetFeedRow(session, set, graph));
    }
  }

  return { rows, hasLegacyOnly };
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
  return b.when.localeCompare(a.when);
}
