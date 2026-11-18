import { displayExerciseName } from "../library/displayName";
import type { PlannedSession } from "../rules/planSession";
import { cooldownOfferLabel, warmupMinutesLabel } from "../rules/sessionDuration";
import { warmupViewSeconds } from "../rules/warmupPlan";
import { cooldownSteps } from "./sessionState";
import type { ViewState } from "./sessionTypes";

/** Compact session progress line: position + current (+ next). */
export function chalkNowLabel(planned: PlannedSession, state: ViewState): string {
  if (isWarmupSurface(planned, state)) {
    return warmupChalkLabel(planned, state);
  }
  if (isCooldownSurface(planned, state)) {
    return cooldownChalkLabel(planned, state);
  }
  if (state.phase === "done") {
    return "Session done";
  }
  return workChalkLabel(planned, state);
}

export type ChalkRailNotch = {
  className: string;
  title: string;
};

/** Horizontal chalk notches: warmup + each work slot. */
export function chalkRailNotches(
  planned: PlannedSession,
  state: ViewState,
): ChalkRailNotch[] {
  const warmup: ChalkRailNotch = {
    className: warmupRailClass(planned, state),
    title: warmupMinutesLabel(warmupViewSeconds(planned.warmup)),
  };
  const work = planned.work.map((item, index) => ({
    className: workRailClass(state, index),
    title: displayExerciseName(item.label),
  }));
  const cooldown = cooldownSteps(planned);
  if (cooldown.length === 0) {
    return [warmup, ...work];
  }
  const cooldownNotch: ChalkRailNotch = {
    className: isCooldownSurface(planned, state) ? "active" : "",
    title: cooldownOfferLabel(warmupViewSeconds(cooldown)),
  };
  return [warmup, ...work, cooldownNotch];
}

/** True while the optional cool-down runs (including the gaps between stretches). */
export function isCooldownSurface(planned: PlannedSession, state: ViewState): boolean {
  if (state.phase === "cooldown") {
    return true;
  }
  return (
    state.phase === "rest" &&
    state.workState === null &&
    state.warmupIndex >= planned.warmup.length &&
    state.workIndex >= planned.work.length
  );
}

function cooldownChalkLabel(planned: PlannedSession, state: ViewState): string {
  const steps = cooldownSteps(planned);
  const step = steps[state.cooldownIndex];
  return joinChalk(cooldownOfferLabel(warmupViewSeconds(steps)), step && displayExerciseName(step.name));
}

/** True while the athlete is still on the warmup surface (including warmup rest). */
export function isWarmupSurface(
  planned: PlannedSession,
  state: ViewState,
): boolean {
  if (state.phase === "warmup") {
    return true;
  }
  return (
    state.phase === "rest" &&
    state.workState === null &&
    state.warmupIndex < planned.warmup.length
  );
}

function warmupChalkLabel(planned: PlannedSession, state: ViewState): string {
  const step = planned.warmup[state.warmupIndex];
  if (!step) {
    return "Warmup done";
  }
  const nextWork = planned.work[0];
  return joinChalk(
    warmupMinutesLabel(warmupViewSeconds(planned.warmup)),
    displayExerciseName(step.name),
    nextWork ? `next ${displayExerciseName(nextWork.label)}` : undefined,
  );
}

function workChalkLabel(planned: PlannedSession, state: ViewState): string {
  const item = planned.work[state.workIndex];
  if (!item) {
    return "Session";
  }
  const next = planned.work[state.workIndex + 1];
  return joinChalk(
    `${state.workIndex + 1} of ${planned.work.length}`,
    displayExerciseName(item.label),
    next ? `next ${displayExerciseName(next.label)}` : undefined,
  );
}

function joinChalk(...parts: Array<string | undefined>): string {
  return parts.filter((part): part is string => part !== undefined).join(" · ");
}

function warmupRailClass(planned: PlannedSession, state: ViewState): string {
  if (isWarmupSurface(planned, state)) {
    return "active";
  }
  if (state.warmupIndex >= planned.warmup.length) {
    return "done";
  }
  return "";
}

function workRailClass(state: ViewState, index: number): string {
  if (state.phase === "warmup") {
    return "";
  }
  if (state.phase === "cooldown" || state.phase === "done") {
    return "done";
  }
  if (state.workIndex === index) {
    return "active";
  }
  if (state.workIndex > index) {
    return "done";
  }
  return "";
}
