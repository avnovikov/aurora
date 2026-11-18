import type { EffortKind } from "../domain/types";
import { pickLine, type CoachLineId } from "./lines";

/** Minimum hold length that gets a mid-hold cue (shorter is too cramped). */
export const MIN_HOLD_SECONDS_FOR_HALFWAY = 6;

export interface HoldCueEvent {
  atSecondsLeft: number;
  text: string;
  lineId: CoachLineId;
  assetKey: string;
}

export interface HoldCueScheduleOptions {
  effort?: EffortKind;
  kettlebellContext?: boolean;
  random?: () => number;
}

/**
 * Pure schedule for a timed station: one halfway line when it is long enough.
 * A rep station never hears "hold it there", a hold never hears "keep the reps
 * coming". Text is picked once so on-screen matches speech.
 */
export function holdCueSchedule(
  holdSeconds: number,
  randomOrOptions: (() => number) | HoldCueScheduleOptions = Math.random,
  effortArg: EffortKind = "hold",
): HoldCueEvent[] {
  const { random, effort, kettlebellContext } = resolveHoldCueOptions(
    randomOrOptions,
    effortArg,
  );
  if (!Number.isInteger(holdSeconds) || holdSeconds < 0) {
    throw new Error(`holdSeconds must be a non-negative integer; got ${holdSeconds}`);
  }
  if (holdSeconds < MIN_HOLD_SECONDS_FOR_HALFWAY) {
    return [];
  }
  const halfway = pickLine("halfway", random, { effort, kettlebellContext });
  return [
    {
      atSecondsLeft: Math.ceil(holdSeconds / 2),
      text: halfway.text,
      lineId: halfway.id,
      assetKey: halfway.assetKey,
    },
  ];
}

function resolveHoldCueOptions(
  randomOrOptions: (() => number) | HoldCueScheduleOptions,
  effortArg: EffortKind,
): { random: () => number; effort: EffortKind; kettlebellContext?: boolean } {
  if (typeof randomOrOptions === "function") {
    return { random: randomOrOptions, effort: effortArg };
  }
  return {
    random: randomOrOptions.random ?? Math.random,
    effort: randomOrOptions.effort ?? effortArg,
    kettlebellContext: randomOrOptions.kettlebellContext,
  };
}
