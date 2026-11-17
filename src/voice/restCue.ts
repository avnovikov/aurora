import { pickLine, type CoachLine, type CoachLineId } from "./lines";

export type RestCueKind = "rest_banter" | "get_ready" | "count" | "go";

export interface RestCueEvent {
  atSecondsLeft: number;
  kind: RestCueKind;
  text: string;
  lineId: CoachLineId;
  /** Exact prebuilt asset so speech matches on-screen text */
  assetKey: string;
}

export interface CueScheduleOptions {
  /**
   * Next work is a timed hold (or a timed station). Skip 5–1 countdown —
   * only mid-banter (when long), "Get ready..." then "Go".
   */
  timedNext?: boolean;
  random?: () => number;
}

/** Banter only when initial rest is strictly longer than this (fires at halfway). */
export const REST_BANTER_AFTER_SECONDS = 30;

/** Seconds left when "Get ready" is spoken (when rest is at least this long). */
export const GET_READY_AT_SECONDS_LEFT = 10;

/** Full countdown starts here; shorter rests count down from `floor(rest)` only. */
export const REST_COUNTDOWN_FROM = 5;

const VOICE_ONLY_REST_CUE_KINDS = new Set<RestCueKind>(["rest_banter"]);

const COUNT_LINE_IDS: Record<number, CoachLineId> = {
  5: "five",
  4: "four",
  3: "three",
  2: "two",
  1: "one",
};

/** True when the cue may paint into `[data-rest-cue]` (banter is voice-only). */
export function isOnScreenRestCue(kind: RestCueKind): boolean {
  return !VOICE_ONLY_REST_CUE_KINDS.has(kind);
}

/**
 * Pure schedule for rest voice cues.
 * Rest > 30s: banter at ceil(rest/2). Rest ≥ 10s: get_ready at 10.
 * Not timedNext: count 5–1 (truncated for short rests). Always: go at 0.
 */
export function cueSchedule(
  remainingSeconds: number,
  options: CueScheduleOptions | (() => number) = {},
): RestCueEvent[] {
  const { random, timedNext } = resolveCueScheduleOptions(options);
  assertNonNegativeFiniteSeconds(remainingSeconds);

  const events: RestCueEvent[] = [];
  const banter = restBanterCue(remainingSeconds, random);
  if (banter) {
    events.push(banter);
  }

  const getReady = getReadyCue(remainingSeconds, random);
  if (getReady) {
    events.push(getReady);
  }

  if (!timedNext) {
    events.push(...countdownCues(remainingSeconds));
  }

  events.push(goCue(random));
  return events;
}

function resolveCueScheduleOptions(
  options: CueScheduleOptions | (() => number),
): { random: () => number; timedNext: boolean } {
  if (typeof options === "function") {
    return { random: options, timedNext: false };
  }
  return {
    random: options.random ?? Math.random,
    timedNext: options.timedNext === true,
  };
}

function assertNonNegativeFiniteSeconds(remainingSeconds: number): void {
  if (!Number.isFinite(remainingSeconds) || remainingSeconds < 0) {
    throw new Error(`remainingSeconds must be >= 0; got ${remainingSeconds}`);
  }
}

function restCueFromLine(
  atSecondsLeft: number,
  kind: RestCueKind,
  line: CoachLine,
  text = line.text,
): RestCueEvent {
  return {
    atSecondsLeft,
    kind,
    text,
    lineId: line.id,
    assetKey: line.assetKey,
  };
}

function restBanterCue(
  remainingSeconds: number,
  random: () => number,
): RestCueEvent | undefined {
  if (remainingSeconds <= REST_BANTER_AFTER_SECONDS) {
    return undefined;
  }
  const line = pickLine("rest_banter", random);
  return restCueFromLine(Math.ceil(remainingSeconds / 2), "rest_banter", line);
}

function getReadyCue(
  remainingSeconds: number,
  random: () => number,
): RestCueEvent | undefined {
  if (remainingSeconds < GET_READY_AT_SECONDS_LEFT) {
    return undefined;
  }
  const line = pickLine("get_ready", random);
  return restCueFromLine(GET_READY_AT_SECONDS_LEFT, "get_ready", line);
}

function countdownCues(remainingSeconds: number): RestCueEvent[] {
  const countFrom = Math.min(REST_COUNTDOWN_FROM, Math.floor(remainingSeconds));
  const events: RestCueEvent[] = [];
  for (let n = countFrom; n >= 1; n -= 1) {
    const lineId = COUNT_LINE_IDS[n];
    if (lineId === undefined) {
      throw new Error(
        `No count line id for n=${n}; expected 1..${REST_COUNTDOWN_FROM}`,
      );
    }
    const line = pickLine(lineId, () => 0);
    const text = line.text.replace(/\.$/, "");
    events.push(restCueFromLine(n, "count", line, text));
  }
  return events;
}

function goCue(random: () => number): RestCueEvent {
  const line = pickLine("go", random);
  return restCueFromLine(0, "go", line);
}

export function pickBritishVoice(
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | undefined {
  const preferred = voices.find(
    (voice) =>
      /en-GB/i.test(voice.lang) &&
      /liver|scouse|northern|daniel|reed|rocko|eddy/i.test(voice.name),
  );
  if (preferred) {
    return preferred;
  }
  return voices.find((voice) => /en-GB/i.test(voice.lang));
}
