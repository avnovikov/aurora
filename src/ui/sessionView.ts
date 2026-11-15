import { clearSession, saveSession } from "../session/storage";
import { sessionClockSnapshot } from "../session/sessionClock";
import { startWakeLock } from "../session/wakeLock";
import { speakCoachLine } from "../voice/coachVoice";
import { disconnectHeartRate } from "../pulse/hrMonitor";
import {
  shouldShoutPulseLost,
  shoutPulseNotReadable,
} from "../voice/pulseAlert";
import { shellHtml } from "./sessionChalk";
import { wireSessionControls, type SessionControlHandlers } from "./sessionControls";
import { startRestTimer, type RestTimerHandle } from "./sessionRest";
import {
  advanceCooldown,
  cooldownSteps,
  enterDone,
  initialState,
  persistPhase,
  startCooldown,
  syncWorkState,
} from "./sessionState";
import { pulseConnectedAt, pulseDisconnected } from "./pulseState";
import type { SessionViewOptions } from "./sessionTypes";
import { startStationHold, type WarmupTimerHandle } from "./sessionWarmup";

export type { SessionViewOptions } from "./sessionTypes";

export function renderSessionView(root: HTMLElement, options: SessionViewOptions): void {
  const state = initialState(options);
  let restHandle: RestTimerHandle | null = null;
  let warmupHandle: WarmupTimerHandle | null = null;
  let pulseTimer: number | null = null;
  let clockTimer: number | null = null;
  const wakeLock = startWakeLock();

  const clearWorkTimers = (): void => {
    restHandle?.clear();
    restHandle = null;
    warmupHandle?.clear();
    warmupHandle = null;
  };

  const dispose = (): void => {
    clearWorkTimers();
    if (pulseTimer !== null) {
      window.clearInterval(pulseTimer);
      pulseTimer = null;
    }
    if (clockTimer !== null) {
      window.clearInterval(clockTimer);
      clockTimer = null;
    }
    void wakeLock.stop();
    void disconnectHeartRate();
  };

  const paintClock = (): void => {
    const node = root.querySelector<HTMLElement>("[data-session-clock]");
    if (!node) {
      return;
    }
    const clock = sessionClockSnapshot(
      state.startedAtMs,
      state.plannedTotalSeconds,
      Date.now(),
    );
    node.textContent = clock.label;
  };

  const paint = (): void => {
    if ((state.phase === "work" || state.phase === "rest") && !state.workState) {
      state.workState = syncWorkState(options.planned, state);
    }
    root.innerHTML = shellHtml(options.planned, state);
    wireControls();
    persist();
  };

  let finished = false;
  const persist = (): void => {
    if (finished) {
      return;
    }
    saveSession({
      readiness: options.planned.readiness,
      planned: options.planned,
      log: state.log,
      phase: persistPhase(options.planned, state),
      warmupIndex: state.warmupIndex,
      workIndex: state.workIndex,
      cooldownIndex: state.cooldownIndex,
      setIndex: state.setIndex,
      nextRepsOverride: state.workState?.nextRepsOverride,
      startedAt: new Date(state.startedAtMs).toISOString(),
      savedAt: new Date().toISOString(),
    });
  };

  /** End the session (after the work, a finished cool-down, or a skip) and hand off. */
  const finishAll = (): void => {
    if (finished) {
      return;
    }
    finished = true;
    dispose();
    state.phase = "done";
    clearSession();
    void speakCoachLine("session_done");
    // Defer so the Log-set / swipe pointer event cannot click through
    // into the evaluation buttons that replace this view.
    window.setTimeout(() => {
      options.onDone(state.log.entries.length);
    }, 0);
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
    const step = options.planned.warmup[state.warmupIndex];
    warmupHandle = startStationHold(root, step, state, "warmup", {
      onPaint: paint,
      onAdvance: advanceWarmup,
      onRestGap: (_gap, resumeWarmup) => {
        startRest(resumeWarmup, true);
      },
    });
  };

  const advanceCooldownStep = (): void => {
    if (advanceCooldown(options.planned, state) === "finish") {
      finishAll();
      return;
    }
    paint();
    runCooldownHold();
  };

  const runCooldownHold = (): void => {
    clearWorkTimers();
    const step = cooldownSteps(options.planned)[state.cooldownIndex];
    warmupHandle = startStationHold(root, step, state, "cooldown", {
      onPaint: paint,
      onAdvance: advanceCooldownStep,
      onRestGap: (_gap, resumeCooldown) => {
        startRest(resumeCooldown, false);
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
      if (enterDone(options.planned, state) === "finish") {
        finishAll();
        return;
      }
      paint();
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
    onStartCooldown: () => {
      startCooldown(options.planned, state);
      paint();
      runCooldownHold();
    },
    onSkipCooldown: () => {
      clearWorkTimers();
      finishAll();
    },
    onPulseLostSim: maybePulseShout,
    onPulseBpm: (bpm) => {
      state.bpm = bpm;
      state.pulse = pulseConnectedAt(state.pulse, Date.now());
      paint();
    },
    onPulseDisconnected: () => {
      state.pulse = pulseDisconnected(state.pulse);
      state.bpm = null;
      state.pulseStatus = "Pulse strap disconnected.";
      paint();
    },
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
  clockTimer = window.setInterval(paintClock, 1000);

  paint();
  if (state.phase === "warmup") {
    runWarmupHold();
  } else if (state.phase === "cooldown") {
    runCooldownHold();
  }
}
