import {
  connectHeartRate,
  isHeartRateLinkActive,
  type ConnectHeartRateResult,
} from "../pulse/hrMonitor";
import { pulseConnectedAt } from "./pulseState";
import type { ViewState } from "./sessionTypes";

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
