import { clearSession, saveSession } from "../session/storage";
import { formatClock, sessionClockSnapshot } from "../session/sessionClock";
import { startWakeLock } from "../session/wakeLock";
import { theoreticalRemainingSeconds } from "./sessionClockProgress";
import { setKettlebellCoachContext } from "../voice/coachContext";
import { speakCoachLine } from "../voice/coachVoice";
import { isKettlebellExercise } from "../voice/kettlebellExercise";
import {
  disconnectHeartRate,
  PULSE_STRAP_DISCONNECTED,
} from "../pulse/hrMonitor";
import {
  shouldShoutPulseLost,
  shoutPulseNotReadable,
} from "../voice/pulseAlert";
import { excludeExercise } from "../plan/exclusions";
import { swapChoices, undoExclude, type ExcludeUndo } from "../plan/dayEdits";
import { rewriteWarmupStepsAfterExclude } from "../rules/resolveWarmupStations";
import { shellHtml, type WorkAdjustUi } from "./sessionChalk";
import {
  completeSet,
  wireSessionControls,
  type SessionControlHandlers,
} from "./sessionControls";
import { EXERCISE_GRAPH } from "../data/exerciseGraph";
import { resolveExerciseTiming } from "../domain/timing";
import type { PlannedSession, PlannedWorkItem } from "../rules/planSession";
import { prescribedForNextSet } from "../session/setLog";
import { displayExerciseName } from "../library/displayName";
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
  ensureSetClockStarted,
  startCooldown,
  syncWorkState,
} from "./sessionState";
import { startWorkHold, type WorkHoldTimerHandle } from "./sessionWorkHold";
import { loadMemories } from "../session/history";
import { pulseConnectedAt, pulseDisconnected } from "./pulseState";
import { attachSessionPulse, paintPulseReading, sessionHeartRateZone } from "./sessionPulse";
import type { SessionViewOptions, ViewState } from "./sessionTypes";
import { seedStationHold, startStationHold, type WarmupTimerHandle } from "./sessionWarmup";
import { prefetchDoodles } from "../doodles/doodleMarkup";
import { loadAthleteState } from "./athleteState";
import { createSlowSetCueController } from "./slowSetCue";
import {
  applyEasierWork,
  applyNeverAgainWork,
  applySkipToday,
  applySwapWork,
  dayExerciseIds,
  easierAvailable,
  type WorkAdjustInput,
  type WorkAdjustResult,
} from "./sessionWorkAdjust";
import type { BpmSample } from "../pulse/warmupWoundUp";
import {
  averageBpmInWindow,
  buildHistoryPulse,
  createPulseSessionBuffer,
  recordPulseSample,
  type PulseSessionBuffer,
} from "../pulse/pulseSessionBuffer";
import {
  warmupLightenConfirmHtml,
  wireWarmupLightenConfirm,
} from "./warmupLightenConfirm";
import {
  pendingLightenAfterWarmup,
  resolveWarmupLightenChoice,
  type PendingWarmupLighten,
} from "./sessionWarmupLighten";

export type { SessionViewOptions } from "./sessionTypes";

function appendLivePulseSample(
  pulseBuffer: PulseSessionBuffer,
  planned: PlannedSession,
  state: ViewState,
  bpm: number,
  atMs: number,
): void {
  const workItem = state.phase === "work" ? currentWork(planned, state) : null;
  recordPulseSample(pulseBuffer, {
    t: atMs,
    bpm,
    phase: state.phase,
    exerciseId: workItem?.exerciseId ?? null,
  });
}

function prefetchSessionDoodles(planned: SessionViewOptions["planned"]): void {
  const warmupAndCooldown = [...planned.warmup, ...(planned.cooldown ?? [])];
  prefetchDoodles([
    ...warmupAndCooldown.map((step) => step.doodlePath),
    ...planned.work.map((item) => item.doodlePath),
  ]);
}

interface WorkAdjustChrome {
  swapOpen: boolean;
  status?: string;
  undo?: ExcludeUndo | null;
  previousItem?: PlannedWorkItem;
  undoWorkIndex?: number;
}

function exerciseForWorkItem(item: PlannedWorkItem | null) {
  if (!item) {
    return undefined;
  }
  return EXERCISE_GRAPH[item.exerciseId];
}

function syncKettlebellCoachContext(item: PlannedWorkItem | null): void {
  const exercise = exerciseForWorkItem(item);
  setKettlebellCoachContext(
    exercise !== undefined && isKettlebellExercise(exercise),
  );
}

function isHoldWorkItem(item: PlannedWorkItem | null): boolean {
  const exercise = exerciseForWorkItem(item);
  return exercise !== undefined && resolveExerciseTiming(exercise).effort === "hold";
}

