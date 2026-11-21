import type { StopReason } from "../domain/types";
import {
  appendSet,
  editAddedLoad,
  editNextReps,
  prescribedForNextSet,
  workStateAfterLoggedSet,
  type ActiveWorkState,
} from "../session/setLog";
import {
  loadMemories,
  recordBestReps,
  recordSetDuration,
  saveMemories,
} from "../session/history";
import { loggedSetDurationSeconds, shouldArmSlowSetCue } from "../session/setDuration";
import {
  connectHeartRate,
  disconnectHeartRate,
  PULSE_STRAP_DISCONNECTED,
} from "../pulse/hrMonitor";
import type { PlannedSession } from "../rules/planSession";
import { speakCoachLine } from "../voice/coachVoice";
import { pulseConnectedAt, pulseLostSim } from "./pulseState";
import { applyConnectHeartRateResult } from "./sessionPulse";
import type { ViewState } from "./sessionTypes";
import { currentWork } from "./sessionState";
import { wireSwipe } from "./sessionSwipe";

/** Stop reasons the session UI can log from buttons. */
export type SetStopReason = Extract<
  StopReason,
  "completed" | "muscular_failure" | "skipped"
>;

export interface SessionControlHandlers {
  onPaint: () => void;
  onStartRest: (withVoice: boolean, onDone: () => void) => void;
  /**
   * Leave the current exercise. When `restBeforeNext` is set, rest that many
   * seconds on the next exercise before the first set (same as between sets).
   */
  onFinishExercise: (restBeforeNext?: number) => void;
  /** End the running rest now and go on to what it was waiting for. */
  onSkipRest: () => void;
  /** Forward swipe on a warm-up or cool-down station: end it now. */
  onFinishStation: () => void;
  /** Warm-up "Not for me": exclude the move; finish the current station as planned. */
  onWarmupNotForMe: (exerciseId: string) => void;
  /** Work toolbar: toggle swap picker. */
  onWorkSwap: () => void;
  /** Work toolbar: step the Plan slot one easier and rewrite the live item. */
  onWorkEasier: () => void;
  /** Work toolbar: drop this move for today only and advance. */
  onWorkSkipToday: () => void;
  /** Work toolbar: exclude forever, substitute when possible. */
  onWorkNever: () => void;
  /** Work toolbar: pick a swap candidate. */
  onWorkSwapPick: (exerciseId: string) => void;
  /** Undo the last Never again on this slot. */
  onWorkUndo: () => void;
  /**
   * About to leave this work set: cancel a pending mid-set pace cue for this
   * exercise if the athlete finished before it fired.
   */
  onWorkSetEnding: (exerciseId: string) => void;
  /** A rep set ran past two minutes — nudge mid-way through the next set. */
  onSlowSetArmed: (exerciseId: string) => void;
  onFinishAll: () => void;
  onStartCooldown: () => void;
  onSkipCooldown: () => void;
  onPulseLostSim: () => void;
  onPulseBpm: (bpm: number) => void;
  onPulseDisconnected: () => void;
  /**
   * Mean strap bpm for `[setStartedAtMs, now]` while logging a completed/failed
   * set. Return null when the session buffer has no samples in that window.
   */
  pulseAverageBpmForSet?: (startMs: number, endMs: number) => number | null;
}

export function wireSessionControls(
  root: HTMLElement,
  planned: PlannedSession,
  state: ViewState,
  handlers: SessionControlHandlers,
): void {
  const clicks: Record<string, () => void> = {
    "[data-log-set]": () => completeSet(planned, state, "completed", handlers),
    "[data-fail-set]": () =>
      completeSet(planned, state, "muscular_failure", handlers),
    "[data-skip]": () => completeSet(planned, state, "skipped", handlers),
    "[data-reps-minus]": () => adjustNextReps(state, -1, handlers),
    "[data-reps-plus]": () => adjustNextReps(state, 1, handlers),
    "[data-add-weight]": () => adjustAddedLoad(state, state.addWeightKg, handlers),
    "[data-load-minus]": () => adjustAddedLoadBy(state, -1, handlers),
    "[data-load-plus]": () => adjustAddedLoadBy(state, 1, handlers),
    "[data-cooldown-start]": () => handlers.onStartCooldown(),
    "[data-cooldown-skip]": () => handlers.onSkipCooldown(),
  };
  for (const [selector, onClick] of Object.entries(clicks)) {
    root.querySelector(selector)?.addEventListener("click", onClick);
  }
  root.querySelector<HTMLElement>("[data-warmup-not-for-me]")?.addEventListener("click", (event) => {
    const exerciseId = (event.currentTarget as HTMLElement).dataset.exerciseId;
    if (!exerciseId) {
      return;
    }
    handlers.onWarmupNotForMe(exerciseId);
  });
  wireWorkAdjustControls(root, handlers);
  wirePulseSimButtons(root, state, handlers);
  wirePulseConnectButtons(root, state, handlers);
  wireStageSwipe(root, planned, state, handlers);
}

