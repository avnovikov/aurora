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
  heldCue: CoachLine | null,
): string {
  return restCueText(left, schedule) ?? heldCue?.text ?? "";
}

function paintRest(
  root: HTMLElement,
  left: number,
  schedule: readonly RestCueEvent[],
  heldCue: CoachLine | null,
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

interface RestTickState {
  alreadyAsked: boolean;
  heldCue: CoachLine | null;
  schedule: RestCueEvent[];
  spokenForRest: Set<number>;
}

type RestTickOutcome = "continue" | "extended" | "finished";

export function startRestTimer(
  root: HTMLElement,
  state: ViewState,
  withVoice: boolean,
  onDoneRest: () => void,
  options: RestTimerOptions = {},
): RestTimerHandle {
  const readZone = options.readZone ?? (() => null);
  const timedNext = options.timedNext === true;
  const tickState: RestTickState = {
    alreadyAsked: false,
    heldCue: null,
    schedule: restSchedule(state.restLeft, withVoice, timedNext),
    spokenForRest: new Set<number>(),
  };
  let finished = false;

  const paint = (): void => {
    paintRest(root, state.restLeft, tickState.schedule, tickState.heldCue);
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
    // One go-on ask for the whole rest, including later extensions.
    state.restLeft = REST_ADD_SECONDS;
    tickState.schedule = restSchedule(state.restLeft, withVoice, timedNext);
    tickState.spokenForRest.clear();
    tickState.heldCue = REST_EXTEND;
    paint();
    speakLine(REST_EXTEND);
  };

  const onTick = (): RestTickOutcome => {
    state.restLeft -= 1;
    const zone = readZone();
    if (state.restLeft <= 0) {
      if (shouldAddRest(zone)) {
        extendRest();
        return "extended";
      }
      finish();
      return "finished";
    }
    if (
      shouldOfferRestedGoOn({
        zone,
        secondsLeft: state.restLeft,
        alreadyAsked: tickState.alreadyAsked,
      })
    ) {
      tickState.alreadyAsked = true;
      tickState.heldCue = REST_GO_ON;
      speakLine(REST_GO_ON);
    }
    paint();
    if (withVoice) {
      speakRestCue(state.restLeft, tickState.schedule, tickState.spokenForRest);
    }
    return "continue";
  };

  paint();

  const timerId = window.setInterval(() => {
    onTick();
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
