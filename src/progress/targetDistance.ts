import { SEED_GRAPH, type SeedExercise } from "../data/seed";

export interface TargetDistance {
  targetId: string;
  targetName: string;
  currentId: string;
  currentName: string;
  stepsToTarget: number | null;
  reachable: boolean;
}

/**
 * Count primary harder edges from current exercise to target.
 * null steps = disconnected / unknown.
 */
export function distanceToTarget(
  currentId: string,
  targetId: string,
): TargetDistance {
  const current = SEED_GRAPH[currentId];
  const target = SEED_GRAPH[targetId];
  if (!current || !target) {
    return missingDistance(currentId, targetId, current, target);
  }
  if (currentId === targetId) {
    return {
      targetId,
      targetName: target.name,
      currentId,
      currentName: current.name,
      stepsToTarget: 0,
      reachable: true,
    };
  }
  const steps = walkHarderSteps(current, targetId);
  return {
    targetId,
    targetName: target.name,
    currentId,
    currentName: current.name,
    stepsToTarget: steps,
    reachable: steps !== null,
  };
}

function walkHarderSteps(start: SeedExercise, targetId: string): number | null {
  let steps = 0;
  let cursor = start;
  const seen = new Set<string>([start.id]);
  while (cursor.harderId && !seen.has(cursor.harderId)) {
    steps += 1;
    seen.add(cursor.harderId);
    if (cursor.harderId === targetId) {
      return steps;
    }
    const harder = SEED_GRAPH[cursor.harderId];
    if (!harder) {
      return null;
    }
    cursor = harder;
  }
  return null;
}

function missingDistance(
  currentId: string,
  targetId: string,
  current: SeedExercise | undefined,
  target: SeedExercise | undefined,
): TargetDistance {
  return {
    targetId,
    targetName: target?.name ?? targetId,
    currentId,
    currentName: current?.name ?? currentId,
    stepsToTarget: null,
    reachable: false,
  };
}
