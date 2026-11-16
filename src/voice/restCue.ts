import { pickLine, type CoachLineId } from "./lines";

export type RestCueKind = "get_ready" | "count" | "go";

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
   * Next work is a timed hold (or a timed station). Skip 4–1 countdown —
   * only "Get ready..." then "Go".
   */
  timedNext?: boolean;
  random?: () => number;
}

const COUNT_IDS: Record<number, CoachLineId> = {
  4: "four",
  3: "three",
  2: "two",
  1: "one",
};

/**
 * Pure schedule for rest end cues.
 * At 5s: get_ready variant (not "Five."). Timed next → no 4–1 counts.
 * On-screen text matches the prebuilt asset that will play.
 */
export function cueSchedule(
  remainingSeconds: number,
  options: CueScheduleOptions | (() => number) = {},
): RestCueEvent[] {
  const opts: CueScheduleOptions =
    typeof options === "function" ? { random: options } : options;
  const random = opts.random ?? Math.random;
  const timedNext = opts.timedNext === true;

  if (!Number.isFinite(remainingSeconds) || remainingSeconds < 0) {
    throw new Error(`remainingSeconds must be >= 0; got ${remainingSeconds}`);
  }
  const events: RestCueEvent[] = [];
  if (remainingSeconds >= 5) {
    const ready = pickLine("get_ready", random);
    events.push({
      atSecondsLeft: 5,
      kind: "get_ready",
      text: ready.text,
      lineId: ready.id,
      assetKey: ready.assetKey,
    });
  }
  if (!timedNext) {
    const countFrom = Math.min(4, Math.floor(remainingSeconds));
    for (let n = countFrom; n >= 1; n -= 1) {
      const lineId = COUNT_IDS[n];
      const line = pickLine(lineId, () => 0);
      events.push({
        atSecondsLeft: n,
        kind: "count",
        text: line.text.replace(/\.$/, ""),
        lineId,
        assetKey: line.assetKey,
      });
    }
  }
  const go = pickLine("go", random);
  events.push({
    atSecondsLeft: 0,
    kind: "go",
    text: go.text,
    lineId: go.id,
    assetKey: go.assetKey,
  });
  return events;
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
