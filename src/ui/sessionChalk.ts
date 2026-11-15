import { escapeHtml } from "../library/present";
import { isNativePulseAvailable } from "../pulse/hrMonitor";
import type { PlannedSession, PlannedWorkItem } from "../rules/planSession";
import { sessionClockSnapshot } from "../session/sessionClock";
import { prescribedForNextSet } from "../session/setLog";
import { cooldownOfferLabel } from "../rules/sessionDuration";
import { warmupViewSeconds, type WarmupStep } from "../rules/warmupPlan";
import {
  chalkNowLabel,
  chalkRailNotches,
  isCooldownSurface,
  isWarmupSurface,
} from "./sessionChalkStrip";
import { cooldownSteps, currentWork, isGetReadyRest } from "./sessionState";
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

function sessionClockHtml(state: ViewState, nowMs: number = Date.now()): string {
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

function jointCautionHtml(cautions: string[]): string {
  if (cautions.length === 0) {
    return "";
  }
  const items = cautions.map((note) => `<li>${escapeHtml(note)}</li>`).join("");
  return `<div class="joint-caution"><p class="eyebrow">Heads up</p><ul class="cues">${items}</ul></div>`;
}

function cuesBlockHtml(cues: string[]): string {
  if (cues.length === 0) {
    return "";
  }
  const [onlyCue] = cues;
  if (cues.length === 1 && onlyCue) {
    return `<p class="cue-teaser">${escapeHtml(onlyCue)}</p>`;
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
  if (isCooldownSurface(planned, state)) {
    return cooldownHtml(planned, state);
  }
  if (state.phase === "done") {
    return doneHtml(planned, state);
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
  return stationHtml("Warmup", step);
}

function cooldownHtml(planned: PlannedSession, state: ViewState): string {
  const step = cooldownSteps(planned)[state.cooldownIndex];
  if (!step) {
    return `<p class="tagline">Cool-down complete</p>`;
  }
  return `
    ${stationHtml("Cool-down", step)}
    <div class="work-actions-secondary">
      <button type="button" class="btn-quiet" data-cooldown-skip>End cool-down</button>
    </div>
  `;
}

/** One timed station (warm-up or cool-down) with its evidence citation in small text. */
function stationHtml(eyebrow: string, step: WarmupStep): string {
  const source = step.source
    ? `<p class="station-source">${escapeHtml(step.source)}</p>`
    : "";
  return `
    <p class="eyebrow">${eyebrow}</p>
    <h2>${escapeHtml(step.name)}</h2>
    <p class="tagline">${escapeHtml(step.region)} · <span data-warmup-left>${step.holdSeconds}</span>s</p>
    ${doodleHtml(step.doodlePath, step.name)}
    ${cuesBlockHtml(step.cues)}
    ${source}
  `;
}

/** Done screen: the work is over; offer the optional cool-down (start or skip). */
function doneHtml(planned: PlannedSession, state: ViewState): string {
  const steps = cooldownSteps(planned);
  const sets = `${state.log.entries.length} sets logged.`;
  if (steps.length === 0) {
    return `
      <p class="eyebrow">Session done</p>
      <p class="tagline">${sets}</p>
      <button type="button" class="cta" data-cooldown-skip>Finish</button>
    `;
  }
  const names = steps.map((step) => escapeHtml(step.name)).join(" · ");
  return `
    <div class="cooldown-offer" data-cooldown-offer>
      <p class="eyebrow">Session done · ${sets}</p>
      <h2>${escapeHtml(cooldownOfferLabel(warmupViewSeconds(steps)))}</h2>
      <p class="tagline">Optional stretches for range: ${names}.</p>
      <p class="station-source">Builds range, not a soreness or injury fix (Garber 2011; Herbert 2011; Lauersen 2014).</p>
      <div class="work-actions">
        <button type="button" class="cta" data-cooldown-start>Start</button>
        <div class="work-actions-secondary">
          <button type="button" class="btn-quiet" data-cooldown-skip>Skip</button>
        </div>
      </div>
    </div>
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
      ${jointCautionHtml(item.cautions)}
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
  const getReady = isGetReadyRest(state);
  const getReadyNote = getReady
    ? `<p class="tagline">Easy rest after the ramp: walk, breathe, stay warm.</p>`
    : "";
  return `
    <div class="rest-stage">
      <p class="eyebrow">${getReady ? "Get ready" : "Rest"} · ${nextLine}</p>
      <p class="reps" data-rest-left>${state.restLeft}</p>
      <p class="rest-cue" data-rest-cue></p>
      ${getReadyNote}
      <p class="tagline">Next set reps</p>
      <div class="row rest-reps-row">
        <button type="button" class="rest-step" data-reps-minus>−</button>
        <span class="reps-edit">${reps}</span>
        <button type="button" class="rest-step" data-reps-plus>+</button>
      </div>
    </div>
  `;
}
