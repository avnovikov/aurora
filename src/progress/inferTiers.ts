import { minTier, nextSkillTier, SKILL_TIERS, stepDown, tierIndex } from "../domain/skillTier";
import type { ExerciseMemory, SkillTier } from "../domain/types";
import {
  type FamilyLadderIndex,
  type FamilyLadderMember,
  libraryFamilyLadderIndex,
} from "./familyLadderIndex";
import { liveInferredTier, refreshSkillTier, testedTier } from "./levelEvidence";

/** Tested family members needed before an untested one is inferred (#112 rule 3). */
export const MIN_SUPPORTERS = 2;
/** Support counts within this many rungs; at least one supporter must be 1 rung away. */
const MAX_DISTANCE = 2;

export interface InferTiersInput {
  memories: Record<string, ExerciseMemory>;
  now: Date;
  index?: FamilyLadderIndex;
  /** Families with a confirming session just now: their inferred tiers may rise one step. */
  confirmingFamilies?: ReadonlySet<string>;
}

export interface InferTiersResult {
  memories: Record<string, ExerciseMemory>;
  /** Members whose inferred tier is set after this pass. */
  inferredIds: string[];
}

interface Candidate {
  tier: SkillTier;
  from: string[];
}

interface Supporter {
  id: string;
  distance: number;
  tier: SkillTier;
}

function blank(exerciseId: string): ExerciseMemory {
  return { exerciseId, sessionsAtStandard: 0, sessionsBelowFloor: 0, lastAddedLoadKg: 0, weakLinkSessionsRemaining: 0 };
}

function withoutInferred(memory: ExerciseMemory, now: Date): ExerciseMemory {
  const rest = { ...memory };
  delete rest.inferred;
  return refreshSkillTier(rest, now);
}

function supportersOf(
  member: FamilyLadderMember,
  family: readonly FamilyLadderMember[],
  memories: Record<string, ExerciseMemory>,
): Supporter[] {
  const found: Supporter[] = [];
  for (const other of family) {
    const distance = other.rank - member.rank;
    const memory = memories[other.id];
    const tier = memory ? testedTier(memory) : undefined;
    if (distance >= 1 && distance <= MAX_DISTANCE && tier) {
      found.push({ id: other.id, distance, tier });
    }
  }
  return found;
}

/** Highest T with >= MIN_SUPPORTERS harder tested members at >= T, one of them 1 rung away; result is T - 1. */
function candidateFor(
  member: FamilyLadderMember,
  family: readonly FamilyLadderMember[],
  memories: Record<string, ExerciseMemory>,
): Candidate | null {
  const supporters = supportersOf(member, family, memories);
  for (let i = SKILL_TIERS.length - 1; i >= 0; i -= 1) {
    const atOrAbove = supporters.filter((s) => tierIndex(s.tier) >= i);
    if (atOrAbove.length >= MIN_SUPPORTERS && atOrAbove.some((s) => s.distance === 1)) {
      const tier = stepDown(SKILL_TIERS[i]!);
      return tier ? { tier, from: atOrAbove.map((s) => s.id).sort() } : null;
    }
  }
  return null;
}

function bounded(candidate: Candidate, current: ExerciseMemory | undefined, confirming: boolean, now: Date): SkillTier {
  let tier = candidate.tier;
  if (current?.failedCap) {
    tier = minTier(tier, current.failedCap.tier);
  }
  const previous = current ? liveInferredTier(current, now) : undefined;
  if (previous && tierIndex(tier) > tierIndex(previous)) {
    tier = confirming ? (nextSkillTier(previous) ?? previous) : previous;
  }
  return tier;
}

/** The memory for one member after this pass, or undefined when nothing changes. */
function updatedMember(
  member: FamilyLadderMember,
  family: readonly FamilyLadderMember[],
  memories: Record<string, ExerciseMemory>,
  input: InferTiersInput,
  confirming: boolean,
): ExerciseMemory | undefined {
  const current = memories[member.id];
  if (current && testedTier(current)) {
    // Tested evidence wins: drop any inference and refresh the cached tier.
    return withoutInferred(current, input.now);
  }
  const candidate = candidateFor(member, family, memories);
  if (!candidate) {
    return current?.inferred ? withoutInferred(current, input.now) : undefined;
  }
  const tier = bounded(candidate, current, confirming, input.now);
  const keepAt = current?.inferred?.tier === tier ? current.inferred.at : input.now.toISOString();
  return refreshSkillTier(
    { ...(current ?? blank(member.id)), inferred: { tier, from: candidate.from, at: keepAt } },
    input.now,
  );
}

export function inferTiers(input: InferTiersInput): InferTiersResult {
  const index = input.index ?? libraryFamilyLadderIndex();
  const next = { ...input.memories };
  const inferredIds: string[] = [];
  for (const [familyId, family] of index.byFamily) {
    const confirming = input.confirmingFamilies?.has(familyId) === true;
    for (const member of family) {
      const updated = updatedMember(member, family, next, input, confirming);
      if (updated) {
        next[member.id] = updated;
        if (updated.inferred) {
          inferredIds.push(member.id);
        }
      }
    }
  }
  return { memories: next, inferredIds };
}