function isAriaDisabled(el: HTMLElement): boolean {
  return el.getAttribute("aria-disabled") === "true";
}

function wireWorkAdjustControls(root: HTMLElement, handlers: SessionControlHandlers): void {
  const clicks: Record<string, (el: HTMLElement) => void> = {
    "[data-work-swap]": () => handlers.onWorkSwap(),
    "[data-work-easier]": (el) => {
      if (isAriaDisabled(el)) {
        return;
      }
      handlers.onWorkEasier();
    },
    "[data-work-skip-today]": () => handlers.onWorkSkipToday(),
    "[data-work-never]": () => handlers.onWorkNever(),
    "[data-work-undo]": () => handlers.onWorkUndo(),
  };
  for (const [selector, onClick] of Object.entries(clicks)) {
    const el = root.querySelector<HTMLElement>(selector);
    el?.addEventListener("click", () => onClick(el));
  }
  root.querySelectorAll<HTMLElement>("[data-work-swap-pick]").forEach((button) => {
    button.addEventListener("click", () => {
      const exerciseId = button.dataset.workSwapPick;
      if (!exerciseId) {
        return;
      }
      handlers.onWorkSwapPick(exerciseId);
    });
  });
}

function wireStageSwipe(
  root: HTMLElement,
  planned: PlannedSession,
  state: ViewState,
  handlers: SessionControlHandlers,
): void {
  // One step forward per stage: log the set, end the rest, finish the station.
  const forward: Record<string, () => void> = {
    work: () => completeSet(planned, state, "completed", handlers),
    rest: handlers.onSkipRest,
    station: handlers.onFinishStation,
  };
  root.querySelectorAll<HTMLElement>("[data-swipe-stage]").forEach((stage) => {
    const onForward = forward[stage.dataset.swipeStage ?? ""];
    if (onForward) {
      wireSwipe(stage, onForward);
    }
  });
}

function wirePulseConnectButtons(
  root: HTMLElement,
  state: ViewState,
  handlers: SessionControlHandlers,
): void {
  root.querySelector("[data-pulse-connect]")?.addEventListener("click", () => {
    // Stable handler refs: Set-based subscribe must not stack duplicates.
    void connectHeartRate(
      handlers.onPulseBpm,
      handlers.onPulseDisconnected,
    ).then((result) => {
      applyConnectHeartRateResult(state, result, handlers.onPaint);
    });
  });
  root.querySelector("[data-pulse-disconnect]")?.addEventListener("click", () => {
    void disconnectHeartRate().then(() => {
      handlers.onPulseDisconnected();
      state.pulseStatus = PULSE_STRAP_DISCONNECTED;
      handlers.onPaint();
    });
  });
}

function updateWorkState(
  state: ViewState,
  phases: ViewState["phase"][],
  mapWork: (work: ActiveWorkState) => ActiveWorkState,
  handlers: SessionControlHandlers,
): void {
  if (!state.workState || !phases.includes(state.phase)) {
    return;
  }
  state.workState = mapWork(state.workState);
  handlers.onPaint();
}

function adjustNextReps(
  state: ViewState,
  delta: number,
  handlers: SessionControlHandlers,
): void {
  updateWorkState(state, ["rest", "work"], (work) => {
    const next = Math.max(1, prescribedForNextSet(work) + delta);
    return editNextReps(work, next);
  }, handlers);
}

function adjustAddedLoad(
  state: ViewState,
  kg: number,
  handlers: SessionControlHandlers,
): void {
  updateWorkState(state, ["work"], (work) => editAddedLoad(work, kg), handlers);
}

function adjustAddedLoadBy(
  state: ViewState,
  delta: number,
  handlers: SessionControlHandlers,
): void {
  updateWorkState(
    state,
    ["work"],
    (work) => editAddedLoad(work, Math.max(0, work.addedLoadKg + delta)),
    handlers,
  );
}

function wirePulseSimButtons(
  root: HTMLElement,
  state: ViewState,
  handlers: SessionControlHandlers,
): void {
  root.querySelector("[data-sim-pulse-lost]")?.addEventListener("click", () => {
    state.pulse = pulseLostSim(Date.now());
    handlers.onPulseLostSim();
    handlers.onPaint();
  });
  root.querySelector("[data-sim-pulse-ok]")?.addEventListener("click", () => {
    state.pulse = pulseConnectedAt(state.pulse, Date.now());
    state.bpm = 62;
    handlers.onPaint();
  });
}

export interface CompleteSetOptions {
  /** Work-hold auto timer already spoke hold_done — do not also say set_logged. */
  skipSetLoggedVoice?: boolean;
}

