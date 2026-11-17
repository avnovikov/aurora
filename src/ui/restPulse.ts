import type { HeartRateZone } from "../pulse/hrZones";
import { GET_READY_AT_SECONDS_LEFT } from "../voice/restCue";

/** Extra rest added while the pulse is still above steady. */
export const REST_ADD_SECONDS = 30;

const RESTED_ZONES = new Set<HeartRateZone>(["easy", "steady"]);

export interface RestedOfferInput {
  zone: HeartRateZone | null;
  secondsLeft: number;
  alreadyAsked: boolean;
}

/**
 * One offer to start early. Level 2 is `steady` (several short sentences);
 * `easy` counts too. The last 10 seconds belong to Get ready.
 */
export function shouldOfferRestedGoOn(input: RestedOfferInput): boolean {
  if (input.alreadyAsked || input.zone === null) {
    return false;
  }
  if (input.secondsLeft <= GET_READY_AT_SECONDS_LEFT) {
    return false;
  }
  return RESTED_ZONES.has(input.zone);
}

/** True when expiry should add another 30 seconds instead of starting the next set. */
export function shouldAddRest(zone: HeartRateZone | null): boolean {
  if (zone === null) {
    return false;
  }
  return !RESTED_ZONES.has(zone);
}