function isRepWorkItem(item: PlannedWorkItem | null): boolean {
  const exercise = exerciseForWorkItem(item);
  return exercise !== undefined && resolveExerciseTiming(exercise).effort !== "hold";
}

export function renderSessionView(root: HTMLElement, options: SessionViewOptions): void {
  prefetchSessionDoodles(options.planned);
  const state = initialState(options);
  let restHandle: RestTimerHandle | null = null;
  let warmupHandle: WarmupTimerHandle | null = null;
  let workHoldHandle: WorkHoldTimerHandle | null = null;
  let pulseTimer: number | null = null;
  let clockTimer: number | null = null;
  let workAdjust: WorkAdjustChrome = { swapOpen: false };
  const warmupBpmSamples: BpmSample[] = [];
  const pulseBuffer = createPulseSessionBuffer();
  let pendingLighten: PendingWarmupLighten | null = null;
  const wakeLock = startWakeLock();
  const slowSetCue = createSlowSetCueController({
    speakPaceNudge: () => {
      void speakCoachLine("set_pace_nudge");
    },
    memoryFor: (exerciseId) => loadMemories()[exerciseId],
  });

  const clearWorkHoldTimer = (): void => {
    workHoldHandle?.clear();
    workHoldHandle = null;
  };

  const clearWorkTimers = (): void => {
    restHandle?.clear();
    restHandle = null;
    warmupHandle?.clear();
    warmupHandle = null;
    clearWorkHoldTimer();
    slowSetCue.clear();
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
      Date.now(),
      theoreticalRemainingSeconds(options.planned, state),
    );
    elapsed.textContent = formatClock(clock.elapsedSeconds);
    left.textContent = formatClock(clock.remainingSeconds);
  };

  const clearWorkAdjustNotice = (): void => {
    workAdjust = { swapOpen: false };
  };

  const currentAdjustInput = (): WorkAdjustInput => ({
    planned: options.planned,
    workIndex: state.workIndex,
    athlete: loadAthleteState(),
  });

  const swapPickLabels = (input: WorkAdjustInput, exerciseId: string) =>
    swapChoices(exerciseId, input.athlete, dayExerciseIds(input.planned, input.workIndex)).map(
      (exercise) => ({
        id: exercise.id,
        name: displayExerciseName(exercise.name),
      }),
    );

  const pendingUndoUi = (): WorkAdjustUi | null =>
    workAdjust.undo
      ? {
          easierAvailable: false,
          swapOpen: false,
          swapOptions: [],
          status: workAdjust.status,
          showUndo: true,
        }
      : null;

  const workAdjustUi = (): WorkAdjustUi | null => {
    if (state.phase !== "work") {
      return pendingUndoUi();
    }
    const item = currentWork(options.planned, state);
    if (!item) {
      return pendingUndoUi();
    }
    const input = currentAdjustInput();
    return {
      easierAvailable: easierAvailable(input),
      swapOpen: workAdjust.swapOpen,
      swapOptions: workAdjust.swapOpen ? swapPickLabels(input, item.exerciseId) : [],
      status: workAdjust.status,
      showUndo: Boolean(workAdjust.undo),
    };
  };

  const resetCurrentSetProgress = (): void => {
    clearWorkHoldTimer();
    state.setIndex = 1;
    state.workState = syncWorkState(options.planned, state);
  };

  const adoptAdjustResult = (result: WorkAdjustResult): void => {
    options.planned.work = result.planned.work;
    workAdjust = {
      swapOpen: false,
      status: result.status,
      undo: result.undo,
      previousItem: result.previousItem,
      undoWorkIndex: result.undo ? state.workIndex : undefined,
    };
    if (result.finishExercise) {
      clearWorkHoldTimer();
      finishExercise();
      return;
    }
    resetCurrentSetProgress();
    paint();
  };

  const runWorkAdjust = (edit: () => WorkAdjustResult): void => {
    try {
      adoptAdjustResult(edit());
    } catch (error) {
      workAdjust = {
        swapOpen: false,
        status: error instanceof Error ? error.message : "Could not adjust this move",
      };
      paint();
    }
  };

  const restoreLiveItemAfterUndo = (): void => {
    if (
      !workAdjust.previousItem ||
      workAdjust.undoWorkIndex !== state.workIndex ||
      state.phase !== "work"
    ) {
      return;
    }
    options.planned.work[state.workIndex] = workAdjust.previousItem;
    resetCurrentSetProgress();
  };

  const beginWorkAfterWarmup = (): void => {
    const getReady = enterWorkAfterWarmup(options.planned, state);
    void speakCoachLine("warmup_done");
    paint();
    if (getReady > 0) {
      // Transition rest is not "after a KB set" — clear until real work starts.
      setKettlebellCoachContext(false);
      startRest(() => {
        state.phase = "work";
        syncKettlebellCoachContext(currentWork(options.planned, state));
        paint();
      }, true);
      return;
    }
    syncKettlebellCoachContext(currentWork(options.planned, state));
  };

  const resolveLightenConfirm = (acceptedLight: boolean): void => {
    if (!pendingLighten) {
      beginWorkAfterWarmup();
      return;
    }
    options.planned = resolveWarmupLightenChoice({
      planned: options.planned,
      pending: pendingLighten,
      acceptedLight,
      sessionStartedAtMs: state.startedAtMs,
    });
    pendingLighten = null;
    beginWorkAfterWarmup();
  };

  const paintLightenConfirm = (): void => {
    const pending = pendingLighten;
    if (!pending) {
      return;
    }
    root.innerHTML = warmupLightenConfirmHtml(pending.preferLight);
    wireWarmupLightenConfirm(root, {
      onLight: () => resolveLightenConfirm(true),
      onKeep: () => resolveLightenConfirm(false),
    });
    persist();
  };

  /** Seed holdLeft before HTML so the first paint shows the full clock. */
  const prepareHoldWorkForPaint = (workItem: PlannedWorkItem | null): boolean => {
    if (state.phase !== "work" || !isHoldWorkItem(workItem) || !state.workState) {
      return false;
    }
    state.workState = ensureSetClockStarted(state.workState);
    if (!workHoldHandle) {
      state.holdLeft = prescribedForNextSet(state.workState);
    }
    return true;
  };

  const paint = (): void => {
    if (pendingLighten) {
      paintLightenConfirm();
      return;
    }
    if (needsWorkState(options.planned, state)) {
      state.workState = syncWorkState(options.planned, state);
    }
    const workItem = currentWork(options.planned, state);
    const repWork = isRepWorkItem(workItem);
    if (state.phase === "work" && state.workState && repWork) {
      state.workState = ensureSetClockStarted(state.workState);
    }
    const holdWork = prepareHoldWorkForPaint(workItem);
    root.innerHTML = shellHtml(options.planned, state, workAdjustUi());
    wireControls();
    if (holdWork) {
      ensureWorkHoldTimer();
    }
    slowSetCue.scheduleIfNeeded({
      phase: state.phase,
      setIndex: state.setIndex,
      item: workItem,
      isRepWork: repWork,
    });
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
      addedLoadKg: state.workState?.addedLoadKg,
      loadSwapFromId: state.workState?.loadSwapFromId,
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
      options.onDone(
        state.log,
        options.planned,
        state.startedAtMs,
        buildHistoryPulse(pulseBuffer),
      );
    }, 0);
  };

  const advanceWarmup = (): void => {
    state.warmupIndex += 1;
    if (state.warmupIndex >= options.planned.warmup.length) {
      pendingLighten = pendingLightenAfterWarmup({
        planned: options.planned,
        samples: warmupBpmSamples,
        endAtMs: Date.now(),
      });
      if (pendingLighten) {
        paint();
        return;
      }
      beginWorkAfterWarmup();
      return;
    }
    seedAndRunStationHold("warmup");
  };

  const advanceCooldownStep = (): void => {
    if (advanceCooldown(options.planned, state) === "finish") {
      finishAll();
      return;
    }
    seedAndRunStationHold("cooldown");
  };

  /** Seed holdLeft before paint so Left uses the full station, then start the timer. */
  const seedAndRunStationHold = (kind: "warmup" | "cooldown"): void => {
    const step =
      kind === "warmup"
        ? options.planned.warmup[state.warmupIndex]
        : cooldownSteps(options.planned)[state.cooldownIndex];
    seedStationHold(state, step);
    paint();
    runStationHold(kind);
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
        // Omit timedNext so gaps keep 5→1; cool-down silence is withVoice.
        startRest(resume, isWarmup);
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
      readZone: () => sessionHeartRateZone(state),
    });
  };

  /** Forward swipe on a rest: stop the countdown and go straight on. */
  const skipRest = (): void => {
    if (state.phase === "rest") {
      restHandle?.finish();
    }
  };

  const finishExercise = (restBeforeNext?: number): void => {
    const finishedExercise = exerciseForWorkItem(currentWork(options.planned, state));
    const restKeepsComrade =
      finishedExercise !== undefined && isKettlebellExercise(finishedExercise);
    // Keep Never-again Undo across advance (plan/exclusion restore); drop live-item snapshot.
    if (workAdjust.undo) {
      workAdjust = {
        swapOpen: false,
        status: workAdjust.status,
        undo: workAdjust.undo,
      };
    } else {
      clearWorkAdjustNotice();
    }
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
      setKettlebellCoachContext(restKeepsComrade);
      paint();
      startRest(
        () => {
          state.phase = "work";
          syncKettlebellCoachContext(currentWork(options.planned, state));
          paint();
        },
        true,
        isHoldWorkItem(currentWork(options.planned, state)),
      );
      return;
    }
    state.phase = "work";
    syncKettlebellCoachContext(currentWork(options.planned, state));
    paint();
  };

  const handlers: SessionControlHandlers = {
    onPaint: paint,
    onStartRest: (withVoice, onDone) => {
      syncKettlebellCoachContext(currentWork(options.planned, state));
      startRest(onDone, withVoice, isHoldWorkItem(currentWork(options.planned, state)));
    },
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
    onWorkSwap: () => {
      workAdjust = { ...workAdjust, swapOpen: !workAdjust.swapOpen };
      paint();
    },
    onWorkEasier: () => runWorkAdjust(() => applyEasierWork(currentAdjustInput())),
    onWorkSkipToday: () => {
      adoptAdjustResult({ planned: options.planned, ...applySkipToday() });
    },
    onWorkNever: () => runWorkAdjust(() => applyNeverAgainWork(currentAdjustInput())),
    onWorkSwapPick: (exerciseId) =>
      runWorkAdjust(() => applySwapWork(currentAdjustInput(), exerciseId)),
    onWorkUndo: () => {
      if (!workAdjust.undo) {
        return;
      }
      const restored = undoExclude(workAdjust.undo);
      restoreLiveItemAfterUndo();
      workAdjust = { swapOpen: false, status: `Restored ${restored.restoredName}` };
      paint();
    },
    onWorkSetEnding: (exerciseId) => {
      slowSetCue.cancelFor(exerciseId);
    },
    onSlowSetArmed: (exerciseId) => {
      slowSetCue.arm(exerciseId);
    },
    onFinishAll: finishAll,
    onStartCooldown: () => {
      startCooldown(options.planned, state);
      seedAndRunStationHold("cooldown");
    },
    onSkipCooldown: () => {
      clearWorkTimers();
      finishAll();
    },
    onPulseLostSim: tickPulseWatch,
    onPulseBpm: (bpm) => {
      const atMs = Date.now();
      state.bpm = bpm;
      state.pulse = pulseConnectedAt(state.pulse, atMs);
      appendLivePulseSample(pulseBuffer, options.planned, state, bpm, atMs);
      if (state.phase === "warmup" && !pendingLighten) {
        warmupBpmSamples.push({ bpm, atMs });
      }
      // In place: a full repaint once a second would cut off a swipe mid-drag.
      paintPulseReading(root, state);
    },
    onPulseDisconnected: () => {
      state.pulse = pulseDisconnected(state.pulse);
      state.bpm = null;
      state.pulseStatus = PULSE_STRAP_DISCONNECTED;
      paint();
    },
    pulseAverageBpmForSet: (startMs, endMs) => averageBpmInWindow(pulseBuffer, startMs, endMs),
  };

  const wireControls = (): void => {
    wireSessionControls(root, options.planned, state, handlers);
  };

  /** Start the work-hold countdown once per set; paint may rebuild DOM while it runs. */
  const ensureWorkHoldTimer = (): void => {
    if (workHoldHandle || !state.workState) {
      return;
    }
    const item = currentWork(options.planned, state);
    if (state.phase !== "work" || !isHoldWorkItem(item)) {
      return;
    }
    const holdSeconds = prescribedForNextSet(state.workState);
    workHoldHandle = startWorkHold(root, state, holdSeconds, {
      onComplete: () => {
        clearWorkHoldTimer();
        completeSet(options.planned, state, "completed", handlers, {
          skipSetLoggedVoice: true,
        });
      },
    });
  };

  /** Coral from silence age, then shout once past the longer voice threshold. */
  function tickPulseWatch(): void {
    const now = Date.now();
    paintPulseReading(root, state, now);
    if (shouldShoutPulseLost(state.pulse, now)) {
      shoutPulseNotReadable();
      state.pulse = { ...state.pulse, lastShoutAtMs: now };
    }
  }

  pulseTimer = window.setInterval(tickPulseWatch, 2000);
  clockTimer = window.setInterval(paintClock, 1000);

  attachSessionPulse(state, handlers);
  if (state.phase === "warmup") {
    seedAndRunStationHold("warmup");
  } else if (state.phase === "cooldown") {
    seedAndRunStationHold("cooldown");
  } else {
    paint();
  }
}
