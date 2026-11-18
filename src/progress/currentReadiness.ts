import type { SeedExercise } from "../data/seed";
import type { SessionTemplate } from "../domain/program";
import { nextSkillTier, SKILL_TIER_LABELS } from "../domain/skillTier";
import type { Exercise, ExerciseMemory } from "../domain/types";
import { displayExerciseName, displayNameOf } from "../library/displayName";
import { pickLevelAppropriateStep } from "../plan/pathPlacement";
import {
  buildChainIds,
  hasTrainingSignal,
  pickCurrentId,
  type ChainGraph,
} from "./chainMap";
import { withinTierProgress } from "./withinTierProgress";

export type ReadinessKind = "explicit" | "implicit";

export interface CurrentReadinessRow {
  goalId: string;
  goalName: string;
  kind: ReadinessKind;
  currentExerciseId: string;
  currentExerciseName: string;
  bestReps: number | null;
  doseBar: number | null;
  dosePercent: number;
  criterion: string;
}

export interface CurrentReadinessModel {
  rows: CurrentReadinessRow[];
}

interface ResolvedRung {
  exerciseId: string;
  exercise: Exercise;
  memory: ExerciseMemory | undefined;
}

const MAX_ROWS = 6;
const MAX_IMPLICIT = 3;

/**
 * Few current goals: explicit plan targets + implicit next-level on active rungs.
 */
export function buildCurrentReadiness(input: {
  templates: readonly SessionTemplate[];
  graph: Record<string, Exercise>;
  memories: Record<string, ExerciseMemory>;
}): CurrentReadinessModel {
  const planExerciseIds = input.templates.flatMap((template) =>
    template.slots.map((slot) => slot.exerciseId),
  );
  const explicit = collectExplicit(
    input.templates,
    input.graph,
    input.memories,
    planExerciseIds,
  );
  const usedCurrent = new Set(explicit.map((row) => row.currentExerciseId));
  const implicit = collectImplicit(input.memories, input.graph, usedCurrent);
  return { rows: [...explicit, ...implicit].slice(0, MAX_ROWS) };
}

function collectExplicit(
  templates: readonly SessionTemplate[],
  graph: Record<string, Exercise>,
  memories: Record<string, ExerciseMemory>,
  planExerciseIds: readonly string[],
): CurrentReadinessRow[] {
  const seen = new Set<string>();
  const rows: CurrentReadinessRow[] = [];

  for (const template of templates) {
    for (const targetId of template.targetExerciseIds) {
      if (seen.has(targetId) || !graph[targetId]) {
        continue;
      }
      seen.add(targetId);
      rows.push(
        readinessForTarget(targetId, graph, memories, planExerciseIds),
      );
    }
  }

  return rows;
}

function collectImplicit(
  memories: Record<string, ExerciseMemory>,
  graph: Record<string, Exercise>,
  excludeCurrentIds: ReadonlySet<string>,
): CurrentReadinessRow[] {
  const rows: CurrentReadinessRow[] = [];

  for (const [id, memory] of Object.entries(memories)) {
    if (!hasTrainingSignal(memory) || memory.bestReps === undefined) {
      continue;
    }
    if (excludeCurrentIds.has(id)) {
      continue;
    }
    const exercise = graph[id];
    if (!exercise?.standards) {
      continue;
    }
    const progress = withinTierProgress(memory.bestReps, exercise.standards);
    const next = nextSkillTier(progress.tier);
    if (!next) {
      continue;
    }
    const name = displayExerciseName(exercise.name);
    const nextBar = exercise.standards[next];
    rows.push({
      goalId: `implicit:${id}`,
      goalName: `Next level · ${name}`,
      kind: "implicit",
      currentExerciseId: id,
      currentExerciseName: name,
      bestReps: memory.bestReps,
      doseBar: nextBar,
      dosePercent: progress.withinPercent,
      criterion: `${progress.withinPercent}% through ${SKILL_TIER_LABELS[progress.tier]} · need ${nextBar} for ${SKILL_TIER_LABELS[next]}`,
    });
  }

  return rows
    .sort((a, b) => b.dosePercent - a.dosePercent)
    .slice(0, MAX_IMPLICIT);
}

function readinessForTarget(
  targetId: string,
  graph: Record<string, Exercise>,
  memories: Record<string, ExerciseMemory>,
  planExerciseIds: readonly string[],
): CurrentReadinessRow {
  const rung = resolveTargetRung(targetId, graph, memories, planExerciseIds);
  return doseRowForExercise(
    targetId,
    rung.exerciseId,
    rung.exercise,
    rung.memory,
    displayNameOf(targetId, graph),
  );
}

function resolveTargetRung(
  targetId: string,
  graph: Record<string, Exercise>,
  memories: Record<string, ExerciseMemory>,
  planExerciseIds: readonly string[],
): ResolvedRung {
  const chainIds = buildChainIds(targetId, graph as ChainGraph);
  if (chainIds.length === 0) {
    return {
      exerciseId: targetId,
      exercise: graph[targetId]!,
      memory: memories[targetId],
    };
  }

  const trained = chainIds.some((id) => hasTrainingSignal(memories[id]));
  if (!trained) {
    const athleteTier =
      memories[targetId]?.skillTier ?? memories[targetId]?.declaredTier;
    const startId = pickLevelAppropriateStep(
      targetId,
      graph as Record<string, SeedExercise>,
      athleteTier,
      chainIds[0]!,
    );
    return {
      exerciseId: startId,
      exercise: graph[startId] ?? graph[targetId]!,
      memory: memories[startId],
    };
  }

  const currentId = pickCurrentId(chainIds, planExerciseIds, memories);
  return {
    exerciseId: currentId,
    exercise: graph[currentId]!,
    memory: memories[currentId],
  };
}

function doseRowForExercise(
  goalId: string,
  exerciseId: string,
  exercise: Exercise,
  memory: ExerciseMemory | undefined,
  goalName: string,
): CurrentReadinessRow {
  const currentName = displayExerciseName(exercise.name);
  if (!exercise.standards || memory?.bestReps === undefined) {
    return {
      goalId,
      goalName,
      kind: "explicit",
      currentExerciseId: exerciseId,
      currentExerciseName: currentName,
      bestReps: null,
      doseBar: null,
      dosePercent: 0,
      criterion: "Not started on this rung yet",
    };
  }

  const progress = withinTierProgress(memory.bestReps, exercise.standards);
  const next = nextSkillTier(progress.tier);
  const doseBar = next ? exercise.standards[next] : exercise.standards.elite;
  const criterion = next
    ? `Best ${memory.bestReps} / ${doseBar} · ${progress.withinPercent}% through ${SKILL_TIER_LABELS[progress.tier]}`
    : "At elite on this rung";

  return {
    goalId,
    goalName,
    kind: "explicit",
    currentExerciseId: exerciseId,
    currentExerciseName: currentName,
    bestReps: memory.bestReps,
    doseBar,
    dosePercent: progress.withinPercent,
    criterion,
  };
}
