import { SIDE_SWITCH_SECONDS, type WarmupStep } from "../rules/warmupPlan";
import { speakExactLine } from "../voice/coachVoice";
import { holdCueSchedule, type HoldCueEvent } from "../voice/holdCue";
import type { ViewState } from "./sessionTypes";

export interface WarmupTimerHandle {
  clear: () => void;
}

export interface WarmupRunnerCallbacks {
  onRestGap: (gapSeconds: number, resumeStations: () => void) => void;
  onAdvance: () => void;
  onPaint: () => void;
  /** Halfway through a per-side station: cue "change side" (voice). */
  onSideSwitch?: () => void;
}

/** Hold second (counting down) at which a per-side station changes side. */
export function sideSwitchAt(step: WarmupStep): number | null {
  return step.perSide === true ? Math.floor(step.holdSeconds / 2) : null;
}

function showSideSwitch(root: HTMLElement, secondsLeft: number | null): void {
  const banner = root.querySelector<HTMLElement>("[data-side-switch]");
  if (!banner) {
    return;
  }
  banner.hidden = secondsLeft === null;
  const count = banner.querySelector("[data-side-switch-left]");
  if (count && secondsLeft !== null) {
    count.textContent = String(secondsLeft);
  }
}

/**
 * Run one timed station (warm-up or cool-down): count the hold down, then
 * take the gap as a short rest and come back to `stationPhase` to advance.
 * A per-side station stops the clock halfway for a short "Change side" pause;
 * any other long enough hold gets one spoken halfway cue instead.
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
  const switchAt = sideSwitchAt(step);
  let switchLeft = 0;
  // A per-side station already speaks "Change side" at its halfway point.
  const schedule = switchAt === null ? holdCueSchedule(step.holdSeconds) : [];
  const spoken = new Set<number>();
  paintHold(root, left, schedule);

  const finishHold = (): void => {
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
  };

  const tickSwitch = (): void => {
    switchLeft -= 1;
    showSideSwitch(root, switchLeft > 0 ? switchLeft : null);
  };

  const tickHold = (): boolean => {
    left -= 1;
    paintHold(root, left, schedule);
    speakHoldCue(left, schedule, spoken);
    if (left === switchAt && left > 0) {
      switchLeft = SIDE_SWITCH_SECONDS;
      showSideSwitch(root, switchLeft);
      callbacks.onSideSwitch?.();
    }
    return left <= 0;
  };

  const timerId = window.setInterval(() => {
    if (switchLeft > 0) {
      tickSwitch();
      return;
    }
    if (tickHold()) {
      window.clearInterval(timerId);
      finishHold();
    }
  }, 1000);

  return {
    clear: () => window.clearInterval(timerId),
  };
}

/** On-screen hold cue for a given second left; null when nothing is due. */
export function holdCueText(
  left: number,
  schedule: readonly HoldCueEvent[],
): string | null {
  return cueAt(left, schedule)?.text ?? null;
}

function paintHold(
  root: HTMLElement,
  left: number,
  schedule: readonly HoldCueEvent[],
): void {
  setText(root, "[data-warmup-left]", String(Math.max(left, 0)));
  setText(root, "[data-hold-cue]", holdCueText(left, schedule) ?? "");
}

function speakHoldCue(
  left: number,
  schedule: readonly HoldCueEvent[],
  spoken: Set<number>,
): void {
  const due = cueAt(left, schedule);
  if (!due || spoken.has(left)) {
    return;
  }
  spoken.add(left);
  void speakExactLine({
    id: due.lineId,
    assetKey: due.assetKey,
    text: due.text,
  });
}

function cueAt(
  left: number,
  schedule: readonly HoldCueEvent[],
): HoldCueEvent | undefined {
  return schedule.find((event) => event.atSecondsLeft === left);
}

function setText(root: HTMLElement, selector: string, text: string): void {
  const el = root.querySelector(selector);
  if (el) {
    el.textContent = text;
  }
}
