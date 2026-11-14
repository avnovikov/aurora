import {
  appendSet,
  editNextReps,
  prescribedForNextSet,
} from "../session/setLog";
import type { PlannedSession } from "../rules/planSession";
import type { ViewState } from "./sessionTypes";
import { currentWork } from "./sessionState";
import { wireSwipe } from "./sessionSwipe";

export type StopReason = "completed" | "muscular_failure" | "skipped";

export interface SessionControlHandlers {
  onPaint: () => void;
  onStartRest: (withVoice: boolean, onDone: () => void) => void;
  onFinishExercise: () => void;
  onFinishAll: () => void;
  onPulseLostSim: () => void;
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
  root.querySelector("[data-cues]")?.addEventListener("click", () => {
    state.showingCues = !state.showingCues;
    handlers.onPaint();
  });
  root.querySelector("[data-reps-minus]")?.addEventListener("click", () => {
    adjustNextReps(state, -1, handlers);
  });
  root.querySelector("[data-reps-plus]")?.addEventListener("click", () => {
    adjustNextReps(state, 1, handlers);
  });
  wirePulseSimButtons(root, state, handlers);

  const stage = root.querySelector<HTMLElement>("[data-swipe-stage]");
  if (stage) {
    wireSwipe(stage, () => handlers.onFinishExercise());
  }
}

function adjustNextReps(
  state: ViewState,
  delta: number,
  handlers: SessionControlHandlers,
): void {
  if (!state.workState || state.phase !== "rest") {
    return;
  }
  const base = prescribedForNextSet(state.workState);
  const next = delta < 0 ? Math.max(1, base + delta) : base + delta;
  state.workState = editNextReps(state.workState, next);
  handlers.onPaint();
}

function wirePulseSimButtons(
  root: HTMLElement,
  state: ViewState,
  handlers: SessionControlHandlers,
): void {
  root.querySelector("[data-sim-pulse-lost]")?.addEventListener("click", () => {
    state.pulse = {
      connected: true,
      lastValidAtMs: Date.now() - 6000,
      lastShoutAtMs: null,
    };
    handlers.onPulseLostSim();
    handlers.onPaint();
  });
  root.querySelector("[data-sim-pulse-ok]")?.addEventListener("click", () => {
    state.pulse = {
      connected: true,
      lastValidAtMs: Date.now(),
      lastShoutAtMs: state.pulse.lastShoutAtMs,
    };
    state.bpm = 62;
    handlers.onPaint();
  });
}

function completeSet(
  planned: PlannedSession,
  state: ViewState,
  stopReason: StopReason,
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
  if (state.setIndex >= item.dose.sets || stopReason === "skipped") {
    handlers.onFinishExercise();
    return;
  }
  state.setIndex += 1;
  state.workState = {
    ...work,
    setIndex: state.setIndex,
    prescribedReps: item.dose.reps,
    nextRepsOverride: undefined,
  };
  state.phase = "rest";
  state.restLeft = item.restSeconds;
  handlers.onPaint();
  handlers.onStartRest(true, () => {
    state.phase = "work";
    handlers.onPaint();
  });
}