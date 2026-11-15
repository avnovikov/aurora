import { maxTier, SKILL_TIERS, tierIndex } from "../domain/skillTier";
import type { ExerciseMemory, SkillTier } from "../domain/types";
import {
  libraryFamilyLadderIndex,
  type FamilyLadderIndex,
} from "./familyLadderIndex";

export interface CascadeFamilyTiersResult {
  memories: Record<string, ExerciseMemory>;
  /** Related exercise ids whose tier floor was raised (not the source). */
  raisedIds: string[];
}

export interface CascadeFamilyTiersInput {
  memories: Record<string, ExerciseMemory>;
  sourceId: string;
  declaredTier: SkillTier;
  /** Injected in tests; defaults to the Library catalogue index. */
  index?: FamilyLadderIndex;
}

/**
 * Raise same-or-easier family members to a rank-aware skillTier floor after a
 * Library declare. Never lowers; never invents bestReps; never writes
 * declaredTier (that stays the user’s manual pick); harder rungs untouched.
 *
 * floor = min(elite, declared + (sourceRank − memberRank))
 */
export function cascadeFamilyTiers(
  input: CascadeFamilyTiersInput,
): CascadeFamilyTiersResult {
  const { memories, sourceId, declaredTier, index: providedIndex } = input;
  const index = providedIndex ?? libraryFamilyLadderIndex();
  const source = index.byId.get(sourceId);
  if (!source) {
    return { memories, raisedIds: [] };
  }

  const family = index.byFamily.get(source.familyId) ?? [];
  const next = { ...memories };
  const raisedIds: string[] = [];

  for (const member of family) {
    if (member.id === sourceId || member.rank > source.rank) {
      continue;
    }
    const floor = inferredFloor(declaredTier, source.rank, member.rank);
    if (raiseSkillFloor(next, member.id, floor)) {
      raisedIds.push(member.id);
    }
  }

  return { memories: next, raisedIds };
}

function inferredFloor(
  declared: SkillTier,
  sourceRank: number,
  memberRank: number,
): SkillTier {
  if (memberRank > sourceRank) {
    throw new Error(
      `memberRank must be ≤ sourceRank; got member=${memberRank} source=${sourceRank}`,
    );
  }
  const steps = sourceRank - memberRank;
  const index = Math.min(SKILL_TIERS.length - 1, tierIndex(declared) + steps);
  return SKILL_TIERS[index];
}

/** Raise skillTier only — leave declaredTier as the user’s last manual pick. */
function raiseSkillFloor(
  memories: Record<string, ExerciseMemory>,
  exerciseId: string,
  floor: SkillTier,
): boolean {
  const current = memories[exerciseId] ?? blankMemory(exerciseId);
  const nextSkillTier = maxTier(current.skillTier ?? floor, floor);
  if (nextSkillTier === current.skillTier) {
    return false;
  }
  memories[exerciseId] = { ...current, skillTier: nextSkillTier };
  return true;
}

function blankMemory(exerciseId: string): ExerciseMemory {
  return {
    exerciseId,
    sessionsAtStandard: 0,
    sessionsBelowFloor: 0,
    lastAddedLoadKg: 0,
    weakLinkSessionsRemaining: 0,
  };
}
