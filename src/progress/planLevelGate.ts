import type { SessionTemplate } from "../domain/program";
import { nextSkillTier, tierIndex } from "../domain/skillTier";
import type { ExerciseMemory, ExerciseStandards, SkillTier } from "../domain/types";

/** Numerator/denominator for the raise threshold (4/5 = 80%) (#115). */
export const PLAN_LEVEL_RAISE_PASSED = 4;
export const PLAN_LEVEL_RAISE_TOTAL = 5;

/** How many plan-queue days feed the raise gate. */
export const PLAN_LEVEL_GATE_DAYS = 3;

export interface PlanLevelGateInput {
  days: readonly SessionTemplate[];
  memories: Readonly<Record<string, ExerciseMemory>>;
  currentTier: SkillTier;
  standardsFor: (exerciseId: string) => ExerciseStandards | null | undefined;
}

export interface PlanLevelGateResult {
  passed: number;
  total: number;
  shouldRaise: boolean;
  nextTier: SkillTier | null;
}

/**
 * Score the first three plan days: a working slot passes when logged
 * performance meets the current level's standards boundary or is already
 * at/above the next tier. Unlogged slots fail and stay in the denominator.
 */
export function evaluatePlanLevelGate(input: PlanLevelGateInput): PlanLevelGateResult {
  const nextTier = nextSkillTier(input.currentTier);
  if (input.days.length < PLAN_LEVEL_GATE_DAYS || nextTier === null) {
    return emptyResult(nextTier);
  }

  let passed = 0;
  let total = 0;
  for (const day of input.days.slice(0, PLAN_LEVEL_GATE_DAYS)) {
    for (const slot of day.slots) {
      if (slot.pinned) {
        continue;
      }
      const standards = input.standardsFor(slot.exerciseId);
      if (!standards) {
        continue;
      }
      total += 1;
      if (slotPasses(input.memories[slot.exerciseId], standards, input.currentTier, nextTier)) {
        passed += 1;
      }
    }
  }

  if (total === 0) {
    return emptyResult(nextTier);
  }
  return {
    passed,
    total,
    shouldRaise: meetsRaiseThreshold(passed, total),
    nextTier,
  };
}

/** Integer 80% check: passed/total ≥ 4/5 without floating division. */
export function meetsRaiseThreshold(passed: number, total: number): boolean {
  return passed * PLAN_LEVEL_RAISE_TOTAL >= total * PLAN_LEVEL_RAISE_PASSED;
}

function emptyResult(nextTier: SkillTier | null): PlanLevelGateResult {
  return { passed: 0, total: 0, shouldRaise: false, nextTier };
}

/** Logged-only: at/above the current level's rep boundary, or already next-tier+. */
function slotPasses(
  memory: ExerciseMemory | undefined,
  standards: ExerciseStandards,
  currentTier: SkillTier,
  nextTier: SkillTier,
): boolean {
  if (!memory) {
    return false;
  }
  const reps = memory.bestReps;
  if (reps !== undefined && reps >= standards[currentTier]) {
    return true;
  }
  if (memory.loggedTier !== undefined && tierIndex(memory.loggedTier) >= tierIndex(nextTier)) {
    return true;
  }
  return reps !== undefined && reps >= standards[nextTier];
}
