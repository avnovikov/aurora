import { speakExactLine } from "../voice/coachVoice";
import { cueSchedule, type RestCueEvent } from "../voice/restCue";
import type { ViewState } from "./sessionTypes";

function cueAt(
  left: number,
  schedule: readonly RestCueEvent[],
): RestCueEvent | undefined {
  return schedule.find((event) => event.atSecondsLeft === left);
}

/** On-screen rest cue copy for a given second; null when only the count shows. */
export function restCueText(
  left: number,
  schedule: readonly RestCueEvent[],
): string | null {
  const due = cueAt(left, schedule);
  if (!due || due.kind === "rest_banter") {
    return null;
  }
  return due.text;
}

function speakDueCues(
  left: number,
  schedule: readonly RestCueEvent[],
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

export interface RestTimerHandle {
  clear: () => void;
  /** End the rest now: stop the countdown and hand over as if it ran out. */
  finish: () => void;
}

export interface RestTimerOptions {
  /** Next work is a hold / timed station — no 5–1 countdown. */
  timedNext?: boolean;
}

export function startRestTimer(
  root: HTMLElement,
  state: ViewState,
  withVoice: boolean,
  onDoneRest: () => void,
  options: RestTimerOptions = {},
): RestTimerHandle {
  const spokenForRest = new Set<number>();
  const schedule = withVoice
    ? cueSchedule(state.restLeft, { timedNext: options.timedNext === true })
    : [];

  const paintRest = (): void => {
    setText(root, "[data-rest-left]", String(Math.max(state.restLeft, 0)));
    setText(root, "[data-rest-cue]", restCueText(state.restLeft, schedule) ?? "");
  };

  paintRest();

  const finish = (): void => {
    window.clearInterval(timerId);
    state.restLeft = 0;
    onDoneRest();
  };

  const timerId = window.setInterval(() => {
    state.restLeft -= 1;
    paintRest();
    if (withVoice) {
      speakDueCues(state.restLeft, schedule, spokenForRest);
    }
    if (state.restLeft <= 0) {
      finish();
    }
  }, 1000);

  return {
    clear: () => window.clearInterval(timerId),
    finish,
  };
}

function setText(root: HTMLElement, selector: string, text: string): void {
  const el = root.querySelector(selector);
  if (el) {
    el.textContent = text;
  }
}
