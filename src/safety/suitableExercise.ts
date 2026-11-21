import { choosableByPattern, EXERCISE_GRAPH, plannableByPattern } from "../data/exerciseGraph";
import type { SeedExercise } from "../data/seed";
import type { EquipmentId, GearNeeds, JointHistoryEntry } from "../domain/program";
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

interface Candidate extends GearNeeds {
  id: string;
  name: string;
  pattern: Pattern;
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

interface Scored {
  candidate: SeedExercise;
  cautions: string[];
}

/**
 * Same-pattern moves the athlete can do: not excluded, gear owned, no joint
 * avoid. Plannable moves only, unless `byHand` (the athlete picks from the
 * list): then tierless moves are offered too (#262).
 */
function usableAlternatives(
  exercise: Candidate,
  history: readonly JointHistoryEntry[],
  equipment: readonly EquipmentId[] | undefined,
  excluded: readonly string[],
  byHand = false,
): Scored[] {
  const pool = (byHand ? choosableByPattern() : plannableByPattern()).get(exercise.pattern) ?? [];
  return pool
    .filter((candidate) => candidate.id !== exercise.id && !excluded.includes(candidate.id))
    .filter((candidate) => missingGear(candidate, equipment).length === 0)
    .map((candidate) => ({ candidate, verdict: assessExercise(candidate.name, history) }))
    .filter(({ verdict }) => !verdict.avoid)
    .map(({ candidate, verdict }) => ({ candidate, cautions: verdict.cautions }));
}

const byCautions = (a: Scored, b: Scored): number => a.cautions.length - b.cautions.length;

/** Order for replacing a move the athlete excluded; fewest cautions breaks ties. */
function byExclusionOrder(original: Candidate): (a: Scored, b: Scored) => number {
  return (a, b) =>
    compareTuples(exclusionOrder(original, a.candidate), exclusionOrder(original, b.candidate)) || byCautions(a, b);
}

/**
 * Substitutes for a move the athlete does not want, best first: same ladder,
 * nearest difficulty, never harder while an equal or easier move exists.
 * `byHand`: the athlete picks from this list, so tierless moves are offered.
 */
export function substitutesFor(
  exercise: Candidate,
  history: readonly JointHistoryEntry[],
  equipment?: readonly EquipmentId[],
  excluded: readonly string[] = [],
  options: { byHand?: boolean } = {},
): SeedExercise[] {
  return usableAlternatives(exercise, history, equipment, excluded, options.byHand)
    .sort(byExclusionOrder(exercise))
    .map(({ candidate }) => candidate);
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
  const missing = missingGear(exercise, equipment);
  const isExcluded = excluded.includes(exercise.id);
  if (!own.avoid && missing.length === 0 && !isExcluded) {
    return { id: exercise.id, name: exercise.name, cautions: own.cautions };
  }
  const cause = causeOf(isExcluded, own.avoid);
  const candidates = usableAlternatives(exercise, history, equipment, excluded);
  const safe =
    cause === "excluded"
      ? [...candidates].sort(byExclusionOrder(exercise))[0]
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
    cautions: safe.cautions,
  };
}
