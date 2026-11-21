import { holdCueSchedule, type HoldCueEvent } from "../voice/holdCue";
import { paintHoldCountdown, speakDueHoldCue } from "./holdCuePlayback";
import type { ViewState } from "./sessionTypes";

export interface WorkHoldTimerHandle {
  /** Stop the clock without auto-completing (manual log / leave phase). */
  clear: () => void;
}

export interface WorkHoldCallbacks {
  /** Clock hit 0 after hold_done was spoken. */
  onComplete: () => void;
}

/**
 * Auto countdown for a work hold set: halfway (when scheduled), 5–1, hold_done,
 * then onComplete. clear() skips remaining cues and does not complete.
 */
export function startWorkHold(
  root: HTMLElement,
  state: ViewState,
  holdSeconds: number,
  callbacks: WorkHoldCallbacks,
): WorkHoldTimerHandle {
  if (!Number.isInteger(holdSeconds) || holdSeconds < 0) {
    throw new Error(`holdSeconds must be a non-negative integer; got ${holdSeconds}`);
  }

  let left = holdSeconds;
  const schedule = holdCueSchedule(holdSeconds, {
    random: Math.random,
    effort: "hold",
    includeCountdown: true,
    includeHoldDone: true,
  });
  const spoken = new Set<number>();
  syncAndPaint(root, state, left, schedule);

  let finished = false;
  const stop = (): void => {
    if (finished) {
      return;
    }
    finished = true;
    window.clearInterval(timerId);
    state.holdLeft = 0;
  };

  const timerId = window.setInterval(() => {
    left -= 1;
    syncAndPaint(root, state, left, schedule);
    speakDueHoldCue(left, schedule, spoken);
    if (left <= 0) {
      stop();
      callbacks.onComplete();
    }
  }, 1000);

  return { clear: stop };
}

function syncAndPaint(
  root: HTMLElement,
  state: ViewState,
  left: number,
  schedule: readonly HoldCueEvent[],
): void {
  state.holdLeft = Math.max(left, 0);
  paintHoldCountdown(root, "[data-work-hold-left]", left, schedule);
}
