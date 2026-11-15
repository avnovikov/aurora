import { pickBritishVoice } from "./restCue";
import {
  pickLine,
  type CoachLine,
  type CoachLineId,
} from "./lines";

let muted = false;
let lastAudio: HTMLAudioElement | null = null;
let audioUnlocked = false;

export function setCoachMuted(next: boolean): void {
  muted = next;
  if (muted) {
    stopCoachVoice();
  }
}

export function isCoachMuted(): boolean {
  return muted;
}

function stopCoachVoice(): void {
  if (lastAudio) {
    lastAudio.pause();
    lastAudio = null;
  }
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Call from a user tap (Start session). Chrome blocks audio until then.
 */
export async function unlockCoachAudio(): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }
  audioUnlocked = true;
  if (window.speechSynthesis) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.cancel();
    const warm = new SpeechSynthesisUtterance(" ");
    warm.volume = 0.01;
    warm.rate = 2;
    window.speechSynthesis.speak(warm);
    window.speechSynthesis.cancel();
  }
  try {
    const silent = new Audio(
      "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=",
    );
    silent.volume = 0.01;
    await silent.play();
    silent.pause();
  } catch {
    // Still mark unlocked; later play may succeed after this gesture.
  }
}

/**
 * Prefer prebuilt /voice/{assetKey}.wav. Fall back to speechSynthesis.
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
  if (!audioUnlocked) {
    await unlockCoachAudio();
  }
  const played = await tryPlayAsset(line, louder);
  if (!played) {
    speakFallback(line.text, louder);
  }
}

async function tryPlayAsset(line: CoachLine, louder: boolean): Promise<boolean> {
  if (typeof window === "undefined" || typeof Audio === "undefined") {
    return false;
  }
  const url = `/voice/${line.assetKey}.wav`;
  try {
    stopCoachVoice();
    const audio = new Audio(url);
    audio.preload = "auto";
    audio.volume = louder ? 1 : 0.95;
    lastAudio = audio;
    await new Promise<void>((resolve, reject) => {
      audio.addEventListener("canplaythrough", () => resolve(), { once: true });
      audio.addEventListener("error", () => reject(new Error("audio error")), {
        once: true,
      });
      audio.load();
      window.setTimeout(() => resolve(), 400);
    });
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
  if (lastAudio) {
    lastAudio.pause();
    lastAudio = null;
  }
  window.speechSynthesis.cancel();
  const speak = (): void => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-GB";
    utterance.rate = 0.9;
    utterance.pitch = 0.9;
    utterance.volume = louder ? 1 : 0.95;
    const voice = pickBritishVoice(window.speechSynthesis.getVoices());
    if (voice) {
      utterance.voice = voice;
    }
    window.speechSynthesis.speak(utterance);
  };
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) {
    window.speechSynthesis.addEventListener("voiceschanged", speak, { once: true });
    window.setTimeout(speak, 250);
    return;
  }
  speak();
}
