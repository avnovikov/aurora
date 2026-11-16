import type { SeedExercise } from "../data/seed";
import type { SessionTemplate } from "../domain/program";
import type { ExerciseMemory } from "../domain/types";
import { pickLevelAppropriateStep } from "../plan/pathPlacement";
import {
  buildChainIds,
  hasTrainingSignal,
  inferChainStatus,
  pickCurrentId,
  type ChainGraph,
  type ChainStatus,
  type LastResolveSignal,
} from "./chainMap";
import { distanceToTarget } from "./targetDistance";

export type PlanProgressPhase = "not_started" | "active";

export interface PathPreviewStep {
  id: string;
  name: string;
  marker: "start" | "now" | "target" | "step";
}

export interface PlanProgressCard {
  targetId: string;
  targetName: string;
  templateNames: string[];
  phase: PlanProgressPhase;
  /** Where training sits (or suggested start when not started). */
  currentId: string;
  currentName: string;
  /** Personal best on the Now / suggested-start step, when logged. */
  personalBestReps?: number;
  personalBestIsHold: boolean;
  nextId: string | null;
  nextName: string | null;
  stepsToTarget: number | null;
  pathPreview: PathPreviewStep[];
  status: ChainStatus;
  /**
   * Set when an earlier card already shows `currentId` as its Now step (two
   * targets on one path, e.g. Pull-up and Muscle-up): that card's target name.
   */
  nowShownUnder?: string;
}

export interface PlanProgressModel {
  cards: PlanProgressCard[];
}

/**
 * Progress content from plan north-star targets only (no generic seed chains).
 */
export function buildPlanProgress(input: {
  templates: readonly SessionTemplate[];
  graph: ChainGraph;
  memories: Record<string, ExerciseMemory>;
  lastResolveFor?: (exerciseId: string) => LastResolveSignal | undefined;
}): PlanProgressModel {
  const targets = collectTargets(input.templates, input.graph);
  const planExerciseIds = input.templates.flatMap((template) =>
    template.slots.map((slot) => slot.exerciseId),
  );
  const cards = targets.map((target) =>
    buildCard(target, planExerciseIds, input.graph, input.memories, input.lastResolveFor),
  );
  return { cards: pointSharedNowToFirstCard(cards) };
}

/** Display only: the first card showing an exercise as Now keeps it; later ones point back. */
function pointSharedNowToFirstCard(cards: readonly PlanProgressCard[]): PlanProgressCard[] {
  const ownerByNowId = new Map<string, string>();
  return cards.map((card) => {
    const owner = ownerByNowId.get(card.currentId);
    if (owner !== undefined) {
      return { ...card, nowShownUnder: owner };
    }
    ownerByNowId.set(card.currentId, card.targetName);
    return card;
  });
}

interface TargetRef {
  id: string;
  name: string;
  templateNames: string[];
}

function collectTargets(
  templates: readonly SessionTemplate[],
  graph: ChainGraph,
): TargetRef[] {
  const byId = new Map<string, TargetRef>();
  for (const template of templates) {
    for (const targetId of template.targetExerciseIds) {
      const exercise = graph[targetId];
      if (!exercise) {
        continue;
      }
      const existing = byId.get(targetId);
      if (existing) {
        if (!existing.templateNames.includes(template.name)) {
          existing.templateNames.push(template.name);
        }
        continue;
      }
      byId.set(targetId, {
        id: targetId,
        name: exercise.name,
        templateNames: [template.name],
      });
    }
  }
  return [...byId.values()];
}

function buildCard(
  target: TargetRef,
  planExerciseIds: readonly string[],
  graph: ChainGraph,
  memories: Record<string, ExerciseMemory>,
  lastResolveFor?: (exerciseId: string) => LastResolveSignal | undefined,
): PlanProgressCard {
  const chainIds = buildChainIds(target.id, graph);
  if (chainIds.length === 0) {
    return orphanTargetCard(target);
  }
  if (!chainIds.some((id) => hasTrainingSignal(memories[id]))) {
    return notStartedCard(target, chainIds, graph, memories);
  }
  return activeCard(target, chainIds, planExerciseIds, graph, memories, lastResolveFor);
}

function notStartedCard(
  target: TargetRef,
  chainIds: readonly string[],
  graph: ChainGraph,
  memories: Record<string, ExerciseMemory>,
): PlanProgressCard {
  const athleteTier =
    memories[target.id]?.skillTier ??
    memories[target.id]?.declaredTier ??
    findDeclaredOnChain(chainIds, memories);
  const startId = pickLevelAppropriateStep(
    target.id,
    graph as Record<string, SeedExercise>,
    athleteTier,
    chainIds[0]!,
  );
  const start = graph[startId] ?? graph[chainIds[0]!];
  const nextId = nextOnChain(start?.harderId, chainIds);
  return {
    targetId: target.id,
    targetName: target.name,
    templateNames: target.templateNames,
    phase: "not_started",
    currentId: startId,
    currentName: start?.name ?? startId,
    ...personalBestFields(startId, graph, memories),
    nextId,
    nextName: nameOrNull(graph, nextId),
    stepsToTarget: distanceToTarget(startId, target.id).stepsToTarget,
    pathPreview: buildPathPreview(chainIds, graph, startId, null, target.id),
    status: {
      kind: "no_history",
      reason: "Not started on this path yet",
    },
  };
}

