import type { HeartRateZone } from "../pulse/hrZones";
import { speakExactLine } from "../voice/coachVoice";
import { pickLine, type CoachLine } from "../voice/lines";
import { cueSchedule, type RestCueEvent } from "../voice/restCue";
import { REST_ADD_SECONDS, shouldAddRest, shouldOfferRestedGoOn } from "./restPulse";
import type { ViewState } from "./sessionTypes";

function cueAt(
  left: number,
  schedule: readonly RestCueEvent[],
): RestCueEvent | undefined {
  return schedule.find((event) => event.atSecondsLeft === left);
}

function speakRestCue(
  secondsLeft: number,
  schedule: readonly RestCueEvent[],
  spoken: Set<number>,
): void {
  const due = cueAt(secondsLeft, schedule);
  if (!due || spoken.has(secondsLeft)) {
    return;
  }
  spoken.add(secondsLeft);
  void speakExactLine({
    id: due.lineId,
    assetKey: due.assetKey,
    text: due.text,
  });
}

/** Paint rest seconds and interactive held cue (go-on / +30); schedule lines stay voice-only. */
function paintRest(
  root: HTMLElement,
  left: number,
  heldCue: CoachLine | null,
  goOnOffered: boolean,
): void {
  setText(root, "[data-rest-left]", String(Math.max(left, 0)));
  setText(root, "[data-rest-cue]", heldCue?.text ?? "");
  setCueLatch(root, goOnOffered);
}

function setCueLatch(root: HTMLElement, latched: boolean): void {
  const el = root.querySelector("[data-rest-cue]");
  if (!el) {
    return;
  }
  if (latched) {
    el.setAttribute("data-rest-cue-latch", "");
  } else {
    el.removeAttribute("data-rest-cue-latch");
  }
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
  /** Go-on was offered: block a second ask and keep two-line cue height. */
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
    paintRest(root, state.restLeft, tickState.heldCue, tickState.alreadyAsked);
  };

  const clearCueLatch = (): void => {
    setCueLatch(root, false);
  };

  const speakLine = (line: CoachLine): void => {
    if (!withVoice) {
      return;
    }
    void speakExactLine(line);
  };

  const speakDueCue = (secondsLeft: number): void => {
    if (!withVoice) {
      return;
    }
    speakRestCue(secondsLeft, tickState.schedule, tickState.spokenForRest);
  };

  const finish = (): void => {
    if (finished) {
      return;
    }
    finished = true;
    window.clearInterval(timerId);
    state.restLeft = 0;
    clearCueLatch();
    onDoneRest();
  };

  const speakZeroCueThenFinish = (): void => {
    paint();
    speakDueCue(0);
    finish();
  };

  const extendRest = (): void => {
    // One go-on ask for the whole rest, including later extensions.
    state.restLeft = REST_ADD_SECONDS;
    tickState.schedule = restSchedule(state.restLeft, withVoice, timedNext);
    tickState.spokenForRest.clear();
    const extendLine = pickLine("rest_extend");
    tickState.heldCue = extendLine;
    paint();
    speakLine(extendLine);
  };

  const onTick = (): RestTickOutcome => {
    state.restLeft -= 1;
    const zone = readZone();
    if (state.restLeft <= 0) {
      if (shouldAddRest(zone)) {
        extendRest();
        return "extended";
      }
      speakZeroCueThenFinish();
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
      const goOnLine = pickLine("rest_go_on");
      tickState.heldCue = goOnLine;
      speakLine(goOnLine);
    }
    paint();
    speakDueCue(state.restLeft);
    return "continue";
  };

  paint();

  const timerId = window.setInterval(() => {
    onTick();
  }, 1000);

  return {
    clear: () => {
      window.clearInterval(timerId);
      clearCueLatch();
    },
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
