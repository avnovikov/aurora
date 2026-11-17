import { inferTierFromBest } from "../domain/skillTier";
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

/** v1 → v2 (#112): give every level its source, then re-infer from scratch. */
export function migrateMemoriesV1(
  v1: Record<string, ExerciseMemory>,
  ctx: MemoryMigrationContext,
): { memories: Record<string, ExerciseMemory>; levelsToConfirm: string[] } {
  const levelsToConfirm: string[] = [];
  const memories: Record<string, ExerciseMemory> = {};
  for (const [id, old] of Object.entries(v1)) {
    const { memory, ambiguous } = migrateOne(id, old, ctx);
    memories[id] = memory;
    if (ambiguous) {
      levelsToConfirm.push(id);
    }
  }
  return { memories: inferTiers({ memories, now: ctx.now }).memories, levelsToConfirm: levelsToConfirm.sort() };
}
