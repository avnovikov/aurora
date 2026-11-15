import { pickLine, type CoachLineId } from "./lines";

/** Minimum hold length that gets a mid-hold cue (shorter is too cramped). */
export const MIN_HOLD_SECONDS_FOR_HALFWAY = 6;

export interface HoldCueEvent {
  atSecondsLeft: number;
  text: string;
  lineId: CoachLineId;
  assetKey: string;
}

/**
 * Pure schedule for a station hold: one halfway line when the hold is long
 * enough. Text is picked once so on-screen matches speech.
 */
export function holdCueSchedule(
  holdSeconds: number,
  random: () => number = Math.random,
): HoldCueEvent[] {
  if (!Number.isInteger(holdSeconds) || holdSeconds < 0) {
    throw new Error(`holdSeconds must be a non-negative integer; got ${holdSeconds}`);
  }
  if (holdSeconds < MIN_HOLD_SECONDS_FOR_HALFWAY) {
    return [];
  }
  const halfway = pickLine("halfway", random);
  return [
    {
      atSecondsLeft: Math.ceil(holdSeconds / 2),
      text: halfway.text,
      lineId: halfway.id,
      assetKey: halfway.assetKey,
    },
  ];
}
