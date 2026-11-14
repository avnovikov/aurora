import { speakCue } from "./restCue";

export const PULSE_NOT_READABLE = "Pulse not readable";

export interface PulseWatchState {
  connected: boolean;
  lastValidAtMs: number | null;
  lastShoutAtMs: number | null;
}

const SILENCE_MS = 5000;
const REPEAT_MS = 15000;

export function shouldShoutPulseLost(
  state: PulseWatchState,
  nowMs: number,
): boolean {
  if (!state.connected || state.lastValidAtMs === null) {
    return false;
  }
  const silentFor = nowMs - state.lastValidAtMs;
  if (silentFor < SILENCE_MS) {
    return false;
  }
  if (state.lastShoutAtMs === null) {
    return true;
  }
  return nowMs - state.lastShoutAtMs >= REPEAT_MS;
}

export function shoutPulseNotReadable(): void {
  speakCue(PULSE_NOT_READABLE, true);
}
