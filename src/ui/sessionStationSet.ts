import type { WarmupStep } from "../rules/warmupPlan";

/** 1-based set progress within a consecutive same-station run. */
export interface StationSetProgress {
  current: number;
  total: number;
}

type StationSetStep = Pick<WarmupStep, "stationId" | "side">;

/** Left + right of one prescription round count as one set. */
const SEGMENTS_PER_SIDE_SET = 2;

/**
 * Set X of Y for a timed station index in a materialised warm-up list.
 * Same `stationId` in a row is one run; left/right pairs are one set each.
 * Null when there is only one set (nothing useful to show).
 */
export function stationSetProgress(
  steps: readonly StationSetStep[],
  index: number,
): StationSetProgress | null {
  const step = steps[index];
  if (!step) {
    return null;
  }
  const { start, length } = stationRunBounds(steps, index, step.stationId);
  const segmentsPerSet = runHasSides(steps, start, length) ? SEGMENTS_PER_SIDE_SET : 1;
  assert(
    length % segmentsPerSet === 0,
    `station run length ${length} must divide evenly by ${segmentsPerSet} for station ${step.stationId}`,
  );
  const total = length / segmentsPerSet;
  if (total <= 1) {
    return null;
  }
  const current = Math.floor((index - start) / segmentsPerSet) + 1;
  return { current, total };
}

/** Shared hero / rest copy: `Set 2 of 3`. */
export function formatSetLabel(current: number, total: number): string {
  assert(
    Number.isInteger(current) &&
      Number.isInteger(total) &&
      current >= 1 &&
      total >= 1 &&
      current <= total,
    `formatSetLabel expects 1 ≤ current ≤ total; got ${current} of ${total}`,
  );
  return `Set ${current} of ${total}`;
}

/** Warm-up set line only when the station run has more than one set. */
export function warmupStationSetLabel(
  steps: readonly StationSetStep[],
  index: number,
): string | undefined {
  const progress = stationSetProgress(steps, index);
  return progress ? formatSetLabel(progress.current, progress.total) : undefined;
}

function stationRunBounds(
  steps: readonly StationSetStep[],
  index: number,
  stationId: string,
): { start: number; length: number } {
  let start = index;
  while (start > 0 && steps[start - 1]!.stationId === stationId) {
    start -= 1;
  }
  let end = index;
  while (end + 1 < steps.length && steps[end + 1]!.stationId === stationId) {
    end += 1;
  }
  const length = end - start + 1;
  assert(length >= 1, `station run length must be ≥ 1; got ${length}`);
  return { start, length };
}

function runHasSides(
  steps: readonly StationSetStep[],
  start: number,
  length: number,
): boolean {
  const end = start + length - 1;
  for (let i = start; i <= end; i += 1) {
    const side = steps[i]!.side;
    if (side === "left" || side === "right") {
      return true;
    }
  }
  return false;
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
