import { pickBritishVoice } from "./restCue";
import {
  pickLine,
  type CoachLine,
  type CoachLineId,
} from "./lines";

let muted = false;
let lastAudio: HTMLAudioElement | null = null;

export function setCoachMuted(next: boolean): void {
  muted = next;
  if (muted) {
    stopCoachVoice();
  }
}

export function isCoachMuted(): boolean {
  return muted;
}

export function stopCoachVoice(): void {
  if (lastAudio) {
    lastAudio.pause();
    lastAudio = null;
  }
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Prefer prebuilt /voice/{assetKey}.wav (Scouse copy, male en-GB bake).
 * Fall back to speechSynthesis when the asset is missing.
 */
export async function speakCoachLine(
  id: CoachLineId,
  options: { louder?: boolean; random?: () => number } = {},
): Promise<void> {
  if (muted) {
    return;
  }
  const line = pickLine(id, options.random);
  await speakExactLine(line, options.louder === true);
}

export async function speakExactLine(
  line: CoachLine,
  louder = false,
): Promise<void> {
  if (muted) {
    return;
  }
  const played = await tryPlayAsset(line, louder);
  if (!played) {
    speakFallback(line.text, louder);
  }
}

export async function speakCoachText(
  text: string,
  louder = false,
): Promise<void> {
  if (muted) {
    return;
  }
  speakFallback(text, louder);
}

async function tryPlayAsset(line: CoachLine, louder: boolean): Promise<boolean> {
  if (typeof window === "undefined" || typeof Audio === "undefined") {
    return false;
  }
  const url = `/voice/${line.assetKey}.wav`;
  try {
    stopCoachVoice();
    const audio = new Audio(url);
    audio.volume = louder ? 1 : 0.9;
    lastAudio = audio;
    await audio.play();
    return true;
  } catch {
    return false;
  }
}

function speakFallback(text: string, louder: boolean): void {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return;
  }
  stopCoachVoice();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-GB";
  utterance.rate = 0.85;
  utterance.pitch = 0.85;
  utterance.volume = louder ? 1 : 0.9;
  const voice = pickBritishVoice(window.speechSynthesis.getVoices());
  if (voice) {
    utterance.voice = voice;
  }
  window.speechSynthesis.speak(utterance);
}
