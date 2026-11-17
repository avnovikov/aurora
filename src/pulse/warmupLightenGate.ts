import type { WarmupLevel } from "../domain/program";
import type { Readiness } from "../domain/types";
import { loadProfile } from "../settings/profile";
import type { HeartRateBounds } from "./hrZones";
import { recordWarmupAverageFromSamples } from "./warmupHrHistory";
import {
  featuresFromSignals,
  type LightenFeatures,
} from "./lightenForest";
import { preferLightDefault } from "./lightenLearning";
import {
  assessWarmupWoundUp,
  type BpmSample,
  type WoundUpResult,
} from "./warmupWoundUp";

export interface WarmupLightenGateInput {
  readiness: Readiness;
  warmupLevel: WarmupLevel;
  samples: readonly BpmSample[];
  endAtMs: number;
  bounds: HeartRateBounds;
}

export interface WarmupLightenGateResult {
  assessment: WoundUpResult;
  shouldAsk: boolean;
  features: LightenFeatures;
  preferLight: boolean;
}

/**
 * Pure decision: assess wound-up and score the confirm default.
 * Does not write storage — call {@link persistWarmupHrForGate} separately.
 */
export function decideWarmupLightenGate(
  input: WarmupLightenGateInput,
): WarmupLightenGateResult {
  const assessment = assessWarmupWoundUp({
    warmupLevel: input.warmupLevel,
    samples: input.samples,
    endAtMs: input.endAtMs,
    bounds: input.bounds,
  });
  const features = featuresFromSignals({
    sleepQuality: input.readiness.sleepQuality,
    painJoints: input.readiness.painJoints,
    woundUpReason: assessment.reason,
  });
  return {
    assessment,
    shouldAsk: assessment.woundUp,
    features,
    preferLight: preferLightDefault(features),
  };
}

/** Persist this warmup's average HR before baseline assessment on the next session. */
export function persistWarmupHrForGate(
  warmupLevel: WarmupLevel,
  samples: readonly BpmSample[],
): number | null {
  return recordWarmupAverageFromSamples(
    warmupLevel,
    samples.map((s) => s.bpm),
  );
}

/**
 * End-of-warmup gate for the session UI: persist average, then decide.
 * Assesses against the prior baseline (current average is written after assess).
 */
export function runWarmupLightenGate(input: {
  readiness: Readiness;
  warmupLevel: WarmupLevel;
  samples: readonly BpmSample[];
  endAtMs: number;
}): WarmupLightenGateResult & { recordedAverageBpm: number | null } {
  const profile = loadProfile();
  const bounds: HeartRateBounds = {
    restingBpm: profile.restingHeartRateBpm,
    maxBpm: profile.maxHeartRateBpm,
  };
  const decision = decideWarmupLightenGate({ ...input, bounds });
  const recordedAverageBpm = persistWarmupHrForGate(input.warmupLevel, input.samples);
  return { ...decision, recordedAverageBpm };
}
