export type RestCueKind = "get_ready" | "count" | "go";

export interface RestCueEvent {
  atSecondsLeft: number;
  kind: RestCueKind;
  text: string;
}

const COUNT_WORDS: Record<number, string> = {
  5: "five",
  4: "four",
  3: "three",
  2: "two",
  1: "one",
};

/**
 * Pure schedule for rest end cues. Rest < 10s skips "Get ready".
 */
export function cueSchedule(remainingSeconds: number): RestCueEvent[] {
  if (!Number.isFinite(remainingSeconds) || remainingSeconds < 0) {
    throw new Error(`remainingSeconds must be >= 0; got ${remainingSeconds}`);
  }
  const events: RestCueEvent[] = [];
  if (remainingSeconds >= 10) {
    events.push({ atSecondsLeft: 10, kind: "get_ready", text: "Get ready" });
  }
  const countFrom = Math.min(5, Math.floor(remainingSeconds));
  for (let n = countFrom; n >= 1; n -= 1) {
    events.push({
      atSecondsLeft: n,
      kind: "count",
      text: COUNT_WORDS[n] ?? String(n),
    });
  }
  events.push({ atSecondsLeft: 0, kind: "go", text: "Go" });
  return events;
}

export function pickBritishVoice(
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | undefined {
  const scouse = voices.find((voice) =>
    /en-GB/i.test(voice.lang) && /liver|scouse|northern/i.test(voice.name),
  );
  if (scouse) {
    return scouse;
  }
  return voices.find((voice) => /en-GB/i.test(voice.lang));
}

export function speakCue(text: string, louder = false): void {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-GB";
  utterance.rate = 0.9;
  utterance.volume = louder ? 1 : 0.85;
  const voice = pickBritishVoice(window.speechSynthesis.getVoices());
  if (voice) {
    utterance.voice = voice;
  }
  window.speechSynthesis.speak(utterance);
}
