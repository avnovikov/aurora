import type { StopReason } from "../domain/types";
import {
  appendSet,
  DEFAULT_ADDED_LOAD_KG,
  editAddedLoad,
  editNextReps,
  prescribedForNextSet,
  workStateAfterLoggedSet,
  type ActiveWorkState,
} from "../session/setLog";
import {
  loadMemories,
  recordBestReps,
  saveMemories,
} from "../session/history";
import {
  connectHeartRate,
  disconnectHeartRate,
} from "../pulse/hrMonitor";
import type { PlannedSession } from "../rules/planSession";
import { pulseConnectedAt, pulseLostSim } from "./pulseState";
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
  onFinishExercise: () => void;
  onFinishAll: () => void;
  onStartCooldown: () => void;
  onSkipCooldown: () => void;
  onPulseLostSim: () => void;
  onPulseBpm: (bpm: number) => void;
  onPulseDisconnected: () => void;
}

export function wireSessionControls(
  root: HTMLElement,
  planned: PlannedSession,
  state: ViewState,
  handlers: SessionControlHandlers,
): void {
  root.querySelector("[data-log-set]")?.addEventListener("click", () => {
    completeSet(planned, state, "completed", handlers);
  });
  root.querySelector("[data-fail-set]")?.addEventListener("click", () => {
    completeSet(planned, state, "muscular_failure", handlers);
  });
  root.querySelector("[data-skip]")?.addEventListener("click", () => {
    completeSet(planned, state, "skipped", handlers);
  });
  root.querySelector("[data-reps-minus]")?.addEventListener("click", () => {
    adjustNextReps(state, -1, handlers);
  });
  root.querySelector("[data-reps-plus]")?.addEventListener("click", () => {
    adjustNextReps(state, 1, handlers);
  });
  root.querySelector("[data-add-weight]")?.addEventListener("click", () => {
    adjustAddedLoad(state, DEFAULT_ADDED_LOAD_KG, handlers);
  });
  root.querySelector("[data-load-minus]")?.addEventListener("click", () => {
    adjustAddedLoadDelta(state, -1, handlers);
  });
  root.querySelector("[data-load-plus]")?.addEventListener("click", () => {
    adjustAddedLoadDelta(state, 1, handlers);
  });
  root.querySelector("[data-cooldown-start]")?.addEventListener("click", () => {
    handlers.onStartCooldown();
  });
  root.querySelector("[data-cooldown-skip]")?.addEventListener("click", () => {
    handlers.onSkipCooldown();
  });
  wirePulseSimButtons(root, state, handlers);
  wirePulseConnectButtons(root, state, handlers);

  const stage = root.querySelector<HTMLElement>("[data-swipe-stage]");
  if (stage) {
    wireSwipe(stage, () => handlers.onFinishExercise());
  }
}

function wirePulseConnectButtons(
  root: HTMLElement,
  state: ViewState,
  handlers: SessionControlHandlers,
): void {
  root.querySelector("[data-pulse-connect]")?.addEventListener("click", () => {
    void connectHeartRate(
      (bpm) => handlers.onPulseBpm(bpm),
      () => handlers.onPulseDisconnected(),
    ).then((result) => {
      state.pulseStatus = result.message;
      if (result.ok) {
        state.pulse = pulseConnectedAt(state.pulse, Date.now());
      }
      handlers.onPaint();
    });
  });
  root.querySelector("[data-pulse-disconnect]")?.addEventListener("click", () => {
    void disconnectHeartRate().then(() => {
      handlers.onPulseDisconnected();
      state.pulseStatus = "Pulse strap disconnected.";
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

function adjustAddedLoadDelta(
  state: ViewState,
  delta: number,
  handlers: SessionControlHandlers,
): void {
  updateWorkState(state, ["work"], (work) => {
    const next = Math.max(0, work.addedLoadKg + delta);
    return editAddedLoad(work, next);
  }, handlers);
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

/** Exported for unit tests; session wiring calls this from Log set / Failed / Skip. */
export function completeSet(
  planned: PlannedSession,
  state: ViewState,
  stopReason: SetStopReason,
  handlers: SessionControlHandlers,
): void {
  const item = currentWork(planned, state);
  const work = state.workState;
  if (!item || !work) {
    return;
  }
  const prescribed = prescribedForNextSet(work);
  const completed = stopReason === "skipped" ? 0 : prescribed;
  state.log = appendSet(state.log, {
    slotId: item.slotId,
    exerciseId: item.exerciseId,
    setIndex: state.setIndex,
    prescribedReps: prescribed,
    completedReps: completed,
    addedLoadKg: work.addedLoadKg,
    stopReason,
  });
  if (completed > 0) {
    saveMemories(recordBestReps(loadMemories(), item.exerciseId, completed));
  }
  if (state.setIndex >= item.dose.sets || stopReason === "skipped") {
    handlers.onFinishExercise();
    return;
  }
  state.setIndex += 1;
  state.workState = workStateAfterLoggedSet(work, state.setIndex, prescribed);
  state.phase = "rest";
  state.restLeft = item.restSeconds;
  handlers.onPaint();
  handlers.onStartRest(true, () => {
    state.phase = "work";
    handlers.onPaint();
  });
}
