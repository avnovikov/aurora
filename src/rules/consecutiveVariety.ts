import { EXERCISE_GRAPH, PLANNABLE_EXERCISES, sourceRank } from "../data/exerciseGraph";
import { placeOnLadder } from "../data/enrich/ladder";
import { TEMPLATE_BY_ID, type SeedExercise } from "../data/seed";
import type { HistoryEntry, SessionFocus, TemplateSlot } from "../domain/program";
import type { Pattern, SkillTier } from "../domain/types";

export interface VarietyPick {
  exerciseId: string;
  swapped: boolean;
  reason?: string;
}

/**
 * Latest completed session counts as consecutive same-zone when its
 * template focus matches today's focus (history is newest-first).
 */
export function lastConsecutiveSameZone(
  history: readonly HistoryEntry[],
  focus: SessionFocus,
): HistoryEntry | null {
  const latest = history[0];
  if (!latest) {
    return null;
  }
  const lastFocus = TEMPLATE_BY_ID[latest.templateId]?.focus;
  if (lastFocus !== focus) {
    return null;
  }
  return latest;
}

/**
 * For consecutive same-zone days, keep only slots marked
 * `allowConsecutiveRepeat` or `pinned`; every other slot must avoid yesterday's IDs.
 */
export function pickSlotExerciseForVariety(
  slot: TemplateSlot,
  previousExerciseIds: readonly string[],
  alreadyChosenToday: ReadonlySet<string>,
): VarietyPick {
  const avoid = new Set(previousExerciseIds);
  if (slot.allowConsecutiveRepeat || slot.pinned) {
    return { exerciseId: slot.exerciseId, swapped: false };
  }
  if (!avoid.has(slot.exerciseId) && !alreadyChosenToday.has(slot.exerciseId)) {
    return { exerciseId: slot.exerciseId, swapped: false };
  }
  const alternative = findAlternate(
    slot,
    avoid,
    alreadyChosenToday,
  );
  if (!alternative) {
    return {
      exerciseId: slot.exerciseId,
      swapped: false,
      reason: "No unused alternate in catalogue; kept default",
    };
  }
  return {
    exerciseId: alternative.id,
    swapped: true,
    reason: `Variety vs last same-zone day · ${alternative.name}`,
  };
}

function findAlternate(
  slot: TemplateSlot,
  avoid: ReadonlySet<string>,
  alreadyChosenToday: ReadonlySet<string>,
): SeedExercise | null {
  const tiers = candidateTiers(slot.pattern, slot.exerciseId);
  for (const pool of tiers) {
    const fresh = pool.find(
      (exercise) =>
        !avoid.has(exercise.id) && !alreadyChosenToday.has(exercise.id),
    );
    if (fresh) {
      return fresh;
    }
  }
  for (const pool of tiers) {
    const reuse = pool.find(
      (exercise) => !alreadyChosenToday.has(exercise.id),
    );
    if (reuse) {
      return reuse;
    }
  }
  return null;
}

const LEVEL_ORDER: Record<SkillTier, number> = {
  novice: 0,
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  elite: 4,
};

/** Same level or one step easier — a variety swap never makes the day harder. */
function levelGap(candidate: SeedExercise, preferred: SeedExercise | undefined): number | null {
  if (!preferred?.difficulty || !candidate.difficulty) {
    return 0;
  }
  const gap = LEVEL_ORDER[preferred.difficulty] - LEVEL_ORDER[candidate.difficulty];
  return gap === 0 || gap === 1 ? gap : null;
}

function familyOf(exercise: SeedExercise | undefined): string | undefined {
  return exercise ? placeOnLadder(exercise.name)?.family.id : undefined;
}

/**
 * Alternates from the whole plannable Library: same movement family, then
 * same pattern, then same training region, then any work move — each pool
 * limited to the same level or one easier, curated sources first.
 */
function candidateTiers(pattern: Pattern, preferredId: string): SeedExercise[][] {
  const preferred = EXERCISE_GRAPH[preferredId];
  const family = familyOf(preferred);
  const regionHint = preferred?.regions.find((region) => region !== "general");
  const work = PLANNABLE_EXERCISES.filter(
    (exercise) => exercise.id !== preferredId && levelGap(exercise, preferred) !== null,
  );
  const ordered = (pool: SeedExercise[]): SeedExercise[] =>
    [...pool].sort(
      (a, b) =>
        (levelGap(a, preferred) ?? 0) - (levelGap(b, preferred) ?? 0) ||
        sourceRank(a.id) - sourceRank(b.id) ||
        a.id.localeCompare(b.id),
    );
  const sameFamily = family ? work.filter((exercise) => familyOf(exercise) === family) : [];
  const samePattern = work.filter((exercise) => exercise.pattern === pattern);
  const sameRegion = regionHint
    ? work.filter((exercise) => exercise.regions.includes(regionHint))
    : [];
  return [ordered(sameFamily), ordered(samePattern), ordered(sameRegion), ordered(work)];
}
