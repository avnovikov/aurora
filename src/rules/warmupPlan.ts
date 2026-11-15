import type { LoadRegion } from "../data/seed";
import type { StationPhase, WarmupStation } from "../data/warmupStations";

/**
 * One station in the prebuilt warm-up or cool-down view (not a work exercise prescription).
 */
export interface WarmupStep {
  stationId: string;
  name: string;
  /** RAMP phase or cooldown (older persisted sessions may lack it). */
  phase?: StationPhase;
  /** Short evidence citation shown in small text on the station. */
  source?: string;
  region: LoadRegion;
  holdSeconds: number;
  gapSecondsAfter: number;
  doodlePath?: string;
  cues: string[];
}

/** Fallback when a station omits holdSeconds (10–15s band). */
const DEFAULT_HOLD_SECONDS = 12;
/** Fixed break between consecutive stations. */
const SAME_AREA_GAP = 5;
const CROSS_AREA_GAP = 5;

function displayRegion(station: WarmupStation): LoadRegion {
  return station.regions[0] ?? "general";
}

function sameArea(a: LoadRegion, b: LoadRegion): boolean {
  if (a === "general" || b === "general") {
    return false;
  }
  return a === b;
}

function gapBetween(previous: LoadRegion, next: LoadRegion): number {
  return sameArea(previous, next) ? SAME_AREA_GAP : CROSS_AREA_GAP;
}

/**
 * Materialise a prebuilt warmup sequence for the session view.
 * Each station once, in template order — no fill-to-target planner.
 */
export function buildWarmupView(stations: WarmupStation[]): WarmupStep[] {
  if (stations.length === 0) {
    throw new Error("Warmup sequence must not be empty");
  }

  const steps: WarmupStep[] = stations.map((station) => {
    assertStation(station);
    const holdSeconds =
      station.holdSeconds > 0 ? station.holdSeconds : DEFAULT_HOLD_SECONDS;
    return {
      stationId: station.id,
      name: station.name,
      phase: station.phase,
      source: station.source,
      region: displayRegion(station),
      holdSeconds,
      gapSecondsAfter: 0,
      doodlePath: station.doodlePath,
      cues: [...station.cues],
    };
  });

  for (let index = 0; index < steps.length - 1; index += 1) {
    const current = steps[index];
    const next = steps[index + 1];
    current.gapSecondsAfter = gapBetween(current.region, next.region);
  }

  return steps;
}

/** Cool-down view: same timed stations as the warm-up, but may be empty. */
export function buildCooldownView(stations: WarmupStation[]): WarmupStep[] {
  return stations.length === 0 ? [] : buildWarmupView(stations);
}

/** Total wall-clock seconds for a materialised warmup view. */
export function warmupViewSeconds(steps: readonly WarmupStep[]): number {
  return steps.reduce(
    (sum, step) => sum + step.holdSeconds + step.gapSecondsAfter,
    0,
  );
}

function assertStation(station: WarmupStation): void {
  if (!station.id || !station.name) {
    throw new Error("Warmup station requires id and name");
  }
  if (!Number.isFinite(station.holdSeconds) || station.holdSeconds < 0) {
    throw new Error(
      `Warmup station ${station.id} holdSeconds must be non-negative; got ${station.holdSeconds}`,
    );
  }
}

export const WARMUP_GAPS = {
  sameArea: SAME_AREA_GAP,
  crossArea: CROSS_AREA_GAP,
  holdSeconds: DEFAULT_HOLD_SECONDS,
} as const;
