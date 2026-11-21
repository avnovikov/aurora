import { EXERCISE_GRAPH } from "../data/exerciseGraph";
import type { WarmupLevel } from "../domain/program";
import { tierIndex } from "../domain/skillTier";
import type { Exercise, ExerciseMemory, SkillTier } from "../domain/types";
import {
  libraryFamilyLadderIndex,
  type FamilyLadderIndex,
} from "../progress/familyLadderIndex";
import { effectiveSkillTier } from "./skillDose";

export const WARMUP_LEVELS: readonly WarmupLevel[] = ["beginner", "intermediate", "advanced"];

/** Used when the athlete's tier in the target family is unknown. */
export const DEFAULT_WARMUP_LEVEL: WarmupLevel = "beginner";

/** Three warm-up bands: novice/beginner → beginner, advanced/elite → advanced. */
export function warmupLevelFromTier(tier: SkillTier | undefined): WarmupLevel {
  switch (tier) {
    case "intermediate":
      return "intermediate";
    case "advanced":
    case "elite":
      return "advanced";
    default:
      return DEFAULT_WARMUP_LEVEL;
  }
}

export interface WarmupLevelInput {
  /** The session's target skills (e.g. pistol_squat); each names a family. */
  targetExerciseIds: readonly string[];
  memories: Readonly<Record<string, ExerciseMemory>>;
  /** Injected in tests; defaults to the Library ladder index. */
  index?: FamilyLadderIndex;
  graph?: Readonly<Record<string, Exercise>>;
}

/**
 * Warm-up level for a session: the athlete's highest known tier among the
 * exercises in each target's family (skill memory, which Library declares
 * already cascade down the ladder), in three bands. With several target
 * families (Full body) the lowest family wins, so no part of the warm-up is
 * pitched above the athlete's weakest area. Unknown → beginner.
 */
export function warmupLevelForTargets(
  targetExerciseIds: readonly string[],
  memories: Readonly<Record<string, ExerciseMemory>>,
): WarmupLevel {
  return warmupLevelFor({ targetExerciseIds, memories });
}

export function warmupLevelFor(input: WarmupLevelInput): WarmupLevel {
  const index = input.index ?? libraryFamilyLadderIndex();
  const graph = input.graph ?? EXERCISE_GRAPH;
  const families = new Set(
    input.targetExerciseIds.flatMap((id) => {
      const familyId = index.byId.get(id)?.familyId;
      return familyId ? [familyId] : [];
    }),
  );
  if (families.size === 0) {
    return DEFAULT_WARMUP_LEVEL;
  }
  const levels = [...families].map((familyId) => {
    const memberIds = (index.byFamily.get(familyId) ?? []).map((member) => member.id);
    return warmupLevelFromTier(highestKnownTier(memberIds, input.memories, graph));
  });
  return levels.reduce((lowest, level) =>
    WARMUP_LEVELS.indexOf(level) < WARMUP_LEVELS.indexOf(lowest) ? level : lowest,
  );
}

/** Highest tier the athlete has shown or declared on any of these moves. */
export function highestKnownTier(
  exerciseIds: readonly string[],
  memories: Readonly<Record<string, ExerciseMemory>>,
  graph: Readonly<Record<string, Exercise>> = EXERCISE_GRAPH,
): SkillTier | undefined {
  let best: SkillTier | undefined;
  for (const id of exerciseIds) {
    const tier = knownTier(memories[id], graph[id]);
    if (tier && (!best || tierIndex(tier) > tierIndex(best))) {
      best = tier;
    }
  }
  return best;
}

function knownTier(memory: ExerciseMemory | undefined, exercise: Exercise | undefined): SkillTier | undefined {
  if (!memory) {
    return undefined;
  }
  const hasSignal =
    memory.skillTier !== undefined || memory.declaredTier !== undefined || (memory.bestReps ?? 0) > 0;
  if (!hasSignal) {
    return undefined;
  }
  return exercise ? effectiveSkillTier(memory, exercise) : (memory.skillTier ?? memory.declaredTier);
}
