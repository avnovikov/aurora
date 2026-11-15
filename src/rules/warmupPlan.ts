import type { LoadRegion, SeedExercise } from "../data/seed";

export interface WarmupStep {
  exerciseId: string;
  name: string;
  region: LoadRegion;
  holdSeconds: number;
  gapSecondsAfter: number;
  doodlePath?: string;
}

export interface WarmupPlanInput {
  pool: SeedExercise[];
  focusRegions: LoadRegion[];
  targetSeconds?: number;
}

const DEFAULT_TARGET_SECONDS = 600;
/** Short stations (10–15s band); 12s is the default sweet spot. */
const HOLD_SECONDS = 12;
/** Fixed break between every warmup station: 5…1 → Go. */
const SAME_AREA_GAP = 5;
const CROSS_AREA_GAP = 5;

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
 * Builds a continuous warmup list (~10 min) of short 10–15s stations
 * with 5s same-area / 10s cross-area gaps.
 */
export function planWarmup(input: WarmupPlanInput): WarmupStep[] {
  const target = input.targetSeconds ?? DEFAULT_TARGET_SECONDS;
  assertWarmupInput(input, target);

  const ordered = sortPool(input.pool, input.focusRegions);
  const steps: WarmupStep[] = [];
  let elapsed = 0;
  let previousRegion: LoadRegion | null = null;
  let index = 0;
  const maxSteps = Math.ceil(target / HOLD_SECONDS) + ordered.length;

  while (elapsed < target && ordered.length > 0 && index < maxSteps) {
    const exercise = ordered[index % ordered.length];
    const region = primaryRegion(exercise, input.focusRegions);
    const gap = gapBetween(previousRegion, region);
    const step: WarmupStep = {
      exerciseId: exercise.id,
      name: exercise.name,
      region,
      holdSeconds: HOLD_SECONDS,
      gapSecondsAfter: gap,
      doodlePath: exercise.doodlePath,
    };
    steps.push(step);
    elapsed += HOLD_SECONDS + gap;
    previousRegion = region;
    index += 1;
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