function activeCard(
  target: TargetRef,
  chainIds: readonly string[],
  planExerciseIds: readonly string[],
  graph: ChainGraph,
  memories: Record<string, ExerciseMemory>,
  lastResolveFor?: (exerciseId: string) => LastResolveSignal | undefined,
): PlanProgressCard {
  const currentId = pickCurrentId(chainIds, planExerciseIds, memories);
  const current = graph[currentId]!;
  const currentIndex = chainIds.indexOf(currentId);
  const nextId = currentIndex >= 0 ? (chainIds[currentIndex + 1] ?? null) : null;
  return {
    targetId: target.id,
    targetName: target.name,
    templateNames: target.templateNames,
    phase: "active",
    currentId,
    currentName: current.name,
    ...personalBestFields(currentId, graph, memories),
    nextId,
    nextName: nameOrNull(graph, nextId),
    stepsToTarget: distanceToTarget(currentId, target.id).stepsToTarget,
    pathPreview: buildPathPreview(chainIds, graph, null, currentId, target.id),
    status: inferChainStatus(current, memories[currentId], graph, lastResolveFor?.(currentId)),
  };
}

function nextOnChain(
  harderId: string | undefined,
  chainIds: readonly string[],
): string | null {
  if (!harderId || !chainIds.includes(harderId)) {
    return null;
  }
  return harderId;
}

function nameOrNull(graph: ChainGraph, id: string | null): string | null {
  if (!id) {
    return null;
  }
  return graph[id]?.name ?? id;
}

function orphanTargetCard(target: TargetRef): PlanProgressCard {
  return {
    targetId: target.id,
    targetName: target.name,
    templateNames: target.templateNames,
    phase: "not_started",
    currentId: target.id,
    currentName: target.name,
    personalBestIsHold: false,
    nextId: null,
    nextName: null,
    stepsToTarget: 0,
    pathPreview: [{ id: target.id, name: target.name, marker: "target" }],
    status: {
      kind: "no_history",
      reason: "No progression path linked for this target yet",
    },
  };
}

function personalBestFields(
  exerciseId: string,
  graph: ChainGraph,
  memories: Record<string, ExerciseMemory>,
): Pick<PlanProgressCard, "personalBestReps" | "personalBestIsHold"> {
  const exercise = graph[exerciseId] as SeedExercise | undefined;
  return {
    personalBestReps: memories[exerciseId]?.bestReps,
    personalBestIsHold: exercise?.effort === "hold",
  };
}

function findDeclaredOnChain(
  chainIds: readonly string[],
  memories: Record<string, ExerciseMemory>,
): ExerciseMemory["skillTier"] {
  for (const id of chainIds) {
    const memory = memories[id];
    if (memory?.skillTier || memory?.declaredTier) {
      return memory.skillTier ?? memory.declaredTier;
    }
  }
  return undefined;
}

/** Compact path: keep start/now/target plus a few neighbours (max ~5 nodes). */
export function buildPathPreview(
  chainIds: readonly string[],
  graph: ChainGraph,
  startId: string | null,
  nowId: string | null,
  targetId: string,
): PathPreviewStep[] {
  if (chainIds.length === 0) {
    return [];
  }
  const focusId = nowId ?? startId ?? chainIds[0]!;
  const focusIndex = Math.max(0, chainIds.indexOf(focusId));
  const targetIndex = Math.max(0, chainIds.indexOf(targetId));
  const keep = new Set<number>([0, focusIndex, targetIndex, chainIds.length - 1]);
  if (focusIndex > 0) {
    keep.add(focusIndex - 1);
  }
  if (focusIndex < chainIds.length - 1) {
    keep.add(focusIndex + 1);
  }
  const indices = [...keep].filter((i) => i >= 0 && i < chainIds.length).sort((a, b) => a - b);

  return indices.map((index) => {
    const id = chainIds[index]!;
    return {
      id,
      name: graph[id]?.name ?? id,
      marker: markerFor(id, startId, nowId, targetId),
    };
  });
}

function markerFor(
  id: string,
  startId: string | null,
  nowId: string | null,
  targetId: string,
): PathPreviewStep["marker"] {
  if (id === targetId) {
    return "target";
  }
  if (nowId && id === nowId) {
    return "now";
  }
  if (startId && id === startId) {
    return "start";
  }
  return "step";
}
