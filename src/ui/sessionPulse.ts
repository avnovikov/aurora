import {
  connectHeartRate,
  isHeartRateLinkActive,
  type ConnectHeartRateResult,
} from "../pulse/hrMonitor";
import { shouldShowPulseLost } from "../voice/pulseAlert";
import { pulseConnectedAt } from "./pulseState";
import type { ViewState } from "./sessionTypes";
import { IDLE_CHIP } from "./todayPulse";

export interface SessionPulseHandlers {
  onPulseBpm: (bpm: number) => void;
  onPulseDisconnected: () => void;
  onPaint: () => void;
}

/** Paint connect outcome onto session view state. */
export function applyConnectHeartRateResult(
  state: ViewState,
  result: ConnectHeartRateResult,
  onPaint: () => void,
): void {
  if (result.ok) {
    state.pulse = pulseConnectedAt(state.pulse, Date.now());
    state.pulseStatus = null;
  } else {
    state.pulseStatus = result.message;
  }
  onPaint();
}

/**
 * If Today already opened (or is opening) the strap, attach session
 * listeners without a second BLE pair prompt.
 */
export function attachSessionPulse(
  state: ViewState,
  handlers: SessionPulseHandlers,
): void {
  if (!isHeartRateLinkActive()) {
    return;
  }
  void connectHeartRate(
    handlers.onPulseBpm,
    handlers.onPulseDisconnected,
  ).then((result) => {
    applyConnectHeartRateResult(state, result, handlers.onPaint);
  });
}

/** The chip text for the current reading: shared by the bar markup and the in-place update. */
export function pulseChipText(state: ViewState): string {
  return state.bpm === null ? IDLE_CHIP : `Pulse ${state.bpm}`;
}

/** Strap silent long enough for coral; voice waits longer. */
export function isPulseLost(
  state: ViewState,
  nowMs: number = Date.now(),
): boolean {
  return shouldShowPulseLost(state.pulse, nowMs);
}

/**
 * Show a new reading without repainting the session: a strap reports about
 * once a second, and a full repaint would drop a swipe in progress.
 */
export function paintPulseReading(
  root: HTMLElement,
  state: ViewState,
  nowMs: number = Date.now(),
): void {
  const chip = root.querySelector(".pulse-chip");
  if (chip) {
    chip.textContent = pulseChipText(state);
  }
  root
    .querySelector(".session-bar")
    ?.classList.toggle("pulse-lost", isPulseLost(state, nowMs));
}
