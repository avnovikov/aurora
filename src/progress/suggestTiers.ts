import { SKILL_TIERS, stepDown, tierIndex } from "../domain/skillTier";
import type { ExerciseMemory, SkillTier } from "../domain/types";
import { type FamilyLadderIndex, libraryFamilyLadderIndex } from "./familyLadderIndex";
import { evidenceTier, testedTier } from "./levelEvidence";

/** Share of a pattern's families that must be tested (#112 rule 6); judgement. */
const FAMILY_SHARE = 1 / 3;
const MIN_FAMILIES = 2;

export interface TierSuggestion {
  tier: SkillTier;
  testedFamilies: number;
  totalFamilies: number;
}

/** First pattern in ladder order; members without a pattern are skipped (#116). */
function firstPatternInFamily(
  members: readonly { id: string }[],
  patternOf: (exerciseId: string) => string | undefined,
): string | undefined {
  for (const member of members) {
    const pattern = patternOf(member.id);
    if (pattern !== undefined) {
      return pattern;
    }
  }
  return undefined;
}

/** Group families by pattern (from each family's first patterned member). */
function familiesByPattern(
  index: FamilyLadderIndex,
  patternOf: (exerciseId: string) => string | undefined,
): Map<string, string[]> {
  const byPattern = new Map<string, string[]>();
  for (const [familyId, members] of index.byFamily) {
    const pattern = firstPatternInFamily(members, patternOf);
    if (pattern) {
      byPattern.set(pattern, [...(byPattern.get(pattern) ?? []), familyId]);
    }
  }
  return byPattern;
}

/** Highest tested tier index per tested family. */
function bestTestedByFamily(
  familyIds: string[],
  index: FamilyLadderIndex,
  memories: Record<string, ExerciseMemory>,
): Map<string, number> {
  const best = new Map<string, number>();
  for (const familyId of familyIds) {
    const tiers = (index.byFamily.get(familyId) ?? [])
      .map((m) => {
        const memory = memories[m.id];
        return memory ? testedTier(memory) : undefined;
      })
      .filter((t): t is SkillTier => t !== undefined)
      .map(tierIndex);
    if (tiers.length > 0) {
      best.set(familyId, Math.max(...tiers));
    }
  }
  return best;
}

/** Read-only suggestions for untested families; never written to memory. */
export function suggestTiers(input: {
  memories: Record<string, ExerciseMemory>;
  index?: FamilyLadderIndex;
  patternOf: (exerciseId: string) => string | undefined;
}): Map<string, TierSuggestion> {
  const index = input.index ?? libraryFamilyLadderIndex();
  const out = new Map<string, TierSuggestion>();
  for (const familyIds of familiesByPattern(index, input.patternOf).values()) {
    const best = bestTestedByFamily(familyIds, index, input.memories);
    const needed = Math.max(MIN_FAMILIES, Math.ceil(familyIds.length * FAMILY_SHARE));
    for (let i = SKILL_TIERS.length - 1; i >= 0; i -= 1) {
      const tested = [...best.values()].filter((b) => b >= i).length;
      const tier = stepDown(SKILL_TIERS[i]!);
      if (tested < needed || !tier) {
        continue;
      }
      for (const familyId of familyIds.filter((f) => !best.has(f))) {
        for (const member of index.byFamily.get(familyId) ?? []) {
          out.set(member.id, { tier, testedFamilies: tested, totalFamilies: familyIds.length });
        }
      }
      break;
    }
  }
  return out;
}

/** The suggestion shown for one move; a move with a tested level gets none. */
export function suggestionFor(
  exerciseId: string,
  memories: Record<string, ExerciseMemory>,
  patternOf: (exerciseId: string) => string | undefined,
  index?: FamilyLadderIndex,
  now: Date = new Date(),
): TierSuggestion | undefined {
  const memory = memories[exerciseId];
  const suggestion = suggestTiers({ memories, patternOf, index }).get(exerciseId);
  // A suggestion never lowers a level the move already has.
  const current = memory ? evidenceTier(memory, now) : undefined;
  if (suggestion && current && tierIndex(suggestion.tier) <= tierIndex(current)) {
    return undefined;
  }
  return suggestion;
}
