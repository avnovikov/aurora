import { speakCoachLine } from "./coachVoice";

export const PULSE_NOT_READABLE = "Pulse not readable, mate.";

export interface PulseWatchState {
  connected: boolean;
  lastValidAtMs: number | null;
  lastShoutAtMs: number | null;
}

/** Coral on the session bar after this much silence. */
export const PULSE_LOST_UI_MS = 5_000;
/** Coach shout after this much silence (longer than coral — room movement is noisy). */
export const PULSE_LOST_SHOUT_MS = 15_000;
/** Minimum gap between shout repeats while the strap stays silent. */
export const PULSE_LOST_REPEAT_MS = 15_000;

function isSilentFor(
  state: PulseWatchState,
  nowMs: number,
  silenceMs: number,
): boolean {
  if (!state.connected || state.lastValidAtMs === null) {
    return false;
  }
  return nowMs - state.lastValidAtMs >= silenceMs;
}

/** True when the strap has been silent long enough for the coral lost style. */
export function shouldShowPulseLost(
  state: PulseWatchState,
  nowMs: number,
): boolean {
  return isSilentFor(state, nowMs, PULSE_LOST_UI_MS);
}

export function shouldShoutPulseLost(
  state: PulseWatchState,
  nowMs: number,
): boolean {
  if (!isSilentFor(state, nowMs, PULSE_LOST_SHOUT_MS)) {
    return false;
  }
  return (
    state.lastShoutAtMs === null ||
    nowMs - state.lastShoutAtMs >= PULSE_LOST_REPEAT_MS
  );
}

export function shoutPulseNotReadable(): void {
  void speakCoachLine("pulse_not_readable", { louder: true });
}
