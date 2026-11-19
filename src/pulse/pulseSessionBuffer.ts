import type { HistoryPulse } from "../domain/program";

export type { HistoryPulse };

/** Mirrors session `Phase` without importing UI into the pulse layer. */
export type PulsePhase = "warmup" | "work" | "rest" | "cooldown" | "done";

/** One downsampled strap reading during an open session. */
export interface PulseSample {
  readonly t: number;
  readonly bpm: number;
  readonly phase: PulsePhase;
  readonly exerciseId: string | null;
}

export interface PulseSessionBuffer {
  readonly samples: PulseSample[];
}

export function createPulseSessionBuffer(): PulseSessionBuffer {
  return { samples: [] };
}

/**
 * Append a sample, keeping at most one per UTC second (latest bpm wins).
 */
export function recordPulseSample(
  buffer: PulseSessionBuffer,
  sample: PulseSample,
): void {
  assertWholeBpm(sample.bpm);
  assertFiniteMs(sample.t);
  const normalized = normalizePulseSample(sample);
  const last = buffer.samples[buffer.samples.length - 1];
  if (last && sameUtcSecond(last.t, normalized.t)) {
    buffer.samples[buffer.samples.length - 1] = normalized;
    return;
  }
  buffer.samples.push(normalized);
}

function normalizePulseSample(sample: PulseSample): PulseSample {
  return {
    t: sample.t,
    bpm: sample.bpm,
    phase: sample.phase,
    exerciseId: sample.phase === "work" ? sample.exerciseId : null,
  };
}

function sameUtcSecond(aMs: number, bMs: number): boolean {
  return utcSecondFloor(aMs) === utcSecondFloor(bMs);
}

function utcSecondFloor(ms: number): number {
  return Math.floor(ms / 1000) * 1000;
}

/** Mean whole bpm in `[startMs, endMs]`, or null when empty. */
export function averageBpmInWindow(
  buffer: PulseSessionBuffer,
  startMs: number,
  endMs: number,
): number | null {
  assertFiniteMs(startMs);
  assertFiniteMs(endMs);
  if (endMs < startMs) {
    throw new Error(`pulse window end must be >= start; got ${startMs}..${endMs}`);
  }
  const bpms = buffer.samples
    .filter((s) => s.t >= startMs && s.t <= endMs)
    .map((s) => s.bpm);
  return meanWholeBpm(bpms);
}

/** Session timeseries + per-exercise means; undefined when nothing was recorded. */
export function buildHistoryPulse(
  buffer: PulseSessionBuffer,
): HistoryPulse | undefined {
  if (buffer.samples.length === 0) {
    return undefined;
  }
  return {
    series: buffer.samples.map((s) => ({ t: s.t, bpm: s.bpm })),
    byExercise: averageBpmByExercise(buffer.samples),
  };
}

function averageBpmByExercise(
  samples: readonly PulseSample[],
): HistoryPulse["byExercise"] {
  const byId = new Map<string, number[]>();
  for (const sample of samples) {
    if (!sample.exerciseId) {
      continue;
    }
    const list = byId.get(sample.exerciseId) ?? [];
    list.push(sample.bpm);
    byId.set(sample.exerciseId, list);
  }
  const byExercise: HistoryPulse["byExercise"] = [];
  for (const [exerciseId, bpms] of byId) {
    const averageBpm = meanWholeBpm(bpms);
    if (averageBpm === null) {
      continue;
    }
    byExercise.push({ exerciseId, averageBpm, sampleCount: bpms.length });
  }
  return byExercise;
}

function meanWholeBpm(bpms: readonly number[]): number | null {
  if (bpms.length === 0) {
    return null;
  }
  const sum = bpms.reduce((acc, n) => acc + n, 0);
  return Math.round(sum / bpms.length);
}

function assertWholeBpm(bpm: number): void {
  if (!Number.isInteger(bpm) || bpm < 1) {
    throw new Error(`bpm must be a positive integer; got ${bpm}`);
  }
}

function assertFiniteMs(ms: number): void {
  if (!Number.isFinite(ms)) {
    throw new Error(`timestamp must be finite ms; got ${ms}`);
  }
}
