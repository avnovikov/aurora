import {
  connectHeartRate,
  isHeartRateLinkActive,
  type ConnectHeartRateResult,
} from "../pulse/hrMonitor";
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
  state.pulseStatus = result.message;
  if (result.ok) {
    state.pulse = pulseConnectedAt(state.pulse, Date.now());
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

/** Strap connected but no reading: the bar shows the pulse as lost. */
export function isPulseLost(state: ViewState): boolean {
  return state.pulse.connected && state.bpm === null;
}

/**
 * Show a new reading without repainting the session: a strap reports about
 * once a second, and a full repaint would drop a swipe in progress.
 */
export function paintPulseReading(root: HTMLElement, state: ViewState): void {
  const chip = root.querySelector(".pulse-chip");
  if (chip) {
    chip.textContent = pulseChipText(state);
  }
  root.querySelector(".session-bar")?.classList.toggle("pulse-lost", isPulseLost(state));
}
