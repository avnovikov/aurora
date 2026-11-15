import { escapeHtml } from "../library/present";
import { isNativePulseAvailable } from "../pulse/hrMonitor";
import type { PlannedSession, PlannedWorkItem } from "../rules/planSession";
import { WARMUP_GAPS, warmupMinutesLabel } from "../rules/sessionDuration";
import { warmupViewSeconds } from "../rules/warmupPlan";
import { sessionClockSnapshot } from "../session/sessionClock";
import { prescribedForNextSet } from "../session/setLog";
import type { ViewState } from "./sessionTypes";
import { currentWork } from "./sessionState";

export function shellHtml(planned: PlannedSession, state: ViewState): string {
  const light = planned.lightDay || planned.deload ? "light-day" : "";
  const pulseClass = state.pulse.connected && state.bpm === null ? "pulse-lost" : "";
  return `
    <main class="shell session ${light}">
      ${sessionClockHtml(state)}
      ${chalkHtml(planned, state)}
      <div class="pulse-row ${pulseClass}">
        <span>Pulse ${state.bpm ?? "—"}</span>
        ${pulseControlsHtml()}
      </div>
      ${
        state.pulseStatus
          ? `<p class="tagline" data-pulse-status>${escapeHtml(state.pulseStatus)}</p>`
          : ""
      }
      ${bodyHtml(planned, state)}
    </main>
  `;
}

export function sessionClockHtml(state: ViewState, nowMs: number = Date.now()): string {
  const clock = sessionClockSnapshot(
    state.startedAtMs,
    state.plannedTotalSeconds,
    nowMs,
  );
  return `<p class="session-clock" data-session-clock>${escapeHtml(clock.label)}</p>`;
}

function pulseControlsHtml(): string {
  if (isNativePulseAvailable()) {
    return `
      <button type="button" data-pulse-connect>Connect pulse</button>
      <button type="button" data-pulse-disconnect>Disconnect</button>
    `;
  }
  return `
    <button type="button" data-sim-pulse-ok>Pulse ok</button>
    <button type="button" data-sim-pulse-lost>Pulse lost</button>
  `;
}

function warmupNotchClass(state: ViewState, planned: PlannedSession): string {
  if (state.phase === "warmup") {
    return "active";
  }
  if (state.warmupIndex >= planned.warmup.length) {
    return "done";
  }
  return "";
}

function workNotchClass(state: ViewState, index: number): string {
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

function chalkHtml(planned: PlannedSession, state: ViewState): string {
  const warmupNotch = `<li class="${warmupNotchClass(state, planned)}">${warmupMinutesLabel(warmupViewSeconds(planned.warmup))}</li>`;
  const workNotches = planned.work.map((item, index) => {
    const cls = workNotchClass(state, index);
    return `<li class="${cls}">${item.label}</li>`;
  });
  const notches = [warmupNotch, ...workNotches];
  return `<ol class="chalk">${notches.join("")}</ol>`;
}

function cuesListHtml(cues: string[]): string {
  if (cues.length === 0) {
    return "";
  }
  const items = cues.map((cue) => `<li>${escapeHtml(cue)}</li>`).join("");
  return `<ul class="cues doodle-cues">${items}</ul>`;
}

/** Curated summary and collapsible how-to steps for the current exercise. */
function howToHtml(item: PlannedWorkItem): string {
  const summary = item.summary ? `<p class="lib-summary">${escapeHtml(item.summary)}</p>` : "";
  if (!item.steps?.length) {
    return summary;
  }
  const steps = item.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("");
  return `${summary}<details class="session-howto"><summary>How to</summary><ol class="lib-steps">${steps}</ol></details>`;
}

function bodyHtml(planned: PlannedSession, state: ViewState): string {
  if (
    state.phase === "warmup" ||
    (state.phase === "rest" && state.workState === null && state.warmupIndex < planned.warmup.length)
  ) {
    return warmupHtml(planned, state);
  }
  if (state.phase === "rest" && state.workState) {
    return restHtml(state);
  }
  const item = currentWork(planned, state);
  if (!item) {
    return `<p class="tagline">No work items.</p>`;
  }
  return workHtml(item, state);
}

function warmupHtml(planned: PlannedSession, state: ViewState): string {
  const step = planned.warmup[state.warmupIndex];
  if (!step) {
    return `<p class="tagline">Warmup complete</p>`;
  }
  const media = step.doodlePath
    ? `<img class="doodle" src="${step.doodlePath}" alt="Doodle for ${escapeHtml(step.name)}" />`
    : "";
  const cues = cuesListHtml(step.cues);
  return `
    <p class="eyebrow">Warmup session</p>
    <h2>${escapeHtml(step.name)}</h2>
    <p class="tagline">${escapeHtml(step.region)} · <span data-warmup-left>${step.holdSeconds}</span>s</p>
    ${media}
    ${cues}
    <p class="reason">Prebuilt sequence · ${WARMUP_GAPS.sameArea}s same area · ${WARMUP_GAPS.crossArea}s cross area</p>
  `;
}

function workHtml(item: PlannedWorkItem, state: ViewState): string {
  const reps = state.workState ? prescribedForNextSet(state.workState) : item.dose.reps;
  const media = item.doodlePath
    ? `<img class="doodle" src="${item.doodlePath}" alt="Doodle for ${escapeHtml(item.exerciseName)}" />`
    : "";
  const cues = cuesListHtml(item.cues);
  return `
    <div class="work-stage" data-swipe-stage>
      <p class="eyebrow">${escapeHtml(item.label)} · Set ${state.setIndex} of ${item.dose.sets}</p>
      <h2>${escapeHtml(item.exerciseName)}</h2>
      <p class="reps">${reps}</p>
      <p class="reason">${escapeHtml(item.reason)}</p>
      ${media}
      ${howToHtml(item)}
      ${cues}
      <div class="row">
        <button type="button" class="cta" data-log-set>Log set</button>
        <button type="button" data-fail-set>Failed</button>
        <button type="button" data-skip>Skip</button>
      </div>
      <p class="hint">Swipe right → left to finish exercise</p>
    </div>
  `;
}

function restHtml(state: ViewState): string {
  const reps = state.workState ? prescribedForNextSet(state.workState) : 0;
  return `
    <p class="eyebrow">Rest</p>
    <p class="reps" data-rest-left>${state.restLeft}</p>
    <p class="tagline">Next set reps</p>
    <div class="row">
      <button type="button" data-reps-minus>−</button>
      <span class="reps-edit">${reps}</span>
      <button type="button" data-reps-plus>+</button>
    </div>
  `;
}
