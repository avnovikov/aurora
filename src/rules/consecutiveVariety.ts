import { SEED_GRAPH, TEMPLATE_BY_ID, type SeedExercise } from "../data/seed";
import type { HistoryEntry, SessionFocus, TemplateSlot } from "../domain/program";
import type { Pattern } from "../domain/types";

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
 * `allowConsecutiveRepeat`; every other slot must avoid yesterday's IDs.
 */
export function pickSlotExerciseForVariety(
  slot: TemplateSlot,
  previousExerciseIds: readonly string[],
  alreadyChosenToday: ReadonlySet<string>,
): VarietyPick {
  const avoid = new Set(previousExerciseIds);
  if (slot.allowConsecutiveRepeat) {
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

/**
 * Prefer same pattern, then same training region, then any other work move.
 * Maximises difference on consecutive same-zone days.
 */
function candidateTiers(
  pattern: Pattern,
  preferredId: string,
): SeedExercise[][] {
  const preferred = SEED_GRAPH[preferredId];
  const regionHint = preferred?.regions.find((region) => region !== "general");
  const work = Object.values(SEED_GRAPH).filter(
    (exercise) => exercise.role === "work" && exercise.id !== preferredId,
  );
  const samePattern = work
    .filter((exercise) => exercise.pattern === pattern)
    .sort((a, b) => a.id.localeCompare(b.id));
  const sameRegion = regionHint
    ? work
        .filter((exercise) => exercise.regions.includes(regionHint))
        .sort((a, b) => a.id.localeCompare(b.id))
    : [];
  const anything = [...work].sort((a, b) => a.id.localeCompare(b.id));
  return [samePattern, sameRegion, anything];
}

