import type { LoadRegion } from "../data/seed";
import type { WarmupStation } from "../data/warmupStations";

/**
 * One station in today's warmup mini-session (not a work exercise prescription).
 */
export interface WarmupStep {
  stationId: string;
  name: string;
  region: LoadRegion;
  holdSeconds: number;
  gapSecondsAfter: number;
  doodlePath?: string;
  cues: string[];
}

export interface WarmupPlanInput {
  stations: WarmupStation[];
  focusRegions: LoadRegion[];
  targetSeconds?: number;
}

const DEFAULT_TARGET_SECONDS = 600;
/** Fallback when a station omits holdSeconds (10–15s band). */
const DEFAULT_HOLD_SECONDS = 12;
/** Fixed break between every warmup station: 5…1 → Go. */
const SAME_AREA_GAP = 5;
const CROSS_AREA_GAP = 5;

function primaryRegion(station: WarmupStation, focus: LoadRegion[]): LoadRegion {
  const match = station.regions.find((region) => focus.includes(region));
  return match ?? station.regions[0] ?? "general";
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

function sortStations(
  stations: WarmupStation[],
  focus: LoadRegion[],
): WarmupStation[] {
  const focused = stations.filter((item) =>
    item.regions.some((region) => focus.includes(region)),
  );
  const general = stations.filter((item) => !focused.includes(item));
  return [...focused, ...general];
}

/**
 * Builds today's warmup mini-session (~10 min) from dedicated stations.
 */
export function planWarmup(input: WarmupPlanInput): WarmupStep[] {
  const target = input.targetSeconds ?? DEFAULT_TARGET_SECONDS;
  assertWarmupInput(input, target);

  const ordered = sortStations(input.stations, input.focusRegions);
  const steps: WarmupStep[] = [];
  let elapsed = 0;
  let previousRegion: LoadRegion | null = null;
  let index = 0;
  const maxSteps = Math.ceil(target / DEFAULT_HOLD_SECONDS) + ordered.length;

  while (elapsed < target && ordered.length > 0 && index < maxSteps) {
    const station = ordered[index % ordered.length];
    const region = primaryRegion(station, input.focusRegions);
    const holdSeconds = station.holdSeconds > 0 ? station.holdSeconds : DEFAULT_HOLD_SECONDS;
    const gap = gapBetween(previousRegion, region);
    steps.push({
      stationId: station.id,
      name: station.name,
      region,
      holdSeconds,
      gapSecondsAfter: gap,
      doodlePath: station.doodlePath,
      cues: [...station.cues],
    });
    elapsed += holdSeconds + gap;
    previousRegion = region;
    index += 1;
  }

  if (steps.length > 0) {
    steps[steps.length - 1].gapSecondsAfter = 0;
  }
  return steps;
}

function assertWarmupInput(input: WarmupPlanInput, target: number): void {
  if (input.stations.length === 0) {
    throw new Error("Warmup station pool must not be empty");
  }
  if (target <= 0) {
    throw new Error(`Warmup targetSeconds must be positive; got ${target}`);
  }
}

export const WARMUP_GAPS = {
  sameArea: SAME_AREA_GAP,
  crossArea: CROSS_AREA_GAP,
  holdSeconds: DEFAULT_HOLD_SECONDS,
} as const;
