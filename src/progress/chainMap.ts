import type { SessionTemplate } from "../domain/program";
import { SKILL_TIER_LABELS } from "../domain/skillTier";
import type { Exercise, ExerciseMemory, RuleId } from "../domain/types";
import { shouldAdvanceProgression } from "../rules/skillDose";

/** Below-floor sessions in a row before the resolver treats the lift as stalled. */
export const STALL_BELOW_FLOOR_SESSIONS = 2;

export type ChainGraph = Record<string, Exercise>;

export type ChainNodePosition = "easier" | "current" | "harder";

export interface ChainNode {
  id: string;
  name: string;
  position: ChainNodePosition;
}

export type ChainStatusKind = "no_history" | "stall" | "advance" | "hold";

export interface ChainStatus {
  kind: ChainStatusKind;
  /** One human line built from memory and the last resolve signals. */
  reason: string;
}

/** Rule ids from the most recent planned session slot on this exercise. */
export interface LastResolveSignal {
  ruleIds: readonly RuleId[];
}

export interface ChainMap {
  rootId: string;
  label: string;
  nodes: ChainNode[];
  currentId: string;
  status: ChainStatus;
}

/** Seed roots always shown, even when no template targets them. */
export const KEY_CHAIN_ROOT_IDS: readonly string[] = [
  "bodyweight_squat",
  "hip_hinge",
  "wall_handstand",
  "pullup",
  "hollow_hold",
];

const CHAIN_LABELS: Readonly<Record<string, string>> = {
  bodyweight_squat: "Squat",
  hip_hinge: "Hinge",
  elevated_pike: "Handstand",
  pullup_dead_hang: "Pull",
  dead_bug: "Core",
};

/**
 * Exercise ids from the easiest start of the primary chain through the hardest,
 * following easierId back to the root and harderId forward from it.
 * Returns [] when `anchorId` is not in the graph.
 */
export function buildChainIds(
  anchorId: string,
  graph: ChainGraph,
): string[] {
  if (!graph[anchorId]) {
    return [];
  }
  const rootId = walkToRootId(anchorId, graph);
  return walkHarderFrom(rootId, graph);
}

function walkToRootId(anchorId: string, graph: ChainGraph): string {
  const seen = new Set<string>([anchorId]);
  let cursorId = anchorId;
  for (;;) {
    const easierId = graph[cursorId]?.easierId;
    if (!easierId || !graph[easierId] || seen.has(easierId)) {
      return cursorId;
    }
    seen.add(easierId);
    cursorId = easierId;
  }
}

function walkHarderFrom(rootId: string, graph: ChainGraph): string[] {
  const ids = [rootId];
  const seen = new Set<string>(ids);
  let harderId = graph[rootId]?.harderId;
  while (harderId && graph[harderId] && !seen.has(harderId)) {
    ids.push(harderId);
    seen.add(harderId);
    harderId = graph[harderId].harderId;
  }
  return ids;
}

/**
 * Unique primary-chain roots for the given template targets plus key seed roots.
 * Order follows first appearance; chains that share a root appear once.
 */
export function listChainRootIds(
  templates: readonly SessionTemplate[],
  keyRootIds: readonly string[],
  graph: ChainGraph,
): string[] {
  const targetIds = templates.flatMap((template) => template.targetExerciseIds);
  const rootIds: string[] = [];
  for (const anchorId of [...targetIds, ...keyRootIds]) {
    const chainIds = buildChainIds(anchorId, graph);
    const rootId = chainIds[0];
    if (rootId && !rootIds.includes(rootId)) {
      rootIds.push(rootId);
    }
  }
  return rootIds;
}

/**
 * Chain nodes tagged easier / current / harder relative to `currentId`.
 * Throws if `currentId` is not part of `chainIds`.
 */
export function buildChainNodes(
  chainIds: readonly string[],
  currentId: string,
  graph: ChainGraph,
): ChainNode[] {
  const currentIndex = chainIds.indexOf(currentId);
  if (currentIndex < 0) {
    throw new Error(
      `Current exercise "${currentId}" is not on chain [${chainIds.join(", ")}]`,
    );
  }
  return chainIds.map((id, index) => ({
    id,
    name: graph[id]?.name ?? id,
    position: positionRelativeTo(index, currentIndex),
  }));
}

function positionRelativeTo(index: number, currentIndex: number): ChainNodePosition {
  if (index === currentIndex) {
    return "current";
  }
  return index < currentIndex ? "easier" : "harder";
}

/** True when memory holds any logged or declared signal for the exercise. */
export function hasTrainingSignal(memory: ExerciseMemory | undefined): boolean {
  if (!memory) {
    return false;
  }
  return (
    memory.bestReps !== undefined ||
    memory.declaredTier !== undefined ||
    memory.sessionsAtStandard > 0 ||
    memory.sessionsBelowFloor > 0
  );
}

