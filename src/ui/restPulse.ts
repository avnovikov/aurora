import type { HeartRateZone } from "../pulse/hrZones";
import { GET_READY_AT_SECONDS_LEFT, REST_ADD_SECONDS } from "../voice/restCue";

export { REST_ADD_SECONDS };

const RESTED_ENOUGH_TO_END = new Set<HeartRateZone>(["easy", "steady"]);
const GO_ON_ZONES = new Set<HeartRateZone>(["easy"]);

export interface RestedOfferInput {
  zone: HeartRateZone | null;
  secondsLeft: number;
  alreadyAsked: boolean;
}

/**
 * One offer to start early, only in the lowest band (`easy`).
 * The last 10 seconds belong to Get ready.
 */
export function shouldOfferRestedGoOn(input: RestedOfferInput): boolean {
  if (input.alreadyAsked || input.zone === null) {
    return false;
  }
  if (input.secondsLeft <= GET_READY_AT_SECONDS_LEFT) {
    return false;
  }
  return GO_ON_ZONES.has(input.zone);
}

/** True when expiry should add another 30 seconds instead of starting the next set. */
export function shouldAddRest(zone: HeartRateZone | null): boolean {
  if (zone === null) {
    return false;
  }
  return !RESTED_ENOUGH_TO_END.has(zone);
}
