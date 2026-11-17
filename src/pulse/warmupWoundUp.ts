import { heartRateZone, type HeartRateBounds, type HeartRateZone } from "./hrZones";
import { averageWarmupBpm, warmupHrMedian } from "./warmupHrHistory";
import type { WarmupLevel } from "../domain/program";

/** Avg bpm this far above the personal median counts as wound-up. */
export const WARMUP_HR_ELEVATION_BPM = 8;

/** Default last-N-ms window when personal baseline is not yet mature. */
export const WARMUP_END_ZONE_WINDOW_MS = 45_000;

const HIGH_ZONES = new Set<HeartRateZone>(["work", "hard", "max"]);

export interface BpmSample {
  readonly bpm: number;
  readonly atMs: number;
}

export interface WoundUpInput {
  warmupLevel: WarmupLevel;
  /** All bpm samples collected during this warmup. */
  samples: readonly BpmSample[];
  /** Session clock at end of warmup. */
  endAtMs: number;
  bounds: HeartRateBounds;
  /** Window for the end-of-warmup zone fallback. */
  endWindowMs?: number;
}

export type WoundUpReason = "baseline" | "end_zone" | null;

export interface WoundUpResult {
  woundUp: boolean;
  reason: WoundUpReason;
  averageBpm: number | null;
  endZone: HeartRateZone | null;
}

/**
 * Prefer personal warmup baseline when mature; otherwise last ~45s zone.
 */
export function assessWarmupWoundUp(input: WoundUpInput): WoundUpResult {
  const averageBpm = averageWarmupBpm(input.samples.map((s) => s.bpm));
  const endZone = endWindowZone(input);
  const median = warmupHrMedian(input.warmupLevel);
  if (median !== null && averageBpm !== null) {
    const woundUp = averageBpm >= median + WARMUP_HR_ELEVATION_BPM;
    return { woundUp, reason: woundUp ? "baseline" : null, averageBpm, endZone };
  }
  if (endZone !== null && HIGH_ZONES.has(endZone)) {
    return { woundUp: true, reason: "end_zone", averageBpm, endZone };
  }
  return { woundUp: false, reason: null, averageBpm, endZone };
}

function endWindowZone(input: WoundUpInput): HeartRateZone | null {
  const windowMs = input.endWindowMs ?? WARMUP_END_ZONE_WINDOW_MS;
  const recent = input.samples.filter((s) => s.atMs >= input.endAtMs - windowMs);
  if (recent.length === 0) {
    return null;
  }
  const avg = Math.round(recent.reduce((sum, s) => sum + s.bpm, 0) / recent.length);
  return heartRateZone(avg, input.bounds);
}
