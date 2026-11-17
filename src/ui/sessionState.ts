import type { PlannedSession, PlannedWorkItem } from "../rules/planSession";
import { warmupTransitionSeconds, type WarmupStep } from "../rules/warmupPlan";
import { estimatePlannedSessionSeconds } from "../rules/sessionDuration";
import { createEmptyLog, DEFAULT_ADDED_LOAD_KG, type ActiveWorkState } from "../session/setLog";
import { INITIAL_PULSE } from "./pulseState";
import type { SessionViewOptions, ViewState } from "./sessionTypes";

export function initialState(options: SessionViewOptions): ViewState {
  const plannedTotalSeconds = estimatePlannedSessionSeconds(options.planned);
  const resume = options.resume;
  if (resume) {
    const state: ViewState = {
      phase: resume.phase,
      warmupIndex: resume.warmupIndex,
      workIndex: resume.workIndex,
      cooldownIndex: resume.cooldownIndex ?? 0,
      setIndex: resume.setIndex,
      log: resume.log,
      workState: null,
      restLeft: 0,
      pulse: { ...INITIAL_PULSE },
      bpm: null,
      pulseStatus: null,
      startedAtMs: resolveStartedAtMs(resume.startedAt, resume.savedAt),
      plannedTotalSeconds,
      addWeightKg: options.addWeightKg ?? DEFAULT_ADDED_LOAD_KG,
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
    cooldownIndex: 0,
    setIndex: 1,
    log: createEmptyLog(),
    workState: null,
    restLeft: 0,
    pulse: { ...INITIAL_PULSE },
    bpm: null,
    pulseStatus: null,
    startedAtMs: Date.now(),
    plannedTotalSeconds,
    addWeightKg: options.addWeightKg ?? DEFAULT_ADDED_LOAD_KG,
  };
}

export function currentWork(planned: PlannedSession, state: ViewState): PlannedWorkItem | null {
  return planned.work[state.workIndex] ?? null;
}

export type PersistedPhase = "warmup" | "work" | "cooldown" | "done";

/** Phase label stored in persistence (a rest maps to the surface it belongs to). */
export function persistPhase(planned: PlannedSession, state: ViewState): PersistedPhase {
  if (state.phase !== "rest") {
    return state.phase;
  }
  if (state.workState !== null) {
    return "work";
  }
  if (state.warmupIndex < planned.warmup.length) {
    return "warmup";
  }
  return state.workIndex >= planned.work.length ? "cooldown" : "work";
}

/**
 * After the last warm-up station: point at the first work set and return the
 * "Get ready" rest to run first (0 = go straight to work). During that rest
 * the state is `rest` with the first set's work state.
 */
export function enterWorkAfterWarmup(planned: PlannedSession, state: ViewState): number {
  state.workIndex = 0;
  state.setIndex = 1;
  state.workState = syncWorkState(planned, state);
  const rest = state.workState === null ? 0 : warmupTransitionSeconds(planned.warmup);
  state.phase = rest > 0 ? "rest" : "work";
  state.restLeft = rest;
  return rest;
}

/**
 * The work set needs its state once the warm-up is over. A rest during the
 * warm-up is a gap between stations, not the get-ready before the first set.
 */
export function needsWorkState(planned: PlannedSession, state: ViewState): boolean {
  return (
    (state.phase === "work" || state.phase === "rest") &&
    state.workState === null &&
    state.warmupIndex >= planned.warmup.length
  );
}

/** True during the warm-up → work rest (the only rest before a first set). */
export function isGetReadyRest(state: ViewState): boolean {
  return state.phase === "rest" && state.workState !== null && state.workIndex === 0 && state.setIndex === 1;
}

/** Cool-down stations (sessions saved before the cool-down existed have none). */
export function cooldownSteps(planned: PlannedSession): WarmupStep[] {
  return planned.cooldown ?? [];
}

/**
 * After the last work item: offer the cool-down on the done screen, or end
 * the session straight away when the template has none.
 */
export function enterDone(planned: PlannedSession, state: ViewState): "offer" | "finish" {
  state.workState = null;
  if (cooldownSteps(planned).length === 0) {
    return "finish";
  }
  state.phase = "done";
  state.cooldownIndex = 0;
  return "offer";
}

/** Start the optional cool-down from the done screen. */
export function startCooldown(planned: PlannedSession, state: ViewState): void {
  if (state.phase !== "done" || cooldownSteps(planned).length === 0) {
    throw new Error("Cool-down can only start from the done screen of a session that has one");
  }
  state.phase = "cooldown";
  state.cooldownIndex = 0;
  state.workState = null;
}

/** Move to the next stretch; "finish" when the last one is done. */
export function advanceCooldown(planned: PlannedSession, state: ViewState): "next" | "finish" {
  state.cooldownIndex += 1;
  if (state.cooldownIndex >= cooldownSteps(planned).length) {
    return "finish";
  }
  state.phase = "cooldown";
  return "next";
}

export function syncWorkState(
  planned: PlannedSession,
  state: ViewState,
): ActiveWorkState | null {
  const item = currentWork(planned, state);
  if (!item) {
    return null;
  }
  const prior = state.workState;
  const sameSet =
    prior &&
    prior.slotId === item.slotId &&
    prior.exerciseId === item.exerciseId &&
    prior.setIndex === state.setIndex;
  return {
    slotId: item.slotId,
    exerciseId: item.exerciseId,
    setIndex: state.setIndex,
    prescribedReps: item.dose.reps,
    addedLoadKg: item.dose.addedLoadKg,
    nextRepsOverride: prior?.nextRepsOverride,
    setStartedAtMs: sameSet ? prior.setStartedAtMs : undefined,
  };
}

/** Stamp (or refresh) the rep-set duration clock when a work screen is shown. */
export function stampSetStartedAt(
  work: ActiveWorkState,
  nowMs: number = Date.now(),
): ActiveWorkState {
  return { ...work, setStartedAtMs: nowMs };
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
