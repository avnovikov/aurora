import type { HistoryEntry, HistorySetRecord } from "../domain/program";
import type { Exercise, Pattern } from "../domain/types";
import { displayNameOf } from "../library/displayName";

export type HistoryFilter =
  | { kind: "all" }
  | { kind: "pattern"; pattern: Pattern; exerciseIds: readonly string[] }
  | { kind: "exercise"; exerciseId: string };

export interface HistoryFeedRow {
  key: string;
  exerciseId: string;
  exerciseName: string;
  setIndex: number;
  completedReps: number;
  prescribedReps: number;
  when: string;
  sessionId: string;
  stopReason: string;
}

export interface HistoryFeedModel {
  filter: HistoryFilter;
  rows: HistoryFeedRow[];
  /** True when sessions exist but have no set payloads (legacy). */
  hasLegacyOnly: boolean;
}

/**
 * Flatten history set records newest-first; apply pattern or exercise filter.
 */
export function buildHistoryFeed(input: {
  history: readonly HistoryEntry[];
  graph: Record<string, Exercise>;
  filter?: HistoryFilter;
}): HistoryFeedModel {
  const filter = input.filter ?? { kind: "all" };
  const { rows, hasLegacyOnly } = flattenFilteredSets(
    input.history,
    input.graph,
    filter,
  );
  rows.sort(compareWhenDesc);
  return { filter, rows, hasLegacyOnly };
}

function flattenFilteredSets(
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
      }
      continue;
    }
    for (const set of sets) {
      if (!passesFilter(set, filter, graph)) {
        continue;
      }
      rows.push(toFeedRow(session, set, graph));
    }
  }

  return { rows, hasLegacyOnly };
}

function toFeedRow(
  session: HistoryEntry,
  set: HistorySetRecord,
  graph: Record<string, Exercise>,
): HistoryFeedRow {
  return {
    key: `${session.id}:${set.exerciseId}:${set.setIndex}:${set.loggedAt}`,
    exerciseId: set.exerciseId,
    exerciseName: displayNameOf(set.exerciseId, graph),
    setIndex: set.setIndex,
    completedReps: set.completedReps,
    prescribedReps: set.prescribedReps,
    when: set.loggedAt || session.completedAt,
    sessionId: session.id,
    stopReason: set.stopReason,
  };
}

function compareWhenDesc(a: HistoryFeedRow, b: HistoryFeedRow): number {
  if (a.when === b.when) {
    return 0;
  }
  return a.when < b.when ? 1 : -1;
}

function passesFilter(
  set: HistorySetRecord,
  filter: HistoryFilter,
  graph: Record<string, Exercise>,
): boolean {
  switch (filter.kind) {
    case "all":
      return true;
    case "exercise":
      return set.exerciseId === filter.exerciseId;
    case "pattern":
      if (filter.exerciseIds.includes(set.exerciseId)) {
        return true;
      }
      return graph[set.exerciseId]?.pattern === filter.pattern;
  }
}
