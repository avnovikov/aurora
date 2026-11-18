import { SKILL_TIER_LABELS, tierIndex } from "../domain/skillTier";
import type {
  Exercise,
  ExerciseMemory,
  Pattern,
  SkillTier,
} from "../domain/types";
import { hasTrainingSignal } from "./chainMap";
import { withinTierProgress } from "./withinTierProgress";

export interface PatternProfileRow {
  pattern: Pattern;
  tier: SkillTier;
  tierLabel: string;
  withinPercent: number;
  /** 0–100 for CSS width of the continuum bar. */
  continuumPercent: number;
  exerciseIds: string[];
}

export interface LevelProfileModel {
  rows: PatternProfileRow[];
}

interface PatternMember {
  id: string;
  tier: SkillTier;
  withinPercent: number;
  continuum: number;
}

export function buildLevelProfile(input: {
  graph: Record<string, Exercise>;
  memories: Record<string, ExerciseMemory>;
}): LevelProfileModel {
  const byPattern = collectMembersByPattern(input.graph, input.memories);
  const rows = [...byPattern.entries()]
    .map(([pattern, members]) => profileRowFromMembers(pattern, members))
    .sort((a, b) => a.continuumPercent - b.continuumPercent);
  return { rows };
}

function collectMembersByPattern(
  graph: Record<string, Exercise>,
  memories: Record<string, ExerciseMemory>,
): Map<Pattern, PatternMember[]> {
  const byPattern = new Map<Pattern, PatternMember[]>();

  for (const [id, memory] of Object.entries(memories)) {
    if (!hasTrainingSignal(memory) || memory.bestReps === undefined) {
      continue;
    }
    const exercise = graph[id];
    if (!exercise?.standards) {
      continue;
    }
    const progress = withinTierProgress(memory.bestReps, exercise.standards);
    const list = byPattern.get(exercise.pattern) ?? [];
    list.push({
      id,
      tier: progress.tier,
      withinPercent: progress.withinPercent,
      continuum: progress.continuum,
    });
    byPattern.set(exercise.pattern, list);
  }

  return byPattern;
}

function profileRowFromMembers(
  pattern: Pattern,
  members: readonly PatternMember[],
): PatternProfileRow {
  const tier = medianTier(members.map((member) => member.tier));
  const atTier = members.filter((member) => member.tier === tier);
  assertNonEmpty(atTier, "median tier must match at least one pattern member");

  return {
    pattern,
    tier,
    tierLabel: SKILL_TIER_LABELS[tier],
    withinPercent: Math.round(averageOf(atTier.map((m) => m.withinPercent))),
    continuumPercent: Math.round(averageOf(atTier.map((m) => m.continuum)) * 100),
    exerciseIds: members.map((member) => member.id),
  };
}

function medianTier(tiers: readonly SkillTier[]): SkillTier {
  assertNonEmpty(tiers, "medianTier requires at least one tier");
  const sorted = [...tiers].sort((a, b) => tierIndex(a) - tierIndex(b));
  const mid = Math.floor((sorted.length - 1) / 2);
  return sorted[mid]!;
}

function averageOf(values: readonly number[]): number {
  assertNonEmpty(values, "averageOf requires at least one value");
  let sum = 0;
  for (const value of values) {
    sum += value;
  }
  return sum / values.length;
}

function assertNonEmpty<T>(
  values: readonly T[],
  message: string,
): asserts values is readonly [T, ...T[]] {
  if (values.length === 0) {
    throw new Error(message);
  }
}
