import {
  SIDE_SWITCH_SECONDS,
  sideSwitchAt,
  stationEffort,
  type WarmupStep,
} from "../rules/warmupPlan";
import { setKettlebellCoachContext } from "../voice/coachContext";
import { speakExactLine } from "../voice/coachVoice";
import { holdCueSchedule, type HoldCueEvent } from "../voice/holdCue";
import { isKettlebellExercise } from "../voice/kettlebellExercise";
import type { ViewState } from "./sessionTypes";

export { sideSwitchAt };

export interface WarmupTimerHandle {
  clear: () => void;
  /** End the station now (the forward swipe): as if its clock ran out. */
  finish: () => void;
}

export interface WarmupRunnerCallbacks {
  onRestGap: (gapSeconds: number, resumeStations: () => void) => void;
  onAdvance: () => void;
  onPaint: () => void;
  /** Halfway through a per-side station: cue "change side" (voice). */
  onSideSwitch?: () => void;
}

/** Seed hold countdown on state before the first paint of a station. */
export function seedStationHold(state: ViewState, step: WarmupStep | undefined): void {
  state.holdLeft = step?.holdSeconds ?? 0;
  state.sideSwitchLeft = 0;
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
  const kettlebellContext = isKettlebellExercise(step);
  setKettlebellCoachContext(kettlebellContext);
  const schedule =
    switchAt === null
      ? holdCueSchedule(step.holdSeconds, {
          random: Math.random,
          effort: stationEffort(step),
          kettlebellContext,
        })
      : [];
  const spoken = new Set<number>();
  syncHoldProgress(state, left, switchLeft);
  paintHold(root, left, schedule);

  const finishHold = (): void => {
    syncHoldProgress(state, 0, 0);
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
    syncHoldProgress(state, left, switchLeft);
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
    syncHoldProgress(state, left, switchLeft);
    return left <= 0;
  };

  let finished = false;
  const finish = (): void => {
    if (finished) {
      return;
    }
    finished = true;
    window.clearInterval(timerId);
    finishHold();
  };

  const timerId = window.setInterval(() => {
    if (switchLeft > 0) {
      tickSwitch();
      return;
    }
    if (tickHold()) {
      finish();
    }
  }, 1000);

  return {
    clear: () => {
      window.clearInterval(timerId);
      syncHoldProgress(state, 0, 0);
    },
    finish,
  };
}

function syncHoldProgress(state: ViewState, holdLeft: number, sideSwitchLeft: number): void {
  state.holdLeft = holdLeft;
  state.sideSwitchLeft = sideSwitchLeft;
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
