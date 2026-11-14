import type { LoadRegion, SeedExercise } from "../data/seed";

export interface WarmupStep {
  exerciseId: string;
  name: string;
  region: LoadRegion;
  holdSeconds: number;
  gapSecondsAfter: number;
}

export interface WarmupPlanInput {
  pool: SeedExercise[];
  focusRegions: LoadRegion[];
  targetSeconds?: number;
}

const DEFAULT_TARGET_SECONDS = 600;
const HOLD_SECONDS = 40;
const SAME_AREA_GAP = 5;
const CROSS_AREA_GAP = 10;

function primaryRegion(exercise: SeedExercise, focus: LoadRegion[]): LoadRegion {
  const match = exercise.regions.find((region) => focus.includes(region));
  return match ?? exercise.regions[0] ?? "general";
}

function sameArea(a: LoadRegion, b: LoadRegion): boolean {
  if (a === "general" || b === "general") {
    return false;
  }
  return a === b;
}

function gapBetween(previous: LoadRegion | null, next: LoadRegion): number {
  if (previous === null) {
    return 0;
  }
  return sameArea(previous, next) ? SAME_AREA_GAP : CROSS_AREA_GAP;
}

function sortPool(pool: SeedExercise[], focus: LoadRegion[]): SeedExercise[] {
  const focused = pool.filter((item) =>
    item.regions.some((region) => focus.includes(region)),
  );
  const general = pool.filter((item) => !focused.includes(item));
  return [...focused, ...general];
}

/**
 * Builds a continuous warmup list (~10 min) with 5s same-area / 10s cross-area gaps.
 */
export function planWarmup(input: WarmupPlanInput): WarmupStep[] {
  const target = input.targetSeconds ?? DEFAULT_TARGET_SECONDS;
  assertWarmupInput(input, target);

  const ordered = sortPool(input.pool, input.focusRegions);
  const steps: WarmupStep[] = [];
  let elapsed = 0;
  let previousRegion: LoadRegion | null = null;
  let index = 0;

  while (elapsed < target && ordered.length > 0) {
    const exercise = ordered[index % ordered.length];
    const region = primaryRegion(exercise, input.focusRegions);
    const gap = gapBetween(previousRegion, region);
    const step: WarmupStep = {
      exerciseId: exercise.id,
      name: exercise.name,
      region,
      holdSeconds: HOLD_SECONDS,
      gapSecondsAfter: gap,
    };
    steps.push(step);
    elapsed += HOLD_SECONDS + gap;
    previousRegion = region;
    index += 1;
    if (index > ordered.length * 4) {
      break;
    }
  }

  if (steps.length > 0) {
    steps[steps.length - 1].gapSecondsAfter = 0;
  }
  return steps;
}

function assertWarmupInput(input: WarmupPlanInput, target: number): void {
  if (input.pool.length === 0) {
    throw new Error("Warmup pool must not be empty");
  }
  if (target <= 0) {
    throw new Error(`Warmup targetSeconds must be positive; got ${target}`);
  }
}

export const WARMUP_GAPS = {
  sameArea: SAME_AREA_GAP,
  crossArea: CROSS_AREA_GAP,
  holdSeconds: HOLD_SECONDS,
} as const;
