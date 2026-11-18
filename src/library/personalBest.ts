import type { SeedExercise } from "../data/seed";
import { escapeHtml } from "./present";

export type PersonalBestUnit = "reps" | "s";

export function personalBestUnit(exercise: {
  effort?: SeedExercise["effort"];
}): PersonalBestUnit {
  return exercise.effort === "hold" ? "s" : "reps";
}

export function formatPersonalBestValue(bestReps: number): string {
  if (!Number.isFinite(bestReps) || bestReps < 0) {
    throw new Error(`bestReps must be a non-negative number; got ${bestReps}`);
  }
  return String(bestReps);
}

/** Brass hero block for Library detail. */
export function personalBestHeroHtml(
  bestReps: number | undefined,
  unit: PersonalBestUnit,
): string {
  if (bestReps === undefined) {
    return `
      <div class="personal-best personal-best-empty">
        <p class="eyebrow">Personal best</p>
        <p class="hint">No personal best yet — log a clean set.</p>
      </div>
    `;
  }
  const value = formatPersonalBestValue(bestReps);
  const unitLabel = unit === "s" ? "seconds" : "reps";
  return `
    <div class="personal-best" data-personal-best>
      <p class="eyebrow">Personal best</p>
      <p class="personal-best-value">${escapeHtml(value)}<span class="personal-best-unit">${escapeHtml(unitLabel)}</span></p>
    </div>
  `;
}

/** Compact line for Progress path cards. */
export function personalBestProgressHtml(
  bestReps: number | undefined,
  unit: PersonalBestUnit,
): string {
  if (bestReps === undefined) {
    return "";
  }
  const value = formatPersonalBestValue(bestReps);
  const suffix = unit === "s" ? "s" : " reps";
  return `<p class="personal-best-inline">PB · ${escapeHtml(value)}${suffix}</p>`;
}
