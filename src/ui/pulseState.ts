import {
  PULSE_LOST_SHOUT_MS,
  type PulseWatchState,
} from "../voice/pulseAlert";

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

/** Past the shout threshold so the sim button fires the coach line. */
const PULSE_LOST_SIM_SILENCE_MS = PULSE_LOST_SHOUT_MS + 1_000;

/** Simulator: treat the strap as connected but silent long enough to shout. */
export function pulseLostSim(nowMs: number): PulseWatchState {
  return {
    connected: true,
    lastValidAtMs: nowMs - PULSE_LOST_SIM_SILENCE_MS,
    lastShoutAtMs: null,
  };
}
