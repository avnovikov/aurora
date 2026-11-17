import { clearSession, saveSession } from "../session/storage";
import { formatClock, sessionClockSnapshot } from "../session/sessionClock";
import { startWakeLock } from "../session/wakeLock";
import { speakCoachLine } from "../voice/coachVoice";
import {
  disconnectHeartRate,
  PULSE_STRAP_DISCONNECTED,
} from "../pulse/hrMonitor";
import {
  shouldShoutPulseLost,
  shoutPulseNotReadable,
} from "../voice/pulseAlert";
import { excludeExercise } from "../plan/exclusions";
import { rewriteWarmupStepsAfterExclude } from "../rules/resolveWarmupStations";
import { shellHtml } from "./sessionChalk";
import { wireSessionControls, type SessionControlHandlers } from "./sessionControls";
import { EXERCISE_GRAPH } from "../data/exerciseGraph";
import { resolveExerciseTiming } from "../domain/timing";
import type { PlannedWorkItem } from "../rules/planSession";
import { startRestTimer, type RestTimerHandle } from "./sessionRest";
import {
  advanceCooldown,
  cooldownSteps,
  currentWork,
  enterDone,
  enterWorkAfterWarmup,
  initialState,
  needsWorkState,
  persistPhase,
  startCooldown,
  syncWorkState,
} from "./sessionState";
import { pulseConnectedAt, pulseDisconnected } from "./pulseState";
import { attachSessionPulse, paintPulseReading } from "./sessionPulse";
import type { SessionViewOptions } from "./sessionTypes";
import { startStationHold, type WarmupTimerHandle } from "./sessionWarmup";
import { prefetchDoodles } from "../doodles/doodleMarkup";

export type { SessionViewOptions } from "./sessionTypes";

function prefetchSessionDoodles(planned: SessionViewOptions["planned"]): void {
  const warmupAndCooldown = [...planned.warmup, ...(planned.cooldown ?? [])];
  prefetchDoodles([
    ...warmupAndCooldown.map((step) => step.doodlePath),
    ...planned.work.map((item) => item.doodlePath),
  ]);
}

export function renderSessionView(root: HTMLElement, options: SessionViewOptions): void {
  prefetchSessionDoodles(options.planned);
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
    const elapsed = root.querySelector("[data-session-clock] [data-session-elapsed]");
    const left = root.querySelector("[data-session-clock] [data-session-left]");
    if (!elapsed || !left) {
      return;
    }
    const clock = sessionClockSnapshot(
      state.startedAtMs,
      state.plannedTotalSeconds,
      Date.now(),
    );
    elapsed.textContent = formatClock(clock.elapsedSeconds);
    left.textContent = formatClock(clock.remainingSeconds);
  };

  const paint = (): void => {
    if (needsWorkState(options.planned, state)) {
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
      const getReady = enterWorkAfterWarmup(options.planned, state);
      void speakCoachLine("warmup_done");
      paint();
      if (getReady > 0) {
        startRest(() => {
          state.phase = "work";
          paint();
        }, true);
      }
      return;
    }
    paint();
    runStationHold("warmup");
  };

  const advanceCooldownStep = (): void => {
    if (advanceCooldown(options.planned, state) === "finish") {
      finishAll();
      return;
    }
    paint();
    runStationHold("cooldown");
  };

  /** Run the current warm-up or cool-down station; only warm-up gaps get the voice cue. */
  const runStationHold = (kind: "warmup" | "cooldown"): void => {
    clearWorkTimers();
    const isWarmup = kind === "warmup";
    const step = isWarmup
      ? options.planned.warmup[state.warmupIndex]
      : cooldownSteps(options.planned)[state.cooldownIndex];
    warmupHandle = startStationHold(root, step, state, kind, {
      onPaint: paint,
      onAdvance: isWarmup ? advanceWarmup : advanceCooldownStep,
      onSideSwitch: () => {
        void speakCoachLine("change_side");
      },
      onRestGap: (_gap, resume) => {
        // Warm-up / cool-down stations are timed holds — no 4–1 countdown.
        startRest(resume, isWarmup, true);
      },
    });
  };

  const startRest = (
    onDoneRest: () => void,
    withVoice: boolean,
    timedNext = false,
  ): void => {
    clearWorkTimers();
    restHandle = startRestTimer(root, state, withVoice, onDoneRest, {
      timedNext,
    });
  };

  /** Forward swipe on a rest: stop the countdown and go straight on. */
  const skipRest = (): void => {
    if (state.phase === "rest") {
      restHandle?.finish();
    }
  };

  const timedWorkItem = (item: PlannedWorkItem | null): boolean => {
    if (!item) {
      return false;
    }
    const exercise = EXERCISE_GRAPH[item.exerciseId];
    if (!exercise) {
      return false;
    }
    return resolveExerciseTiming(exercise).effort === "hold";
  };

  const finishExercise = (restBeforeNext?: number): void => {
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
    if (restBeforeNext !== undefined && restBeforeNext > 0) {
      state.phase = "rest";
      state.restLeft = restBeforeNext;
      paint();
      startRest(
        () => {
          state.phase = "work";
          paint();
        },
        true,
        timedWorkItem(currentWork(options.planned, state)),
      );
      return;
    }
    state.phase = "work";
    paint();
  };

  const handlers: SessionControlHandlers = {
    onPaint: paint,
    onStartRest: (withVoice, onDone) =>
      startRest(onDone, withVoice, timedWorkItem(currentWork(options.planned, state))),
    onFinishExercise: finishExercise,
    onSkipRest: skipRest,
    onFinishStation: () => warmupHandle?.finish(),
    onWarmupNotForMe: (exerciseId) => {
      options.planned.warmup = rewriteWarmupStepsAfterExclude(
        options.planned.warmup,
        state.warmupIndex,
        excludeExercise(exerciseId),
      );
      // Keep the hold running; only persist the rewritten list.
      persist();
    },
    onFinishAll: finishAll,
    onStartCooldown: () => {
      startCooldown(options.planned, state);
      paint();
      runStationHold("cooldown");
    },
    onSkipCooldown: () => {
      clearWorkTimers();
      finishAll();
    },
    onPulseLostSim: maybePulseShout,
    onPulseBpm: (bpm) => {
      state.bpm = bpm;
      state.pulse = pulseConnectedAt(state.pulse, Date.now());
      // In place: a full repaint once a second would cut off a swipe mid-drag.
      paintPulseReading(root, state);
    },
    onPulseDisconnected: () => {
      state.pulse = pulseDisconnected(state.pulse);
      state.bpm = null;
      state.pulseStatus = PULSE_STRAP_DISCONNECTED;
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

  attachSessionPulse(state, handlers);
  paint();
  if (state.phase === "warmup") {
    runStationHold("warmup");
  } else if (state.phase === "cooldown") {
    runStationHold("cooldown");
  }
}
