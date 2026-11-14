import { clearSession, saveSession } from "../session/storage";
import { speakCoachLine } from "../voice/coachVoice";
import {
  shouldShoutPulseLost,
  shoutPulseNotReadable,
} from "../voice/pulseAlert";
import { doneShellHtml, shellHtml } from "./sessionChalk";
import { wireSessionControls, type SessionControlHandlers } from "./sessionControls";
import { startRestTimer, type RestTimerHandle } from "./sessionRest";
import { initialState, persistPhase, syncWorkState } from "./sessionState";
import type { SessionViewOptions } from "./sessionTypes";
import { startWarmupHold, type WarmupTimerHandle } from "./sessionWarmup";

export type { SessionViewOptions } from "./sessionTypes";

export function renderSessionView(root: HTMLElement, options: SessionViewOptions): void {
  const state = initialState(options);
  let restHandle: RestTimerHandle | null = null;
  let warmupHandle: WarmupTimerHandle | null = null;
  let pulseTimer: number | null = null;

  const clearWorkTimers = (): void => {
    restHandle?.clear();
    restHandle = null;
    warmupHandle?.clear();
    warmupHandle = null;
  };

  const paint = (): void => {
    root.innerHTML = shellHtml(options.planned, state);
    wireControls();
    persist();
  };

  const persist = (): void => {
    if (state.phase === "done") {
      return;
    }
    saveSession({
      readiness: options.planned.readiness,
      planned: options.planned,
      log: state.log,
      phase: persistPhase(state),
      warmupIndex: state.warmupIndex,
      workIndex: state.workIndex,
      setIndex: state.setIndex,
      nextRepsOverride: state.workState?.nextRepsOverride,
      savedAt: new Date().toISOString(),
    });
  };

  const finishAll = (): void => {
    clearWorkTimers();
    if (pulseTimer !== null) {
      window.clearInterval(pulseTimer);
    }
    state.phase = "done";
    clearSession();
    void speakCoachLine("session_done");
    root.innerHTML = doneShellHtml(state.log.entries.length);
    root.querySelector("[data-home]")?.addEventListener("click", options.onDone);
  };

  const advanceWarmup = (): void => {
    state.warmupIndex += 1;
    if (state.warmupIndex >= options.planned.warmup.length) {
      state.phase = "work";
      state.workIndex = 0;
      state.setIndex = 1;
      state.workState = syncWorkState(options.planned, state);
      void speakCoachLine("warmup_done");
      paint();
      return;
    }
    paint();
    runWarmupHold();
  };

  const runWarmupHold = (): void => {
    clearWorkTimers();
    warmupHandle = startWarmupHold(root, options.planned, state, {
      onPaint: paint,
      onAdvance: advanceWarmup,
      onRestGap: (_gap, resumeWarmup) => {
        startRest(resumeWarmup, false);
      },
    });
  };

  const startRest = (onDoneRest: () => void, withVoice: boolean): void => {
    clearWorkTimers();
    restHandle = startRestTimer(root, state, withVoice, onDoneRest);
  };

  const finishExercise = (): void => {
    state.workIndex += 1;
    state.setIndex = 1;
    state.workState = null;
    if (state.workIndex >= options.planned.work.length) {
      finishAll();
      return;
    }
    state.workState = syncWorkState(options.planned, state);
    state.phase = "work";
    paint();
  };

  const handlers: SessionControlHandlers = {
    onPaint: paint,
    onStartRest: (withVoice, onDone) => startRest(onDone, withVoice),
    onFinishExercise: finishExercise,
    onFinishAll: finishAll,
    onPulseLostSim: maybePulseShout,
  };

  const wireControls = (): void => {
    wireSessionControls(root, options.planned, state, handlers);
  };

  function maybePulseShout(): void {
    const now = Date.now();
    if (shouldShoutPulseLost(state.pulse, now)) {
      shoutPulseNotReadable();
      state.pulse = { ...state.pulse, lastShoutAtMs: now };
    }
  }

  pulseTimer = window.setInterval(maybePulseShout, 2000);

  paint();
  if (state.phase === "warmup") {
    runWarmupHold();
  }
}