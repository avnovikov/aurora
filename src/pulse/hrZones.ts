/** Five training bands from resting and max heart rate (Karvonen). */

export const HEART_RATE_ZONES = ["easy", "steady", "work", "hard", "max"] as const;

export type HeartRateZone = (typeof HEART_RATE_ZONES)[number];

export interface HeartRateBounds {
  restingBpm: number;
  maxBpm: number;
}

/** Lower edge of each band as a fraction of heart-rate reserve. Below 0.6 is easy. */
const ZONE_LOWER_EDGE: readonly { zone: HeartRateZone; from: number }[] = [
  { zone: "max", from: 0.9 },
  { zone: "hard", from: 0.8 },
  { zone: "work", from: 0.7 },
  { zone: "steady", from: 0.6 },
];

function assertFiniteBpm(bpm: number): void {
  if (!Number.isFinite(bpm)) {
    throw new Error(`bpm must be a finite number; got ${bpm}`);
  }
}

function heartRateReserve(bounds: HeartRateBounds): number {
  const reserve = bounds.maxBpm - bounds.restingBpm;
  if (!Number.isFinite(reserve) || reserve <= 0) {
    throw new Error(
      `max heart rate must be above resting; got resting ${bounds.restingBpm}, max ${bounds.maxBpm}`,
    );
  }
  return reserve;
}

/** How far `bpm` has climbed from resting toward max (0 at resting, 1 at max). */
function reserveFraction(bpm: number, bounds: HeartRateBounds): number {
  return (bpm - bounds.restingBpm) / heartRateReserve(bounds);
}

function zoneForFraction(fraction: number): HeartRateZone {
  return ZONE_LOWER_EDGE.find((band) => fraction >= band.from)?.zone ?? "easy";
}

/**
 * Band for a live pulse. Reserve is max minus resting; the fraction is how far
 * the reading has climbed from resting toward max.
 */
export function heartRateZone(bpm: number, bounds: HeartRateBounds): HeartRateZone {
  assertFiniteBpm(bpm);
  return zoneForFraction(reserveFraction(bpm, bounds));
}
