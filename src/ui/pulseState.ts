import type { PulseWatchState } from "../voice/pulseAlert";

export const INITIAL_PULSE: PulseWatchState = {
  connected: false,
  lastValidAtMs: null,
  lastShoutAtMs: null,
};

export function pulseConnectedAt(
  previous: PulseWatchState,
  nowMs: number,
): PulseWatchState {
  return {
    connected: true,
    lastValidAtMs: nowMs,
    lastShoutAtMs: previous.lastShoutAtMs,
  };
}

export function pulseDisconnected(previous: PulseWatchState): PulseWatchState {
  return {
    connected: false,
    lastValidAtMs: null,
    lastShoutAtMs: previous.lastShoutAtMs,
  };
}

/** Simulator: treat the strap as connected but silent long enough to shout. */
export function pulseLostSim(nowMs: number): PulseWatchState {
  return {
    connected: true,
    lastValidAtMs: nowMs - 6000,
    lastShoutAtMs: null,
  };
}
