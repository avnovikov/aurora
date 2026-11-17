import type { PlannedSession } from "../rules/planSession";
import {
  estimateRemainingSessionSeconds,
  type SessionProgress,
} from "../rules/sessionRemaining";
import { isCooldownSurface, isWarmupSurface } from "./sessionChalkStrip";
import type { ViewState } from "./sessionTypes";

/** Map live session view state to the progress snapshot the Left clock uses. */
export function sessionProgressOf(
  planned: PlannedSession,
  state: ViewState,
): SessionProgress {
  return {
    surface: progressSurface(planned, state),
    phase: state.phase,
    warmupIndex: state.warmupIndex,
    workIndex: state.workIndex,
    setIndex: state.setIndex,
    restLeft: state.restLeft,
    holdLeft: state.holdLeft,
    sideSwitchLeft: state.sideSwitchLeft,
  };
}

export function theoreticalRemainingSeconds(
  planned: PlannedSession,
  state: ViewState,
): number {
  return estimateRemainingSessionSeconds(planned, sessionProgressOf(planned, state));
}

function progressSurface(
  planned: PlannedSession,
  state: ViewState,
): SessionProgress["surface"] {
  if (state.phase === "done") {
    return "done";
  }
  if (isWarmupSurface(planned, state)) {
    return "warmup";
  }
  if (isCooldownSurface(planned, state)) {
    return "cooldown";
  }
  return "work";
}
