import { nextSkillTier } from "../domain/skillTier";
import { displayExerciseName } from "../library/displayName";
import type { Exercise, ExerciseMemory } from "../domain/types";
import { hasTrainingSignal } from "./chainMap";
import { withinTierProgress } from "./withinTierProgress";

export interface WeakLinkCard {
  exerciseId: string;
  exerciseName: string;
  withinPercent: number;
  /** Average within-% across all trained standardised moves. */
  cohortAveragePercent: number;
  deltaPercent: number;
  bestReps: number;
  nextTierBar: number | null;
  reason: string;
}

export interface WeakLinkBoardModel {
  cards: WeakLinkCard[];
}

interface ScoredMove {
  exerciseId: string;
  exerciseName: string;
  withinPercent: number;
  bestReps: number;
  nextTierBar: number | null;
}

const MAX_CARDS = 5;

/**
 * Rank trained moves by how far below the athlete's typical within-tier fill.
 */
export function buildWeakLinkBoard(input: {
  graph: Record<string, Exercise>;
  memories: Record<string, ExerciseMemory>;
}): WeakLinkBoardModel {
  const scored = scoreTrainedMoves(input.graph, input.memories);
  if (scored.length === 0) {
    return { cards: [] };
  }

  const cohortAveragePercent = Math.round(averageWithinPercent(scored));
  const cards = scored
    .map((row) => toWeakLinkCard(row, cohortAveragePercent))
    .filter((card) => card.deltaPercent < 0)
    .sort((a, b) => a.deltaPercent - b.deltaPercent)
    .slice(0, MAX_CARDS);

  return { cards };
}

function scoreTrainedMoves(
  graph: Record<string, Exercise>,
  memories: Record<string, ExerciseMemory>,
): ScoredMove[] {
  const scored: ScoredMove[] = [];

  for (const [id, memory] of Object.entries(memories)) {
    if (!hasTrainingSignal(memory) || memory.bestReps === undefined) {
      continue;
    }
    const exercise = graph[id];
    if (!exercise?.standards) {
      continue;
    }
    const progress = withinTierProgress(memory.bestReps, exercise.standards);
    const next = nextSkillTier(progress.tier);
    scored.push({
      exerciseId: id,
      exerciseName: displayExerciseName(exercise.name),
      withinPercent: progress.withinPercent,
      bestReps: memory.bestReps,
      nextTierBar: next ? exercise.standards[next] : null,
    });
  }

  return scored;
}

function toWeakLinkCard(
  row: ScoredMove,
  cohortAveragePercent: number,
): WeakLinkCard {
  const deltaPercent = row.withinPercent - cohortAveragePercent;
  return {
    ...row,
    cohortAveragePercent,
    deltaPercent,
    reason: reasonFor(deltaPercent, row.bestReps, row.nextTierBar),
  };
}

function averageWithinPercent(rows: readonly ScoredMove[]): number {
  if (rows.length === 0) {
    throw new Error("averageWithinPercent requires at least one scored move");
  }
  let sum = 0;
  for (const row of rows) {
    sum += row.withinPercent;
  }
  return sum / rows.length;
}

function reasonFor(
  deltaPercent: number,
  bestReps: number,
  nextTierBar: number | null,
): string {
  const delta = `${deltaPercent}% vs your level average`;
  if (nextTierBar === null) {
    return delta;
  }
  return `Best ${bestReps} · next bar ${nextTierBar} · ${delta}`;
}
