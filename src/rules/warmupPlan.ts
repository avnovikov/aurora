import type { LoadRegion } from "../data/seed";
import { EXERCISE_GRAPH } from "../data/exerciseGraph";
import type { StationPhase, WarmupStation } from "../data/warmupStations";
import {
  expandHoldPrescription,
  type HoldSide,
} from "../domain/prescription";
import type { EffortKind } from "../domain/types";

/**
 * One station in the prebuilt warm-up or cool-down view (not a work exercise prescription).
 */
export interface WarmupStep {
  stationId: string;
  /** Library exercise this station shows (older persisted sessions may lack it). */
  exerciseId?: string;
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
  /**
   * One side then the other: the hold pauses halfway to change side.
   * Absent when a prescription already expanded into separate side steps.
   */
  perSide?: boolean;
  /** When the step is one side of an expanded per-side prescription. */
  side?: HoldSide;
}

/**
 * How a timed station is worked: steady reps until the clock ends, or a still
 * hold. Only an isometric Library move is a hold. A timed move such as jumping
 * jacks is dosed in seconds but still repped. Unknown ids count as holds.
 */
export function stationEffort(step: Pick<WarmupStep, "exerciseId" | "stationId">): EffortKind {
  const exercise = EXERCISE_GRAPH[warmupStepExerciseId(step)];
  return exercise === undefined || exercise.type === "isometric" ? "hold" : "reps";
}

/** Library id for a materialised warm-up step (persisted steps may omit `exerciseId`). */
export function warmupStepExerciseId(step: Pick<WarmupStep, "exerciseId" | "stationId">): string {
  return step.exerciseId || step.stationId;
}

/** Fallback when a station omits holdSeconds (10–15s band). */
const DEFAULT_HOLD_SECONDS = 12;
/** Fixed break between consecutive stations (same or different area). */
const STATION_GAP_SECONDS = 10;
const SAME_AREA_GAP = STATION_GAP_SECONDS;
const CROSS_AREA_GAP = STATION_GAP_SECONDS;
/** Pause at the halfway point of a per-side station to change side. */
export const SIDE_SWITCH_SECONDS = 5;

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

function stepName(station: WarmupStation, side: HoldSide | undefined): string {
  return side ? `${station.name} (${side})` : station.name;
}

function stepFromStation(
  station: WarmupStation,
  holdSeconds: number,
  side?: HoldSide,
): WarmupStep {
  return {
    stationId: station.id,
    exerciseId: station.exerciseId,
    name: stepName(station, side),
    phase: station.phase,
    source: station.source,
    region: displayRegion(station),
    holdSeconds,
    gapSecondsAfter: 0,
    doodlePath: station.doodlePath,
    cues: [...station.cues],
    perSide: false,
    side,
  };
}

function stepsForStation(station: WarmupStation): WarmupStep[] {
  assertStation(station);
  if (station.prescription?.effort === "hold") {
    return expandHoldPrescription(station.prescription).map((segment) =>
      stepFromStation(station, segment.seconds, segment.side),
    );
  }
  const holdSeconds =
    station.holdSeconds > 0 ? station.holdSeconds : DEFAULT_HOLD_SECONDS;
  return [
    {
      ...stepFromStation(station, holdSeconds),
      perSide: station.perSide,
    },
  ];
}

/**
 * Expand stations into timed steps (hold prescriptions → segments).
 * Does not assign inter-step gaps; use `withWarmupGaps` or `buildWarmupView`.
 */
export function expandWarmupStations(stations: readonly WarmupStation[]): WarmupStep[] {
  return stations.flatMap(stepsForStation);
}

/**
 * Materialise a prebuilt warmup sequence for the session view.
 * Stations with a hold prescription expand into one step per segment.
 */
export function buildWarmupView(stations: WarmupStation[]): WarmupStep[] {
  if (stations.length === 0) {
    throw new Error("Warmup sequence must not be empty");
  }

  return withWarmupGaps(expandWarmupStations(stations));
}

/** Recalculate gaps after splicing or filtering a warm-up step list. */
export function withWarmupGaps(steps: readonly WarmupStep[]): WarmupStep[] {
  const next = steps.map((step) => ({ ...step, gapSecondsAfter: 0 }));
  applyGapsBetweenSteps(next);
  return next;
}

/** Cool-down view: same timed stations as the warm-up, but may be empty. */
export function buildCooldownView(stations: WarmupStation[]): WarmupStep[] {
  return stations.length === 0 ? [] : buildWarmupView(stations);
}

/**
 * Easy "Get ready" rest between the end of the warm-up and the first work set:
 * enough to recover from the submaximal ramp without losing temperature
 * (1–2 min; McGowan 2015). Only after a warm-up that ends on a ramp.
 */
export const WARMUP_TRANSITION_REST_SECONDS = 75;

/** Seconds of the warm-up → work rest (0 when the warm-up has no ramp). */
export function warmupTransitionSeconds(
  steps: readonly { phase?: StationPhase }[],
): number {
  return steps.some((step) => step.phase === "potentiate") ? WARMUP_TRANSITION_REST_SECONDS : 0;
}

/** Extra pause a station takes to change side halfway (0 when not per side). */
function sideSwitchSeconds(step: Pick<WarmupStep, "perSide">): number {
  return step.perSide === true ? SIDE_SWITCH_SECONDS : 0;
}

/** Hold second (counting down) where a per-side station pauses to change side. */
export function sideSwitchAt(
  step: Pick<WarmupStep, "holdSeconds" | "perSide">,
): number | null {
  return step.perSide === true ? Math.floor(step.holdSeconds / 2) : null;
}

/** Total wall-clock seconds for a materialised warmup view. */
export function warmupViewSeconds(steps: readonly WarmupStep[]): number {
  return steps.reduce(
    (sum, step) => sum + step.holdSeconds + sideSwitchSeconds(step) + step.gapSecondsAfter,
    0,
  );
}

/** Same station (expanded rounds / sides): brief pause, not a full break. */
function applyGapsBetweenSteps(steps: WarmupStep[]): void {
  for (let index = 0; index < steps.length - 1; index += 1) {
    const current = steps[index];
    const next = steps[index + 1];
    current.gapSecondsAfter =
      current.stationId === next.stationId
        ? SIDE_SWITCH_SECONDS
        : gapBetween(current.region, next.region);
  }
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
  sideSwitch: SIDE_SWITCH_SECONDS,
} as const;
