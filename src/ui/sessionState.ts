import type { PlannedSession, PlannedWorkItem } from "../rules/planSession";
import { estimatePlannedSessionSeconds } from "../rules/sessionDuration";
import { createEmptyLog, type ActiveWorkState } from "../session/setLog";
import { INITIAL_PULSE } from "./pulseState";
import type { SessionViewOptions, ViewState } from "./sessionTypes";

export function initialState(options: SessionViewOptions): ViewState {
  const plannedTotalSeconds = estimatePlannedSessionSeconds(options.planned);
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
      pulse: { ...INITIAL_PULSE },
      bpm: null,
      pulseStatus: null,
      startedAtMs: resolveStartedAtMs(resume.startedAt, resume.savedAt),
      plannedTotalSeconds,
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
    pulse: { ...INITIAL_PULSE },
    bpm: null,
    pulseStatus: null,
    startedAtMs: Date.now(),
    plannedTotalSeconds,
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

function resolveStartedAtMs(startedAt: string | undefined, savedAt: string): number {
  if (startedAt) {
    const parsed = Date.parse(startedAt);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  const fallback = Date.parse(savedAt);
  return Number.isFinite(fallback) ? fallback : Date.now();
}
