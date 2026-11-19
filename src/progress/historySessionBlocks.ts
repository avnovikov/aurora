import type {
  HistoryEntry,
  HistoryPulse,
  HistorySetRecord,
  SessionEvaluation,
} from "../domain/program";
import type { Exercise } from "../domain/types";
import { displayNameOf } from "../library/displayName";
import {
  type HistoryFeedRow,
  type HistoryFilter,
} from "./historyFeed";

export interface HistoryExerciseRollup {
  exerciseId: string;
  exerciseName: string;
  completedRepsBySet: number[];
  averageBpm?: number;
}

export interface HistorySessionBlock {
  sessionId: string;
  templateName: string;
  completedAt: string;
  evaluation: SessionEvaluation;
  exercises: HistoryExerciseRollup[];
  pulse?: HistoryPulse;
  legacy: boolean;
  /** Present only for legacy sessions — same rows as today’s set feed. */
  legacyRows: HistoryFeedRow[];
}

export interface HistorySessionBlocksModel {
  filter: HistoryFilter;
  blocks: HistorySessionBlock[];
  hasLegacyOnly: boolean;
}

/**
 * Group history into session blocks (newest first) with exercise rollups.
 * Legacy sessions keep summary rows; no fabricated reps.
 */
export function buildHistorySessionBlocks(input: {
  history: readonly HistoryEntry[];
  graph: Record<string, Exercise>;
  filter?: HistoryFilter;
}): HistorySessionBlocksModel {
  const filter = input.filter ?? { kind: "all" };
  const blocks: HistorySessionBlock[] = [];
  let hasLegacyOnly = false;

  for (const session of input.history) {
    const built = blockForSession(session, input.graph, filter);
    if (!built) {
      continue;
    }
    if (built.legacy) {
      hasLegacyOnly = true;
    }
    blocks.push(built);
  }

  blocks.sort(compareCompletedAtDesc);
  return { filter, blocks, hasLegacyOnly };
}

function blockForSession(
  session: HistoryEntry,
  graph: Record<string, Exercise>,
  filter: HistoryFilter,
): HistorySessionBlock | null {
  const sets = session.sets;
  if (!sets || sets.length === 0) {
    return legacyBlockForSession(session, graph, filter);
  }
  const exercises = rollupExercises(session, sets, graph, filter);
  if (exercises.length === 0) {
    return null;
  }
  return {
    sessionId: session.id,
    templateName: session.templateName,
    completedAt: session.completedAt,
    evaluation: session.evaluation,
    exercises,
    legacy: false,
    legacyRows: [],
    ...sessionPulseFields(session),
  };
}

function legacyBlockForSession(
  session: HistoryEntry,
  graph: Record<string, Exercise>,
  filter: HistoryFilter,
): HistorySessionBlock | null {
  if (session.exerciseIds.length === 0 && session.setCount === 0) {
    return null;
  }
  const legacyRows = legacyRowsForSession(session, graph, filter);
  if (legacyRows.length === 0) {
    return null;
  }
  return {
    sessionId: session.id,
    templateName: session.templateName,
    completedAt: session.completedAt,
    evaluation: session.evaluation,
    exercises: [],
    legacy: true,
    legacyRows,
    ...sessionPulseFields(session),
  };
}

function sessionPulseFields(
  session: HistoryEntry,
): { pulse: HistoryPulse } | Record<string, never> {
  return sessionPulseIfPresent(session) ?? {};
}

function rollupExercises(
  session: HistoryEntry,
  sets: readonly HistorySetRecord[],
  graph: Record<string, Exercise>,
  filter: HistoryFilter,
): HistoryExerciseRollup[] {
  const order: string[] = [];
  const byId = new Map<
    string,
    { reps: number[]; setBpms: number[] }
  >();

  for (const set of sets) {
    if (!passesExerciseFilter(set.exerciseId, filter, graph)) {
      continue;
    }
    let bucket = byId.get(set.exerciseId);
    if (!bucket) {
      bucket = { reps: [], setBpms: [] };
      byId.set(set.exerciseId, bucket);
      order.push(set.exerciseId);
    }
    bucket.reps.push(set.completedReps);
    if (set.averageBpm !== undefined) {
      bucket.setBpms.push(set.averageBpm);
    }
  }

  const byExerciseAvg = new Map(
    (session.pulse?.byExercise ?? []).map((row) => [
      row.exerciseId,
      row.averageBpm,
    ]),
  );

  return order.map((exerciseId) => {
    const bucket = byId.get(exerciseId)!;
    const fromPulse = byExerciseAvg.get(exerciseId);
    const fromSets = meanWhole(bucket.setBpms);
    const averageBpm = fromPulse ?? fromSets ?? undefined;
    return {
      exerciseId,
      exerciseName: displayNameOf(exerciseId, graph),
      completedRepsBySet: bucket.reps,
      ...(averageBpm !== undefined ? { averageBpm } : {}),
    };
  });
}

function legacyRowsForSession(
  session: HistoryEntry,
  graph: Record<string, Exercise>,
  filter: HistoryFilter,
): HistoryFeedRow[] {
  return session.exerciseIds
    .filter((exerciseId) => passesExerciseFilter(exerciseId, filter, graph))
    .map((exerciseId) => ({
      key: `${session.id}:legacy:${exerciseId}`,
      kind: "legacy_session" as const,
      exerciseId,
      exerciseName: displayNameOf(exerciseId, graph),
      setIndex: 0,
      completedReps: 0,
      prescribedReps: 0,
      when: session.completedAt,
      sessionId: session.id,
      stopReason: "completed",
      sessionSetCount: session.setCount,
    }));
}

function sessionPulseIfPresent(
  session: HistoryEntry,
): { pulse: HistoryPulse } | undefined {
  if (!session.pulse || session.pulse.series.length === 0) {
    return undefined;
  }
  return { pulse: session.pulse };
}

function meanWhole(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sum = values.reduce((acc, n) => acc + n, 0);
  return Math.round(sum / values.length);
}

function compareCompletedAtDesc(
  a: HistorySessionBlock,
  b: HistorySessionBlock,
): number {
  if (a.completedAt === b.completedAt) {
    return 0;
  }
  return a.completedAt < b.completedAt ? 1 : -1;
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
