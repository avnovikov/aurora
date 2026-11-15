import { escapeHtml } from "../library/present";
import { isNativePulseAvailable } from "../pulse/hrMonitor";
import type { PlannedSession, PlannedWorkItem } from "../rules/planSession";
import { sessionClockSnapshot } from "../session/sessionClock";
import { prescribedForNextSet } from "../session/setLog";
import {
  chalkNowLabel,
  chalkRailNotches,
  isWarmupSurface,
} from "./sessionChalkStrip";
import { currentWork } from "./sessionState";
import type { ViewState } from "./sessionTypes";

export function shellHtml(planned: PlannedSession, state: ViewState): string {
  const light = planned.lightDay || planned.deload ? "light-day" : "";
  const pulseClass = state.pulse.connected && state.bpm === null ? "pulse-lost" : "";
  return `
    <main class="shell session ${light}">
      ${sessionClockHtml(state)}
      ${chalkHtml(planned, state)}
      <div class="pulse-row ${pulseClass}">
        <span class="pulse-chip">Pulse ${state.bpm ?? "—"}</span>
        <details class="pulse-more">
          <summary>Strap</summary>
          ${pulseControlsHtml()}
        </details>
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

function chalkHtml(planned: PlannedSession, state: ViewState): string {
  const now = escapeHtml(chalkNowLabel(planned, state));
  const notches = chalkRailNotches(planned, state)
    .map((notch) => {
      const classAttr = notch.className ? ` class="${notch.className}"` : "";
      return `<li${classAttr} title="${escapeHtml(notch.title)}"></li>`;
    })
    .join("");
  return `
    <div class="chalk-head">
      <p class="chalk-now">${now}</p>
      <ol class="chalk-rail" aria-hidden="true">${notches}</ol>
    </div>
  `;
}

function cuesBlockHtml(cues: string[]): string {
  if (cues.length === 0) {
    return "";
  }
  if (cues.length === 1) {
    return `<p class="cue-teaser">${escapeHtml(cues[0]!)}</p>`;
  }
  const items = cues.map((cue) => `<li>${escapeHtml(cue)}</li>`).join("");
  return `
    <details class="session-cues">
      <summary>Form cues</summary>
      <ul class="cues doodle-cues">${items}</ul>
    </details>
  `;
}

/** Curated summary and collapsible how-to steps for the current exercise. */
function howToHtml(item: PlannedWorkItem): string {
  const summary = item.summary
    ? `<p class="lib-summary">${escapeHtml(item.summary)}</p>`
    : "";
  if (!item.steps?.length) {
    return summary;
  }
  const steps = item.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("");
  return `${summary}<details class="session-howto"><summary>How to</summary><ol class="lib-steps">${steps}</ol></details>`;
}

function doodleHtml(path: string | undefined, name: string): string {
  if (!path) {
    return "";
  }
  return `<img class="doodle" src="${path}" alt="Doodle for ${escapeHtml(name)}" />`;
}

function bodyHtml(planned: PlannedSession, state: ViewState): string {
  if (isWarmupSurface(planned, state)) {
    return warmupHtml(planned, state);
  }
  if (state.phase === "rest" && state.workState) {
    return restHtml(planned, state);
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
  return `
    <p class="eyebrow">Warmup</p>
    <h2>${escapeHtml(step.name)}</h2>
    <p class="tagline">${escapeHtml(step.region)} · <span data-warmup-left>${step.holdSeconds}</span>s</p>
    ${doodleHtml(step.doodlePath, step.name)}
    ${cuesBlockHtml(step.cues)}
  `;
}

function workHtml(item: PlannedWorkItem, state: ViewState): string {
  const reps = state.workState ? prescribedForNextSet(state.workState) : item.dose.reps;
  return `
    <div class="work-stage" data-swipe-stage>
      <p class="eyebrow">Set ${state.setIndex} of ${item.dose.sets}</p>
      <h2>${escapeHtml(item.exerciseName)}</h2>
      <p class="reps">${reps}</p>
      ${doodleHtml(item.doodlePath, item.exerciseName)}
      ${howToHtml(item)}
      ${cuesBlockHtml(item.cues)}
      <details class="session-why">
        <summary>Why this dose</summary>
        <p class="reason">${escapeHtml(item.reason)}</p>
      </details>
      <div class="work-actions">
        <button type="button" class="cta" data-log-set>Log set</button>
        <div class="work-actions-secondary">
          <button type="button" class="btn-quiet" data-fail-set>Failed</button>
          <button type="button" class="btn-quiet" data-skip>Skip</button>
        </div>
      </div>
      <p class="hint">Swipe left or right to finish</p>
    </div>
  `;
}

function restHtml(planned: PlannedSession, state: ViewState): string {
  const item = currentWork(planned, state);
  const reps = state.workState ? prescribedForNextSet(state.workState) : 0;
  const nextLine = item
    ? `next ${escapeHtml(item.exerciseName)} · Set ${state.setIndex} of ${item.dose.sets}`
    : "next set";
  return `
    <div class="rest-stage">
      <p class="eyebrow">Rest · ${nextLine}</p>
      <p class="reps" data-rest-left>${state.restLeft}</p>
      <p class="rest-cue" data-rest-cue></p>
      <p class="tagline">Next set reps</p>
      <div class="row rest-reps-row">
        <button type="button" class="rest-step" data-reps-minus>−</button>
        <span class="reps-edit">${reps}</span>
        <button type="button" class="rest-step" data-reps-plus>+</button>
      </div>
    </div>
  `;
}