/**
 * Where the athlete sits on the chain: the first plan-slot exercise found on it
 * (plan order), or any harder node they have already trained, whichever is
 * further along. Falls back to the root.
 */
export function pickCurrentId(
  chainIds: readonly string[],
  planExerciseIds: readonly string[],
  memories: Record<string, ExerciseMemory>,
): string {
  const startId = planExerciseIds.find((id) => chainIds.includes(id));
  let currentIndex = Math.max(0, startId ? chainIds.indexOf(startId) : 0);
  chainIds.forEach((id, index) => {
    if (index > currentIndex && hasTrainingSignal(memories[id])) {
      currentIndex = index;
    }
  });
  const currentId = chainIds[currentIndex];
  if (!currentId) {
    throw new Error("Cannot pick a current exercise on an empty chain");
  }
  return currentId;
}

/**
 * Memory-based stall / advance / hold verdict, mirroring resolver thresholds.
 * Light days come from morning readiness, so they appear only via `lastResolve`.
 */
export function inferChainStatus(
  exercise: Exercise,
  memory: ExerciseMemory | undefined,
  graph: ChainGraph,
  lastResolve?: LastResolveSignal,
): ChainStatus {
  const base = inferMemoryStatus(exercise, memory, graph);
  const lightDayNote = lightDaySuffix(lastResolve);
  return { kind: base.kind, reason: `${base.reason}${lightDayNote}` };
}

function inferMemoryStatus(
  exercise: Exercise,
  memory: ExerciseMemory | undefined,
  graph: ChainGraph,
): ChainStatus {
  if (!memory || !hasTrainingSignal(memory)) {
    return {
      kind: "no_history",
      reason: "No history yet — log a session or set a level in Library",
    };
  }
  if (memory.sessionsBelowFloor >= STALL_BELOW_FLOOR_SESSIONS) {
    return stallStatus(exercise, memory, graph);
  }
  if (shouldAdvanceProgression(exercise, memory)) {
    return advanceStatus(exercise, graph);
  }
  return holdStatus(memory);
}

function stallStatus(
  exercise: Exercise,
  memory: ExerciseMemory,
  graph: ChainGraph,
): ChainStatus {
  const easierName = nameOf(exercise.easierId, graph);
  const action = easierName
    ? `may step back to ${easierName}`
    : "no easier step on this chain";
  return {
    kind: "stall",
    reason: `Stall: below floor ×${memory.sessionsBelowFloor} — ${action}`,
  };
}

function advanceStatus(exercise: Exercise, graph: ChainGraph): ChainStatus {
  const harderName = nameOf(exercise.harderId, graph) ?? "next level";
  return {
    kind: "advance",
    reason: `Ready to advance to ${harderName} (standard met)`,
  };
}

function holdStatus(memory: ExerciseMemory): ChainStatus {
  const tier = memory.skillTier ?? memory.declaredTier;
  const tierNote = tier ? `${SKILL_TIER_LABELS[tier]} · ` : "";
  return {
    kind: "hold",
    reason: `Hold: ${tierNote}at standard ×${memory.sessionsAtStandard}`,
  };
}

function lightDaySuffix(lastResolve: LastResolveSignal | undefined): string {
  if (lastResolve?.ruleIds.includes("light_day")) {
    return " · last session was a light day";
  }
  return "";
}

function nameOf(
  exerciseId: string | undefined,
  graph: ChainGraph,
): string | undefined {
  if (!exerciseId) {
    return undefined;
  }
  return graph[exerciseId]?.name ?? exerciseId;
}

/** Display label for a chain, falling back to the root exercise name. */
export function chainLabelFor(rootId: string, graph: ChainGraph): string {
  return CHAIN_LABELS[rootId] ?? graph[rootId]?.name ?? rootId;
}

/** Assemble one chain map for the Progress view. */
export function buildChainMap(
  rootId: string,
  planExerciseIds: readonly string[],
  memories: Record<string, ExerciseMemory>,
  graph: ChainGraph,
  lastResolveFor: (exerciseId: string) => LastResolveSignal | undefined,
): ChainMap {
  const chainIds = buildChainIds(rootId, graph);
  const currentId = pickCurrentId(chainIds, planExerciseIds, memories);
  const exercise = graph[currentId];
  if (!exercise) {
    throw new Error(`Exercise "${currentId}" missing from graph`);
  }
  return {
    rootId,
    label: chainLabelFor(rootId, graph),
    nodes: buildChainNodes(chainIds, currentId, graph),
    currentId,
    status: inferChainStatus(
      exercise,
      memories[currentId],
      graph,
      lastResolveFor(currentId),
    ),
  };
}
