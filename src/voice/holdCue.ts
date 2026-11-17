import type { EffortKind } from "../domain/types";
import { linesFor, type CoachLineId } from "./lines";

/** Minimum hold length that gets a mid-hold cue (shorter is too cramped). */
export const MIN_HOLD_SECONDS_FOR_HALFWAY = 6;

export interface HoldCueEvent {
  atSecondsLeft: number;
  text: string;
  lineId: CoachLineId;
  assetKey: string;
}

/**
 * Pure schedule for a timed station: one halfway line when it is long enough.
 * A rep station never gets a line that says "hold". Text is picked once so
 * on-screen matches speech.
 */
export function holdCueSchedule(
  holdSeconds: number,
  random: () => number = Math.random,
  effort: EffortKind = "hold",
): HoldCueEvent[] {
  if (!Number.isInteger(holdSeconds) || holdSeconds < 0) {
    throw new Error(`holdSeconds must be a non-negative integer; got ${holdSeconds}`);
  }
  if (holdSeconds < MIN_HOLD_SECONDS_FOR_HALFWAY) {
    return [];
  }
  const options = linesFor("halfway").filter((line) => effort === "hold" || line.holdOnly !== true);
  const halfway = options[Math.min(Math.floor(random() * options.length), options.length - 1)];
  return [
    {
      atSecondsLeft: Math.ceil(holdSeconds / 2),
      text: halfway.text,
      lineId: halfway.id,
      assetKey: halfway.assetKey,
    },
  ];
}
