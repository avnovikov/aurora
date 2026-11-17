import { createKeyValueStore } from "../storage/keyValueStore";
import { WARMUP_HR_KEY } from "../storage/storageKeys";
import type { WarmupLevel } from "../domain/program";

/** How many comparable warmups before a personal baseline is trusted. */
export const WARMUP_HR_BASELINE_MIN = 5;

/** Keep a short rolling history per warmup level. */
const MAX_SAMPLES_PER_LEVEL = 30;

export const MIN_USABLE_BPM = 30;
export const MAX_USABLE_BPM = 220;
export const MIN_BPM_SAMPLES_FOR_AVERAGE = 3;

export interface WarmupHrSample {
  readonly averagedAt: string;
  readonly averageBpm: number;
  readonly warmupLevel: WarmupLevel;
}

interface WarmupHrStore {
  readonly byLevel: Partial<Record<WarmupLevel, WarmupHrSample[]>>;
}

const store = createKeyValueStore(WARMUP_HR_KEY);
const EMPTY_STORE: WarmupHrStore = { byLevel: {} };

function readStore(): WarmupHrStore {
  const raw = store.read();
  if (!raw) {
    return EMPTY_STORE;
  }
  try {
    const parsed = JSON.parse(raw) as WarmupHrStore;
    return parsed?.byLevel ? parsed : EMPTY_STORE;
  } catch {
    return EMPTY_STORE;
  }
}

function writeStore(next: WarmupHrStore): void {
  store.write(JSON.stringify(next));
}

/** Round and clamp a usable whole bpm average. */
export function averageWarmupBpm(samples: readonly number[]): number | null {
  const usable = samples.filter(
    (bpm) => Number.isFinite(bpm) && bpm >= MIN_USABLE_BPM && bpm <= MAX_USABLE_BPM,
  );
  if (usable.length < MIN_BPM_SAMPLES_FOR_AVERAGE) {
    return null;
  }
  return Math.round(usable.reduce((sum, bpm) => sum + bpm, 0) / usable.length);
}

export function recordWarmupAverage(
  warmupLevel: WarmupLevel,
  averageBpm: number,
  averagedAt: string = new Date().toISOString(),
): WarmupHrSample[] {
  assertWholeBpm(averageBpm);
  const all = readStore();
  const prior = all.byLevel[warmupLevel] ?? [];
  const sample: WarmupHrSample = { averagedAt, averageBpm, warmupLevel };
  const next = [...prior, sample].slice(-MAX_SAMPLES_PER_LEVEL);
  writeStore({ byLevel: { ...all.byLevel, [warmupLevel]: next } });
  return next;
}

/** Persist this warmup's average when enough usable samples exist. */
export function recordWarmupAverageFromSamples(
  warmupLevel: WarmupLevel,
  bpmSamples: readonly number[],
): number | null {
  const averageBpm = averageWarmupBpm(bpmSamples);
  if (averageBpm === null) {
    return null;
  }
  recordWarmupAverage(warmupLevel, averageBpm);
  return averageBpm;
}

export function warmupHrSamples(warmupLevel: WarmupLevel): WarmupHrSample[] {
  return [...(readStore().byLevel[warmupLevel] ?? [])];
}

/** Median of stored averages, or null until baseline is mature. */
export function warmupHrMedian(warmupLevel: WarmupLevel): number | null {
  const samples = warmupHrSamples(warmupLevel);
  if (samples.length < WARMUP_HR_BASELINE_MIN) {
    return null;
  }
  const sorted = samples.map((s) => s.averageBpm).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
  }
  return sorted[mid]!;
}

function assertWholeBpm(bpm: number): void {
  if (!Number.isInteger(bpm) || bpm < MIN_USABLE_BPM || bpm > MAX_USABLE_BPM) {
    throw new Error(
      `warmup average bpm must be a whole number ${MIN_USABLE_BPM}–${MAX_USABLE_BPM}; got ${bpm}`,
    );
  }
}
