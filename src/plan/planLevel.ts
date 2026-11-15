import { SKILL_TIER_LABELS } from "../domain/skillTier";
import type { Difficulty } from "../domain/types";
import { createKeyValueStore } from "../storage/keyValueStore";

const store = createKeyValueStore("aurora.poc.planLevel.v1");

/** "auto" takes the level of each ladder from the athlete's results; a tier fixes it for new days. */
export type PlanLevel = "auto" | Difficulty;

export const PLAN_LEVELS: ReadonlyArray<{ id: PlanLevel; label: string }> = [
  { id: "auto", label: "From my results" },
  { id: "beginner", label: SKILL_TIER_LABELS.beginner },
  { id: "intermediate", label: SKILL_TIER_LABELS.intermediate },
  { id: "advanced", label: SKILL_TIER_LABELS.advanced },
  { id: "elite", label: SKILL_TIER_LABELS.elite },
];

function isPlanLevel(value: unknown): value is PlanLevel {
  return PLAN_LEVELS.some((level) => level.id === value);
}

export function loadPlanLevel(): PlanLevel {
  const raw = store.read();
  return isPlanLevel(raw) ? raw : "auto";
}

export function savePlanLevel(level: PlanLevel): void {
  if (!isPlanLevel(level)) {
    throw new Error(`Unknown plan level: ${String(level)}`);
  }
  if (level === "auto") {
    store.clear();
    return;
  }
  store.write(level);
}

/** The tier to generate at, or undefined to read each ladder's level from results. */
export function planLevelTier(level: PlanLevel): Difficulty | undefined {
  return level === "auto" ? undefined : level;
}
