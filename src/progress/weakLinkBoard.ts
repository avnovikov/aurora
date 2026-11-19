import { nextSkillTier, SKILL_TIER_LABELS } from "../domain/skillTier";
import type {
  Exercise,
  ExerciseMemory,
  ExerciseStandards,
  SkillTier,
} from "../domain/types";
import { displayExerciseName } from "../library/displayName";
import type { PlanLevel } from "../plan/planLevel";
import { hasTrainingSignal } from "./chainMap";
import { withinTierProgress } from "./withinTierProgress";

export interface WeakLinkCard {
  exerciseId: string;
  exerciseName: string;
  withinPercent: number;
  /** Cohort within-% (auto) or 100 when scoring against a declared plan bar. */
  baselinePercent: number;
  deltaPercent: number;
  bestReps: number;
  /** Next-tier bar (auto) or declared plan-level bar. */
  targetBar: number | null;
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
  targetBar: number | null;
  barLabel: string | null;
}

const MAX_CARDS = 3;
const DECLARED_LEVEL_BASELINE = 100;

type TrainedMoveScorer = (
  id: string,
  exercise: Exercise,
  standards: ExerciseStandards,
  bestReps: number,
) => ScoredMove | null;

/**
 * Rank trained moves that lag: vs declared plan-level bars, or (on auto) vs
 * the athlete's typical within-tier fill.
 */
export function buildWeakLinkBoard(input: {
  graph: Record<string, Exercise>;
  memories: Record<string, ExerciseMemory>;
  planLevel?: PlanLevel;
}): WeakLinkBoardModel {
  const planLevel = input.planLevel ?? "auto";
  const isAuto = planLevel === "auto";
  const scored = isAuto
    ? scoreAgainstCohort(input.graph, input.memories)
    : scoreAgainstPlanLevel(input.graph, input.memories, planLevel);

  if (scored.length === 0) {
    return { cards: [] };
  }

  const baselinePercent = isAuto
    ? Math.round(averageWithinPercent(scored))
    : DECLARED_LEVEL_BASELINE;

  const cards = scored
    .map((row) => toWeakLinkCard(row, baselinePercent, isAuto))
    .filter((card) => card.deltaPercent < 0)
    .sort((a, b) => a.deltaPercent - b.deltaPercent || a.bestReps - b.bestReps)
    .slice(0, MAX_CARDS);

  return { cards };
}

function mapTrainedMoves(
  graph: Record<string, Exercise>,
  memories: Record<string, ExerciseMemory>,
  score: TrainedMoveScorer,
): ScoredMove[] {
  const scored: ScoredMove[] = [];
  for (const [id, memory] of Object.entries(memories)) {
    if (!hasTrainingSignal(memory) || memory.bestReps === undefined) {
      continue;
    }
    const exercise = graph[id];
    const standards = exercise?.standards;
    if (!exercise || !standards) {
      continue;
    }
    const row = score(id, exercise, standards, memory.bestReps);
    if (row !== null) {
      scored.push(row);
    }
  }
  return scored;
}

function scoreAgainstCohort(
  graph: Record<string, Exercise>,
  memories: Record<string, ExerciseMemory>,
): ScoredMove[] {
  return mapTrainedMoves(graph, memories, (id, exercise, standards, bestReps) => {
    const progress = withinTierProgress(bestReps, standards);
    const next = nextSkillTier(progress.tier);
    return {
      exerciseId: id,
      exerciseName: displayExerciseName(exercise.name),
      withinPercent: progress.withinPercent,
      bestReps,
      targetBar: next ? standards[next] : null,
      barLabel: next ? "next bar" : null,
    };
  });
}

function scoreAgainstPlanLevel(
  graph: Record<string, Exercise>,
  memories: Record<string, ExerciseMemory>,
  planLevel: SkillTier,
): ScoredMove[] {
  const levelLabel = SKILL_TIER_LABELS[planLevel];
  return mapTrainedMoves(graph, memories, (id, exercise, standards, bestReps) => {
    const bar = standards[planLevel];
    if (!Number.isFinite(bar) || bar <= 0) {
      return null;
    }
    return {
      exerciseId: id,
      exerciseName: displayExerciseName(exercise.name),
      withinPercent: percentOfBar(bestReps, bar),
      bestReps,
      targetBar: bar,
      barLabel: levelLabel,
    };
  });
}

/** Share of the declared/target bar, capped at 100%. */
function percentOfBar(bestReps: number, bar: number): number {
  assertPositiveBar(bar);
  return Math.min(DECLARED_LEVEL_BASELINE, Math.round((bestReps / bar) * 100));
}

function assertPositiveBar(bar: number): void {
  if (!Number.isFinite(bar) || bar <= 0) {
    throw new Error(`target bar must be a positive number; got ${bar}`);
  }
}

function toWeakLinkCard(
  row: ScoredMove,
  baselinePercent: number,
  isAuto: boolean,
): WeakLinkCard {
  const deltaPercent = row.withinPercent - baselinePercent;
  return {
    exerciseId: row.exerciseId,
    exerciseName: row.exerciseName,
    withinPercent: row.withinPercent,
    baselinePercent,
    deltaPercent,
    bestReps: row.bestReps,
    targetBar: row.targetBar,
    reason: reasonFor(deltaPercent, row, isAuto),
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
  row: ScoredMove,
  isAuto: boolean,
): string {
  const delta = isAuto
    ? `${deltaPercent}% vs your level average`
    : `${deltaPercent}% vs ${row.barLabel ?? "plan level"}`;

  if (row.targetBar === null || row.barLabel === null) {
    return delta;
  }
  return `Best ${row.bestReps} · ${row.barLabel} ${row.targetBar} · ${delta}`;
}
