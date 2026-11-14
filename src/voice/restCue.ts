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

const COUNT_IDS: Record<number, CoachLineId> = {
  5: "five",
  4: "four",
  3: "three",
  2: "two",
  1: "one",
};

/**
 * Pure schedule for rest end cues. Rest < 10s skips "Get ready".
 * get_ready / go text picked once so on-screen matches the spoken line.
 */
export function cueSchedule(
  remainingSeconds: number,
  random: () => number = Math.random,
): RestCueEvent[] {
  if (!Number.isFinite(remainingSeconds) || remainingSeconds < 0) {
    throw new Error(`remainingSeconds must be >= 0; got ${remainingSeconds}`);
  }
  const events: RestCueEvent[] = [];
  if (remainingSeconds >= 10) {
    const ready = pickLine("get_ready", random);
    events.push({
      atSecondsLeft: 10,
      kind: "get_ready",
      text: ready.text,
      lineId: ready.id,
      assetKey: ready.assetKey,
    });
  }
  const countFrom = Math.min(5, Math.floor(remainingSeconds));
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
