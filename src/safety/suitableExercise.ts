import { plannableByPattern } from "../data/exerciseGraph";
import type { EquipmentId, JointHistoryEntry } from "../domain/program";
import type { Pattern } from "../domain/types";
import { missingGear } from "./gear";
import { assessExercise } from "./jointCare";

export interface SuitableChoice {
  id: string;
  name: string;
  /** Set when the planned move was swapped out. */
  swappedFrom?: string;
  /** Why it was swapped, or why it could not be. */
  reason?: string;
  cause?: "joints" | "gear";
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

/**
 * Keeps the move when it suits this history and equipment; otherwise picks
 * the first plannable move of the same pattern with no avoid flag and no
 * missing gear (fewest cautions first). Keeps the original, with a note,
 * when nothing suitable exists.
 */
export function chooseSuitableExercise(
  exercise: Candidate,
  history: readonly JointHistoryEntry[],
  equipment?: readonly EquipmentId[],
): SuitableChoice {
  const own = assessExercise(exercise.name, history);
  const missing = missingGear(exercise.requires, equipment);
  if (!own.avoid && missing.length === 0) {
    return { id: exercise.id, name: exercise.name, cautions: own.cautions };
  }
  const cause = own.avoid ? "joints" : "gear";
  const pool = plannableByPattern().get(exercise.pattern) ?? [];
  const safe = pool
    .filter((candidate) => candidate.id !== exercise.id)
    .filter((candidate) => missingGear(candidate.requires, equipment).length === 0)
    .map((candidate) => ({
      candidate,
      verdict: assessExercise(candidate.name, history),
    }))
    .filter(({ verdict }) => !verdict.avoid)
    .sort((a, b) => a.verdict.cautions.length - b.verdict.cautions.length)[0];
  if (!safe) {
    const note = missing.length > 0 ? [gearReason(missing)] : [];
    return { id: exercise.id, name: exercise.name, cause, cautions: [...note, ...own.cautions] };
  }
  const label = cause === "joints" ? "Joint history" : gearReason(missing);
  return {
    id: safe.candidate.id,
    name: safe.candidate.name,
    swappedFrom: exercise.name,
    cause,
    reason: `${label}: swapped ${exercise.name} for ${safe.candidate.name}`,
    cautions: safe.verdict.cautions,
  };
}
