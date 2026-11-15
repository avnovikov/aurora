import type { WarmupStep } from "../rules/warmupPlan";
import type { ViewState } from "./sessionTypes";

export interface WarmupTimerHandle {
  clear: () => void;
}

export interface WarmupRunnerCallbacks {
  onRestGap: (gapSeconds: number, resumeStations: () => void) => void;
  onAdvance: () => void;
  onPaint: () => void;
}

/**
 * Run one timed station (warm-up or cool-down): count the hold down, then
 * take the gap as a short rest and come back to `stationPhase` to advance.
 */
export function startStationHold(
  root: HTMLElement,
  step: WarmupStep | undefined,
  state: ViewState,
  stationPhase: "warmup" | "cooldown",
  callbacks: WarmupRunnerCallbacks,
): WarmupTimerHandle | null {
  if (!step) {
    callbacks.onAdvance();
    return null;
  }
  let left = step.holdSeconds;
  const timerId = window.setInterval(() => {
    left -= 1;
    const countdown = root.querySelector("[data-warmup-left]");
    if (countdown) {
      countdown.textContent = String(Math.max(left, 0));
    }
    if (left <= 0) {
      window.clearInterval(timerId);
      const gap = step.gapSecondsAfter;
      if (gap > 0) {
        state.phase = "rest";
        state.restLeft = gap;
        callbacks.onPaint();
        callbacks.onRestGap(gap, () => {
          state.phase = stationPhase;
          callbacks.onAdvance();
        });
      } else {
        callbacks.onAdvance();
      }
    }
  }, 1000);

  return {
    clear: () => window.clearInterval(timerId),
  };
}
