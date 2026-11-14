import { speakExactLine } from "../voice/coachVoice";
import { cueSchedule } from "../voice/restCue";
import type { ViewState } from "./sessionTypes";

export function formatRestLabel(
  left: number,
  schedule: ReturnType<typeof cueSchedule>,
): string {
  const due = schedule.find((event) => event.atSecondsLeft === left);
  if (due) {
    return due.text;
  }
  return String(Math.max(left, 0));
}

export function speakDueCues(
  left: number,
  schedule: ReturnType<typeof cueSchedule>,
  spoken: Set<number>,
): void {
  const due = schedule.find((event) => event.atSecondsLeft === left);
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
}

export function startRestTimer(
  root: HTMLElement,
  state: ViewState,
  withVoice: boolean,
  onDoneRest: () => void,
): RestTimerHandle {
  const spokenForRest = new Set<number>();
  const schedule = withVoice ? cueSchedule(state.restLeft) : [];

  const timerId = window.setInterval(() => {
    state.restLeft -= 1;
    const label = root.querySelector("[data-rest-left]");
    if (label) {
      label.textContent = formatRestLabel(state.restLeft, schedule);
    }
    if (withVoice) {
      speakDueCues(state.restLeft, schedule, spokenForRest);
    }
    if (state.restLeft <= 0) {
      window.clearInterval(timerId);
      onDoneRest();
    }
  }, 1000);

  return {
    clear: () => window.clearInterval(timerId),
  };
}