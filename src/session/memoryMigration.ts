import { inferTierFromBest, SKILL_TIERS } from "../domain/skillTier";
import type { ExerciseMemory, ExerciseStandards, SkillTier } from "../domain/types";
import { inferTiers } from "../progress/inferTiers";
import { refreshSkillTier } from "../progress/levelEvidence";

export interface MemoryMigrationContext {
  now: Date;
  /** The plan's level for each move (levelForMove(exercise, planLevel)); empty when the plan level is "auto". */
  planLevelFor: (exerciseId: string) => SkillTier | undefined;
  standardsOf: (exerciseId: string) => ExerciseStandards | null;
}

/** A declared tier equal to the plan's level may be a plan write: move it to planTier. */
function splitDeclared(next: ExerciseMemory, planLevel: SkillTier | undefined, nowIso: string): boolean {
  if (!next.declaredTier) {
    return false;
  }
  if (next.declaredTier === planLevel) {
    next.planTier = next.declaredTier;
    delete next.declaredTier;
    return true;
  }
  next.declaredAt = nowIso;
  return false;
}

function migrateOne(
  id: string,
  old: ExerciseMemory,
  ctx: MemoryMigrationContext,
): { memory: ExerciseMemory; ambiguous: boolean } {
  const next: ExerciseMemory = { ...old };
  delete next.skillTier;
  delete next.inferred;
  const ambiguous = splitDeclared(next, ctx.planLevelFor(id), ctx.now.toISOString());
  const standards = ctx.standardsOf(id);
  if (standards && next.bestReps !== undefined) {
    next.loggedTier = inferTierFromBest(next.bestReps, standards);
  }
  return { memory: refreshSkillTier(next, ctx.now), ambiguous };
}

function migrateRow(
  id: string,
  old: ExerciseMemory,
  ctx: MemoryMigrationContext,
): { memory: ExerciseMemory; ambiguous: boolean } {
  try {
    return migrateOne(id, old, ctx);
  } catch (error) {
    return passThrough(id, old, error);
  }
}

const COUNTER_KEYS = ["sessionsAtStandard", "sessionsBelowFloor", "lastAddedLoadKg", "weakLinkSessionsRemaining"] as const;
const OPTIONAL_NUMBER_KEYS = ["bestReps", "avgSetDurationSeconds", "setDurationSampleCount"] as const;

function isNonNegativeFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/** Make every numeric field safe for later planning: counters fall back to 0, optional numbers are dropped. */
function sanitizeNumbers(copy: ExerciseMemory): void {
  for (const key of COUNTER_KEYS) {
    if (!isNonNegativeFinite(copy[key])) {
      copy[key] = 0;
    }
  }
  for (const key of OPTIONAL_NUMBER_KEYS) {
    if (copy[key] !== undefined && !isNonNegativeFinite(copy[key])) {
      delete copy[key];
    }
  }
}

/** A row the migration cannot read: copy it through without derived level fields, and say which. */
function passThrough(id: string, old: ExerciseMemory, error: unknown): { memory: ExerciseMemory; ambiguous: boolean } {
  console.warn(`Aurora: memory row "${id}" could not be migrated; kept without derived levels`, error);
  const copy: ExerciseMemory = { ...old };
  delete copy.skillTier;
  delete copy.inferred;
  for (const key of ["declaredTier", "loggedTier", "planTier"] as const) {
    if (copy[key] !== undefined && !SKILL_TIERS.includes(copy[key])) {
      delete copy[key];
    }
  }
  sanitizeNumbers(copy);
  return { memory: copy, ambiguous: false };
}

/** v1 → v2 (#112): give every level its source, then re-infer from scratch. */
export function migrateMemoriesV1(
  v1: Record<string, ExerciseMemory>,
  ctx: MemoryMigrationContext,
): { memories: Record<string, ExerciseMemory>; levelsToConfirm: string[] } {
  const levelsToConfirm: string[] = [];
  const memories: Record<string, ExerciseMemory> = {};
  for (const [id, old] of Object.entries(v1)) {
    const { memory, ambiguous } = migrateRow(id, old, ctx);
    memories[id] = memory;
    if (ambiguous) {
      levelsToConfirm.push(id);
    }
  }
  return { memories: inferTiers({ memories, now: ctx.now }).memories, levelsToConfirm: levelsToConfirm.sort() };
}
