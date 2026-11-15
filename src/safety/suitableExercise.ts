import { EXERCISE_GRAPH, plannableByPattern } from "../data/exerciseGraph";
import type { EquipmentId, JointHistoryEntry } from "../domain/program";
import { tierIndex } from "../domain/skillTier";
import type { Pattern } from "../domain/types";
import { libraryFamilyLadderIndex } from "../progress/familyLadderIndex";
import { missingGear } from "./gear";
import { assessExercise } from "./jointCare";

export interface SuitableChoice {
  id: string;
  name: string;
  /** Set when the planned move was swapped out. */
  swappedFrom?: string;
  /** Why it was swapped, or why it could not be. */
  reason?: string;
  cause?: "excluded" | "joints" | "gear";
  cautions: string[];
}

interface Candidate {
  id: string;
  name: string;
  pattern: Pattern;
  requires?: readonly EquipmentId[];
}

function gearReason(missing: readonly EquipmentId[]): string {
  return `Needs ${missing.join(" + ")} (not in your equipment)`;
}

function causeOf(excluded: boolean, avoid: boolean): SuitableChoice["cause"] {
  if (excluded) {
    return "excluded";
  }
  return avoid ? "joints" : "gear";
}

function labelOf(cause: SuitableChoice["cause"], missing: readonly EquipmentId[]): string {
  if (cause === "excluded") {
    return "Excluded by you";
  }
  return cause === "joints" ? "Joint history" : gearReason(missing);
}

/**
 * Substitute order for a move the athlete excluded: same ladder first, then
 * nearest difficulty, and never harder than the original when an equal or
 * easier option exists (the Library's variety rule: same level or one easier).
 */
function exclusionOrder(original: Candidate, candidate: { id: string }): [number, number, number] {
  const index = libraryFamilyLadderIndex().byId;
  const family = index.get(original.id)?.familyId;
  const sameLadder = family !== undefined && family === index.get(candidate.id)?.familyId;
  const from = EXERCISE_GRAPH[original.id]?.difficulty;
  const to = EXERCISE_GRAPH[candidate.id]?.difficulty;
  const delta = from && to ? tierIndex(to) - tierIndex(from) : 0;
  return [delta > 0 ? 1 : 0, sameLadder ? 0 : 1, Math.abs(delta)];
}

function compareTuples(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return a[i]! - b[i]!;
    }
  }
  return 0;
}

/**
 * Keeps the move when it suits this history, equipment and exclusions;
 * otherwise picks a plannable move of the same pattern that is not excluded,
 * not an avoid for the joints and needs no missing gear.
 *
 * Joint and gear swaps keep their original rule (first in Library order,
 * fewest cautions). Only a move the athlete excluded uses the ladder-aware
 * order, so adding exclusions cannot change any other prescription.
 * Keeps the original, with a note, when nothing suitable exists.
 */
export function chooseSuitableExercise(
  exercise: Candidate,
  history: readonly JointHistoryEntry[],
  equipment?: readonly EquipmentId[],
  excluded: readonly string[] = [],
): SuitableChoice {
  const own = assessExercise(exercise.name, history);
  const missing = missingGear(exercise.requires, equipment);
  const isExcluded = excluded.includes(exercise.id);
  if (!own.avoid && missing.length === 0 && !isExcluded) {
    return { id: exercise.id, name: exercise.name, cautions: own.cautions };
  }
  const cause = causeOf(isExcluded, own.avoid);
  const pool = plannableByPattern().get(exercise.pattern) ?? [];
  const candidates = pool
    .filter((candidate) => candidate.id !== exercise.id && !excluded.includes(candidate.id))
    .filter((candidate) => missingGear(candidate.requires, equipment).length === 0)
    .map((candidate) => ({
      candidate,
      verdict: assessExercise(candidate.name, history),
    }))
    .filter(({ verdict }) => !verdict.avoid);
  const byCautions = (a: (typeof candidates)[number], b: (typeof candidates)[number]): number =>
    a.verdict.cautions.length - b.verdict.cautions.length;
  const safe =
    cause === "excluded"
      ? [...candidates].sort(
          (a, b) =>
            compareTuples(exclusionOrder(exercise, a.candidate), exclusionOrder(exercise, b.candidate)) ||
            byCautions(a, b),
        )[0]
      : [...candidates].sort(byCautions)[0];
  if (!safe) {
    const note = isExcluded ? ["You excluded this move and no substitute was found"] : [];
    const gear = missing.length > 0 ? [gearReason(missing)] : [];
    return { id: exercise.id, name: exercise.name, cause, cautions: [...note, ...gear, ...own.cautions] };
  }
  return {
    id: safe.candidate.id,
    name: safe.candidate.name,
    swappedFrom: exercise.name,
    cause,
    reason: `${labelOf(cause, missing)}: swapped ${exercise.name} for ${safe.candidate.name}`,
    cautions: safe.verdict.cautions,
  };
}
