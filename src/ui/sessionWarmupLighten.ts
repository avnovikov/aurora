import { DEFAULT_WARMUP_LEVEL } from "../rules/warmupLevel";
import { lightenPlannedSession } from "../rules/lightenPlannedSession";
import type { PlannedSession } from "../rules/planSession";
import type { LightenFeatures } from "../pulse/lightenForest";
import { recordLightenDecision } from "../pulse/lightenLearning";
import { runWarmupLightenGate } from "../pulse/warmupLightenGate";
import type { BpmSample } from "../pulse/warmupWoundUp";

export interface PendingWarmupLighten {
  readonly features: LightenFeatures;
  readonly preferLight: boolean;
}

/**
 * After the last warmup station: maybe ask to lighten. Null = continue as planned.
 */
export function pendingLightenAfterWarmup(input: {
  planned: PlannedSession;
  samples: readonly BpmSample[];
  endAtMs: number;
}): PendingWarmupLighten | null {
  if (input.planned.lightDay) {
    return null;
  }
  const gate = runWarmupLightenGate({
    readiness: input.planned.readiness,
    warmupLevel: input.planned.warmupLevel ?? DEFAULT_WARMUP_LEVEL,
    samples: input.samples,
    endAtMs: input.endAtMs,
  });
  if (!gate.shouldAsk) {
    return null;
  }
  return { features: gate.features, preferLight: gate.preferLight };
}

export function resolveWarmupLightenChoice(input: {
  planned: PlannedSession;
  pending: PendingWarmupLighten;
  acceptedLight: boolean;
  sessionStartedAtMs: number;
}): PlannedSession {
  recordLightenDecision(
    input.pending.features,
    input.acceptedLight,
    input.sessionStartedAtMs,
  );
  return input.acceptedLight ? lightenPlannedSession(input.planned) : input.planned;
}
