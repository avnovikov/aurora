import type { EffortKind } from "../domain/types";
import { pickLine, type CoachLineId } from "./lines";

/** Minimum hold length that gets a mid-hold cue (shorter is too cramped). */
export const MIN_HOLD_SECONDS_FOR_HALFWAY = 6;

/** Full end-countdown starts here; shorter holds count down from floor(hold) only. */
export const HOLD_COUNTDOWN_FROM = 5;

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
  /** Work holds and warmup stations: append 5–1 countdown (truncated for short holds). */
  includeCountdown?: boolean;
  /** Work holds and warmup stations: hold_done at 0. */
  includeHoldDone?: boolean;
}

const COUNT_LINE_IDS: Record<number, CoachLineId> = {
  5: "five",
  4: "four",
  3: "three",
  2: "two",
  1: "one",
};

/**
 * Pure schedule for a timed hold/station.
 * Default: one halfway line when long enough.
 * Work holds and warmup stations may also request 5–1 + hold_done. With
 * countdown, halfway only when the mid-point is after the countdown window
 * (mid > 5). Cool-down keeps the default (no end voice).
 */
export function holdCueSchedule(
  holdSeconds: number,
  randomOrOptions: (() => number) | HoldCueScheduleOptions = Math.random,
  effortArg: EffortKind = "hold",
): HoldCueEvent[] {
  const { random, effort, kettlebellContext, includeCountdown, includeHoldDone } =
    resolveHoldCueOptions(randomOrOptions, effortArg);
  if (!Number.isInteger(holdSeconds) || holdSeconds < 0) {
    throw new Error(`holdSeconds must be a non-negative integer; got ${holdSeconds}`);
  }

  const events: HoldCueEvent[] = [];
  const halfwayAt = Math.ceil(holdSeconds / 2);
  const halfwayFits =
    holdSeconds >= MIN_HOLD_SECONDS_FOR_HALFWAY &&
    (!includeCountdown || halfwayAt > HOLD_COUNTDOWN_FROM);

  if (halfwayFits) {
    events.push(
      eventFromLine(
        halfwayAt,
        pickLine("halfway", random, { effort, kettlebellContext }),
      ),
    );
  }

  if (includeCountdown) {
    events.push(...countdownCues(holdSeconds));
  }

  if (includeHoldDone) {
    events.push(eventFromLine(0, pickLine("hold_done", random)));
  }

  return events;
}

/** Cue due at this second left, if any. */
export function holdCueAt(
  left: number,
  schedule: readonly HoldCueEvent[],
): HoldCueEvent | undefined {
  return schedule.find((event) => event.atSecondsLeft === left);
}

/** On-screen hold cue copy for a given second; null when nothing is due. */
export function holdCueText(
  left: number,
  schedule: readonly HoldCueEvent[],
): string | null {
  return holdCueAt(left, schedule)?.text ?? null;
}

function countdownCues(holdSeconds: number): HoldCueEvent[] {
  const countFrom = Math.min(HOLD_COUNTDOWN_FROM, Math.floor(holdSeconds));
  const events: HoldCueEvent[] = [];
  for (let n = countFrom; n >= 1; n -= 1) {
    const lineId = COUNT_LINE_IDS[n];
    if (lineId === undefined) {
      throw new Error(
        `No count line id for n=${n}; expected 1..${HOLD_COUNTDOWN_FROM}`,
      );
    }
    const line = pickLine(lineId, () => 0);
    events.push({
      ...eventFromLine(n, line),
      text: line.text.replace(/\.$/, ""),
    });
  }
  return events;
}

function eventFromLine(
  atSecondsLeft: number,
  line: { id: CoachLineId; assetKey: string; text: string },
): HoldCueEvent {
  return {
    atSecondsLeft,
    text: line.text,
    lineId: line.id,
    assetKey: line.assetKey,
  };
}

interface ResolvedHoldCueOptions {
  random: () => number;
  effort: EffortKind;
  kettlebellContext?: boolean;
  includeCountdown: boolean;
  includeHoldDone: boolean;
}

function resolveHoldCueOptions(
  randomOrOptions: (() => number) | HoldCueScheduleOptions,
  effortArg: EffortKind,
): ResolvedHoldCueOptions {
  if (typeof randomOrOptions === "function") {
    return {
      random: randomOrOptions,
      effort: effortArg,
      includeCountdown: false,
      includeHoldDone: false,
    };
  }
  return {
    random: randomOrOptions.random ?? Math.random,
    effort: randomOrOptions.effort ?? effortArg,
    kettlebellContext: randomOrOptions.kettlebellContext,
    includeCountdown: randomOrOptions.includeCountdown === true,
    includeHoldDone: randomOrOptions.includeHoldDone === true,
  };
}
