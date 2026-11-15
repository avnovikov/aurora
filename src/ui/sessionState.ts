import type { PlannedSession, PlannedWorkItem } from "../rules/planSession";
import { createEmptyLog, type ActiveWorkState } from "../session/setLog";
import type { SessionViewOptions, ViewState } from "./sessionTypes";

export function initialState(options: SessionViewOptions): ViewState {
  const resume = options.resume;
  if (resume) {
    const state: ViewState = {
      phase: resume.phase === "done" ? "done" : resume.phase,
      warmupIndex: resume.warmupIndex,
      workIndex: resume.workIndex,
      setIndex: resume.setIndex,
      log: resume.log,
      workState: null,
      restLeft: 0,
      showingCues: false,
      pulse: { connected: false, lastValidAtMs: null, lastShoutAtMs: null },
      bpm: null,
      pulseStatus: null,
    };
    if (state.phase === "work" || state.phase === "rest") {
      state.workState = restoreWorkState(
        options.planned,
        state,
        resume.nextRepsOverride,
      );
    }
    return state;
  }
  return {
    phase: "warmup",
    warmupIndex: 0,
    workIndex: 0,
    setIndex: 1,
    log: createEmptyLog(),
    workState: null,
    restLeft: 0,
    showingCues: false,
    pulse: { connected: false, lastValidAtMs: null, lastShoutAtMs: null },
    bpm: null,
    pulseStatus: null,
  };
}

export function currentWork(planned: PlannedSession, state: ViewState): PlannedWorkItem | null {
  return planned.work[state.workIndex] ?? null;
}

/** Phase label stored in persistence (rest maps to work). */
export function persistPhase(state: ViewState): "warmup" | "work" {
  if (state.phase === "rest") {
    return "work";
  }
  if (state.phase === "warmup") {
    return "warmup";
  }
  return "work";
}

export function syncWorkState(
  planned: PlannedSession,
  state: ViewState,
): ActiveWorkState | null {
  const item = currentWork(planned, state);
  if (!item) {
    return null;
  }
  return {
    slotId: item.slotId,
    exerciseId: item.exerciseId,
    setIndex: state.setIndex,
    prescribedReps: item.dose.reps,
    addedLoadKg: item.dose.addedLoadKg,
    nextRepsOverride: state.workState?.nextRepsOverride,
  };
}

function restoreWorkState(
  planned: PlannedSession,
  state: ViewState,
  nextRepsOverride: number | undefined,
): ActiveWorkState | null {
  const synced = syncWorkState(planned, state);
  if (!synced) {
    return null;
  }
  return { ...synced, nextRepsOverride };
}