/** Exported for unit tests; session wiring calls this from Log set / Failed / Skip and the forward swipe. */
export function completeSet(
  planned: PlannedSession,
  state: ViewState,
  stopReason: SetStopReason,
  handlers: SessionControlHandlers,
  options: CompleteSetOptions = {},
): void {
  const item = currentWork(planned, state);
  const work = state.workState;
  if (!item || !work) {
    return;
  }
  const prescribed = prescribedForNextSet(work);
  const completed = completedRepsForStop(stopReason, prescribed);
  handlers.onWorkSetEnding(item.exerciseId);
  const durationSeconds = loggedSetDurationSeconds(work.setStartedAtMs, stopReason);
  const averageBpm = averageBpmForLoggedSet(
    stopReason,
    work.setStartedAtMs,
    handlers.pulseAverageBpmForSet,
  );
  state.log = appendSet(
    state.log,
    loggedSetFields({
      slotId: item.slotId,
      exerciseId: item.exerciseId,
      setIndex: state.setIndex,
      prescribedReps: prescribed,
      completedReps: completed,
      addedLoadKg: work.addedLoadKg,
      stopReason,
      durationSeconds,
      averageBpm,
    }),
  );
  persistSetMemory(item.exerciseId, completed, durationSeconds, handlers);
  announceSetLoggedIfCompleted(stopReason, options.skipSetLoggedVoice === true);
  if (isLastSetOrSkipped(state.setIndex, item.dose.sets, stopReason)) {
    handlers.onFinishExercise(
      restBeforeNextExercise(stopReason, state.workIndex, planned.work.length, item.restSeconds),
    );
    return;
  }
  state.setIndex += 1;
  state.workState = workStateAfterLoggedSet(work, state.setIndex, prescribed);
  beginRest(state, handlers, item.restSeconds);
}

function completedRepsForStop(stopReason: SetStopReason, prescribed: number): number {
  if (stopReason === "skipped") {
    return 0;
  }
  return prescribed;
}

function averageBpmForLoggedSet(
  stopReason: SetStopReason,
  setStartedAtMs: number | undefined,
  pulseAverageBpmForSet: SessionControlHandlers["pulseAverageBpmForSet"],
): number | null {
  if (stopReason === "skipped" || setStartedAtMs === undefined) {
    return null;
  }
  return pulseAverageBpmForSet?.(setStartedAtMs, Date.now()) ?? null;
}

function loggedSetFields(input: {
  slotId: string;
  exerciseId: string;
  setIndex: number;
  prescribedReps: number;
  completedReps: number;
  addedLoadKg: number;
  stopReason: SetStopReason;
  durationSeconds: number | undefined;
  averageBpm: number | null;
}): Parameters<typeof appendSet>[1] {
  return {
    slotId: input.slotId,
    exerciseId: input.exerciseId,
    setIndex: input.setIndex,
    prescribedReps: input.prescribedReps,
    completedReps: input.completedReps,
    addedLoadKg: input.addedLoadKg,
    stopReason: input.stopReason,
    ...(input.durationSeconds !== undefined
      ? { durationSeconds: input.durationSeconds }
      : {}),
    ...(input.averageBpm !== null ? { averageBpm: input.averageBpm } : {}),
  };
}

function announceSetLoggedIfCompleted(
  stopReason: SetStopReason,
  skipSetLoggedVoice: boolean,
): void {
  if (stopReason === "completed" && !skipSetLoggedVoice) {
    void speakCoachLine("set_logged");
  }
}

function isLastSetOrSkipped(
  setIndex: number,
  totalSets: number,
  stopReason: SetStopReason,
): boolean {
  return setIndex >= totalSets || stopReason === "skipped";
}

/** Rest after the last set of an exercise only when another exercise follows and the set was not skipped. */
export function restBeforeNextExercise(
  stopReason: SetStopReason,
  workIndex: number,
  workCount: number,
  slotRestSeconds: number,
): number | undefined {
  if (stopReason === "skipped" || workIndex >= workCount - 1) {
    return undefined;
  }
  if (slotRestSeconds <= 0) {
    return undefined;
  }
  return slotRestSeconds;
}

function persistSetMemory(
  exerciseId: string,
  completedReps: number,
  durationSeconds: number | undefined,
  handlers: Pick<SessionControlHandlers, "onSlowSetArmed">,
): void {
  if (completedReps <= 0 && durationSeconds === undefined) {
    return;
  }
  let memories = loadMemories();
  if (completedReps > 0) {
    memories = recordBestReps(memories, exerciseId, completedReps);
  }
  if (durationSeconds !== undefined) {
    memories = recordSetDuration(memories, exerciseId, durationSeconds);
    if (shouldArmSlowSetCue(durationSeconds)) {
      handlers.onSlowSetArmed(exerciseId);
    }
  }
  saveMemories(memories);
}

function beginRest(
  state: ViewState,
  handlers: SessionControlHandlers,
  restSeconds: number,
): void {
  state.phase = "rest";
  state.restLeft = restSeconds;
  handlers.onPaint();
  handlers.onStartRest(true, () => {
    state.phase = "work";
    handlers.onPaint();
  });
}
