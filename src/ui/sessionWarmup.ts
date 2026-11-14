import type { PlannedSession } from "../rules/planSession";
import type { ViewState } from "./sessionTypes";

export interface WarmupTimerHandle {
  clear: () => void;
}

export interface WarmupRunnerCallbacks {
  onRestGap: (gapSeconds: number, resumeWarmup: () => void) => void;
  onAdvance: () => void;
  onPaint: () => void;
}

export function startWarmupHold(
  root: HTMLElement,
  planned: PlannedSession,
  state: ViewState,
  callbacks: WarmupRunnerCallbacks,
): WarmupTimerHandle | null {
  const step = planned.warmup[state.warmupIndex];
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
          state.phase = "warmup";
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