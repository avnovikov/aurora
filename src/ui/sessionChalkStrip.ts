import type { PlannedSession } from "../rules/planSession";
import { warmupMinutesLabel } from "../rules/sessionDuration";
import { warmupViewSeconds } from "../rules/warmupPlan";
import type { ViewState } from "./sessionTypes";

/** Compact session progress line: position + current (+ next). */
export function chalkNowLabel(planned: PlannedSession, state: ViewState): string {
  if (isWarmupSurface(planned, state)) {
    return warmupChalkLabel(planned, state);
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
    title: item.label,
  }));
  return [warmup, ...work];
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
    step.name,
    nextWork ? `next ${nextWork.label}` : undefined,
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
    item.label,
    next ? `next ${next.label}` : undefined,
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
  if (state.workIndex === index) {
    return "active";
  }
  if (state.workIndex > index) {
    return "done";
  }
  return "";
}
