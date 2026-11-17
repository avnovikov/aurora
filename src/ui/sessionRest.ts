import type { HeartRateZone } from "../pulse/hrZones";
import { speakExactLine } from "../voice/coachVoice";
import { REST_EXTEND, REST_GO_ON, type CoachLine } from "../voice/lines";
import {
  cueSchedule,
  isOnScreenRestCue,
  type RestCueEvent,
} from "../voice/restCue";
import { REST_ADD_SECONDS, shouldAddRest, shouldOfferRestedGoOn } from "./restPulse";
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
  if (!due || !isOnScreenRestCue(due.kind)) {
    return null;
  }
  return due.text;
}

function speakRestCue(
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

function visibleRestCue(
  left: number,
  schedule: readonly RestCueEvent[],
  heldCue: string | null,
): string {
  return restCueText(left, schedule) ?? heldCue ?? "";
}

function paintRest(
  root: HTMLElement,
  left: number,
  schedule: readonly RestCueEvent[],
  heldCue: string | null,
): void {
  setText(root, "[data-rest-left]", String(Math.max(left, 0)));
  setText(root, "[data-rest-cue]", visibleRestCue(left, schedule, heldCue));
}

export interface RestTimerHandle {
  clear: () => void;
  /** End the rest now: stop the countdown and hand over as if it ran out. */
  finish: () => void;
}

export interface RestTimerOptions {
  /** Next work is a hold / timed station — no 5–1 countdown. */
  timedNext?: boolean;
  /** Live band, or null when the strap has no usable reading. */
  readZone?: () => HeartRateZone | null;
}

export function startRestTimer(
  root: HTMLElement,
  state: ViewState,
  withVoice: boolean,
  onDoneRest: () => void,
  options: RestTimerOptions = {},
): RestTimerHandle {
  const spokenForRest = new Set<number>();
  const readZone = options.readZone ?? (() => null);
  const timedNext = options.timedNext === true;
  let schedule = restSchedule(state.restLeft, withVoice, timedNext);
  let alreadyAsked = false;
  let heldCue: string | null = null;
  let finished = false;

  const paint = (): void => {
    paintRest(root, state.restLeft, schedule, heldCue);
  };

  const speakLine = (line: CoachLine): void => {
    if (!withVoice) {
      return;
    }
    void speakExactLine(line);
  };

  const finish = (): void => {
    if (finished) {
      return;
    }
    finished = true;
    window.clearInterval(timerId);
    state.restLeft = 0;
    onDoneRest();
  };

  const extendRest = (): void => {
    state.restLeft = REST_ADD_SECONDS;
    schedule = restSchedule(state.restLeft, withVoice, timedNext);
    spokenForRest.clear();
    heldCue = REST_EXTEND.text;
    paint();
    speakLine(REST_EXTEND);
  };

  paint();

  const timerId = window.setInterval(() => {
    state.restLeft -= 1;
    if (state.restLeft <= 0) {
      if (shouldAddRest(readZone())) {
        extendRest();
        return;
      }
      finish();
      return;
    }
    if (
      shouldOfferRestedGoOn({
        zone: readZone(),
        secondsLeft: state.restLeft,
        alreadyAsked,
      })
    ) {
      alreadyAsked = true;
      heldCue = REST_GO_ON.text;
      speakLine(REST_GO_ON);
    }
    paint();
    if (withVoice) {
      speakRestCue(state.restLeft, schedule, spokenForRest);
    }
  }, 1000);

  return {
    clear: () => window.clearInterval(timerId),
    finish,
  };
}

function restSchedule(
  remainingSeconds: number,
  withVoice: boolean,
  timedNext: boolean,
): RestCueEvent[] {
  if (!withVoice) {
    return [];
  }
  return cueSchedule(remainingSeconds, { timedNext });
}

function setText(root: HTMLElement, selector: string, text: string): void {
  const el = root.querySelector(selector);
  if (el) {
    el.textContent = text;
  }
}