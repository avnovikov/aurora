import { EXERCISE_GRAPH } from "../data/exerciseGraph";
import { doodleMarkup } from "../doodles/doodleMarkup";
import { resolveExerciseTiming } from "../domain/timing";
import { escapeHtml } from "../library/present";
import { isNativePulseAvailable } from "../pulse/hrMonitor";
import type { PlannedSession, PlannedWorkItem } from "../rules/planSession";
import { formatClock, sessionClockSnapshot } from "../session/sessionClock";
import { DEFAULT_ADDED_LOAD_KG, prescribedForNextSet } from "../session/setLog";
import { cooldownOfferLabel } from "../rules/sessionDuration";
import { SIDE_SWITCH_SECONDS, warmupViewSeconds, type WarmupStep } from "../rules/warmupPlan";
import {
  chalkNowLabel,
  chalkRailNotches,
  isCooldownSurface,
  isWarmupSurface,
} from "./sessionChalkStrip";
import { cooldownSteps, currentWork, isGetReadyRest } from "./sessionState";
import type { ViewState } from "./sessionTypes";
import { doseNoteHtml } from "./sessionDoseNote";
import { weightControlsHtml } from "./sessionWeightControls";
import "../styles/session.css";

export function shellHtml(planned: PlannedSession, state: ViewState): string {
  const light = planned.lightDay || planned.deload ? "light-day" : "";
  return `
    <main class="shell session ${light}">
      <header class="session-top">
        ${sessionClockHtml(state)}
        ${chalkHtml(planned, state)}
      </header>
      ${bodyHtml(planned, state)}
      ${pulseBarHtml(state, isWorkSurface(planned, state) ? WORK_ACTIONS_HTML : "")}
    </main>
  `;
}

/** Log set and its alternatives: pinned in the bottom bar so they are always in thumb reach. */
const WORK_ACTIONS_HTML = `
        <div class="work-actions">
          <button type="button" class="cta" data-log-set>Log set</button>
          <button type="button" class="btn-quiet" data-fail-set>Couldn't finish</button>
          <button type="button" class="btn-quiet" data-skip>Skip set</button>
        </div>`;

/** The screen shows a working set (not warm-up, rest, cool-down or the end). */
function isWorkSurface(planned: PlannedSession, state: ViewState): boolean {
  if (isWarmupSurface(planned, state) || isCooldownSurface(planned, state)) {
    return false;
  }
  if (state.phase === "done" || (state.phase === "rest" && state.workState)) {
    return false;
  }
  return currentWork(planned, state) !== null;
}

/** Pinned to the bottom, in thumb reach: the set actions (during work), the pulse reading and the Strap controls. */
function pulseBarHtml(state: ViewState, actions: string): string {
  const pulseClass = state.pulse.connected && state.bpm === null ? " pulse-lost" : "";
  const status = state.pulseStatus
    ? `<p class="session-bar-status" data-pulse-status>${escapeHtml(state.pulseStatus)}</p>`
    : "";
  return `
      <footer class="session-bar pulse-row${pulseClass}">
        ${actions}
        ${status}
        <p class="pulse-chip">Pulse${state.bpm === null ? ": no reading" : ` ${state.bpm}`}</p>
        <details class="pulse-more strap">
          <summary>Strap</summary>
          <div class="strap-actions">${pulseControlsHtml()}</div>
        </details>
      </footer>`;
}

/** "Elapsed 0:01 · Left 31:40", each number in its own hook for the 1 s repaint. */
function sessionClockHtml(state: ViewState, nowMs: number = Date.now()): string {
  const clock = sessionClockSnapshot(
    state.startedAtMs,
    state.plannedTotalSeconds,
    nowMs,
  );
  return `<div class="session-clock" data-session-clock>
          <p class="session-clock-part"><span class="session-clock-label">Elapsed</span> <span class="session-clock-num" data-session-elapsed>${formatClock(clock.elapsedSeconds)}</span></p>
          <span class="visually-hidden">·</span>
          <p class="session-clock-part"><span class="session-clock-label">Left</span> <span class="session-clock-num" data-session-left>${formatClock(clock.remainingSeconds)}</span></p>
        </div>`;
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

/** Segmented station bar (warm-up, each work slot, cool-down), then the small "now" line. */
function chalkHtml(planned: PlannedSession, state: ViewState): string {
  const now = escapeHtml(chalkNowLabel(planned, state));
  const notches = chalkRailNotches(planned, state)
    .map((notch) => {
      const classAttr = notch.className ? ` class="${notch.className}"` : "";
      const current = notch.className === "active" ? ` aria-current="step"` : "";
      return `<li${classAttr}${current}><span class="visually-hidden">${escapeHtml(notch.title)}</span></li>`;
    })
    .join("");
  return `
        <ol class="session-rail" role="list" aria-label="Stations">${notches}</ol>
        <p class="chalk-now">${now}</p>
  `;
}

/** The move in one sentence, from the curated Library text. */
function summaryHtml(summary: string | undefined): string {
  return summary ? `<p class="lib-summary session-summary">${escapeHtml(summary)}</p>` : "";
}

/**
 * What to keep in mind while doing the move: the form cues, then anything
 * the athlete's joint history adds. Always visible, never behind a tap.
 */
function attentionHtml(cues: readonly string[], cautions: readonly string[] = []): string {
  if (cues.length === 0 && cautions.length === 0) {
    return "";
  }
  const cueItems = cues.map((cue) => `<li>${escapeHtml(cue)}</li>`).join("");
  const jointItems = cautions.map((note) => `<li class="attention-joint">${escapeHtml(note)}</li>`).join("");
  return `<div class="session-attention" data-attention><p class="eyebrow">Pay attention to</p><ul class="cues">${cueItems}${jointItems}</ul></div>`;
}

/** Collapsible step-by-step instructions for the current exercise. */
function stepsHtml(item: PlannedWorkItem): string {
  if (!item.steps?.length) {
    return "";
  }
  const steps = item.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("");
  return `<details class="session-howto"><summary>How to</summary><ol class="lib-steps">${steps}</ol></details>`;
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
    return `<section class="session-read"><p class="tagline">No work items.</p></section>`;
  }
  return workHtml(item, state);
}

function warmupHtml(planned: PlannedSession, state: ViewState): string {
  const step = planned.warmup[state.warmupIndex];
  if (!step) {
    return `<section class="session-read"><p class="tagline">Warmup complete</p></section>`;
  }
  return stationHtml("Warmup", step);
}

function cooldownHtml(planned: PlannedSession, state: ViewState): string {
  const step = cooldownSteps(planned)[state.cooldownIndex];
  if (!step) {
    return `<section class="session-read"><p class="tagline">Cool-down complete</p></section>`;
  }
  return `
    ${stationHtml("Cool-down", step)}
    <div class="work-actions-secondary session-end-cooldown">
      <button type="button" class="btn-quiet" data-cooldown-skip>End cool-down</button>
    </div>
  `;
}

/** Hidden banner the station timer shows during the halfway change-side pause. */
function sideSwitchHtml(step: WarmupStep): string {
  if (step.perSide !== true) {
    return "";
  }
  return `<p class="side-switch" data-side-switch hidden>Change side · <span data-side-switch-left>${SIDE_SWITCH_SECONDS}</span></p>`;
}

/** One timed station (warm-up or cool-down) with its evidence citation in small text. */
function stationHtml(eyebrow: string, step: WarmupStep): string {
  const source = step.source
    ? `<p class="station-source">${escapeHtml(step.source)}</p>`
    : "";
  const dose = `
      <p class="session-dose"><span class="session-dose-q">${escapeHtml(step.region)} <span aria-hidden="true">·</span></span> ${doseFigureHtml(`<span data-warmup-left>${step.holdSeconds}</span>`, SECONDS_UNIT_HTML)}</p>
      ${sideSwitchHtml(step)}`;
  return `
    ${heroHtml({ phase: eyebrow, move: step.name, dose, doodle: doodleMarkup(step.doodlePath, step.name) })}
    <section class="session-read">
      ${summaryHtml(EXERCISE_GRAPH[step.stationId]?.description)}
      ${attentionHtml(step.cues)}
      ${source}
    </section>
  `;
}

interface HeroParts {
  /** Phase eyebrow, already safe HTML ("Warmup", "Set 2 of 3"). */
  phase: string;
  /** Move name, escaped here. */
  move: string;
  /** Dose markup: the big figure and anything that belongs with it. */
  dose: string;
  /** Doodle markup from doodleMarkup, or "" for none. */
  doodle: string;
}

/** Phase eyebrow, move name, the dose as the hero, then the doodle in its own full-width row. */
function heroHtml({ phase, move, dose, doodle }: HeroParts): string {
  const frame = doodle ? `<div class="session-frame">${doodle}</div>` : "";
  return `
    <section class="session-hero">
      <p class="eyebrow session-phase">${phase}</p>
      <h1 class="session-move">${escapeHtml(move)}</h1>
      ${dose}
      ${frame}
    </section>`;
}

/** Done screen: the work is over; offer the optional cool-down (start or skip). */
function doneHtml(planned: PlannedSession, state: ViewState): string {
  const steps = cooldownSteps(planned);
  const sets = `${state.log.entries.length} sets logged.`;
  if (steps.length === 0) {
    return `
      <section class="session-read">
        <p class="eyebrow">Session done</p>
        <p class="tagline">${sets}</p>
        <button type="button" class="cta" data-cooldown-skip>Finish</button>
      </section>
    `;
  }
  const names = steps.map((step) => escapeHtml(step.name)).join(" · ");
  return `
    <div class="cooldown-offer session-read" data-cooldown-offer>
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

function nextSetReps(state: ViewState, fallback: number): number {
  return state.workState ? prescribedForNextSet(state.workState) : fallback;
}

/** Shared − / value / + stepper: the work hero and the rest "Next set reps" row. */
function repsStepperHtml(rowClass: string, valueHtml: string): string {
  return `
      <div class="row ${rowClass}">
        <button type="button" class="rest-step" data-reps-minus aria-label="One fewer">−</button>
        ${valueHtml}
        <button type="button" class="rest-step" data-reps-plus aria-label="One more">+</button>
      </div>`;
}

/** Spoken as "seconds", shown as a small "s". */
const SECONDS_UNIT_HTML = `<span class="session-dose-unit" aria-hidden="true">s</span><span class="visually-hidden">seconds</span>`;

/** The big dose number followed by its unit. */
function doseFigureHtml(valueHtml: string, unitHtml: string): string {
  return `<span class="session-dose-fig">${valueHtml}${unitHtml}</span>`;
}

/** "s" for a timed hold, "reps" otherwise; the same rule the plan preview uses. */
function workUnit(item: PlannedWorkItem): string {
  const exercise = EXERCISE_GRAPH[item.exerciseId];
  return exercise !== undefined && resolveExerciseTiming(exercise).effort === "hold" ? "s" : "reps";
}

/** The work dose as the hero: − / big number + unit / +. */
function workDoseHtml(reps: number, unit: string): string {
  const figure = doseFigureHtml(`<span class="reps">${reps}</span>`, `<span class="session-dose-unit">${unit}</span>`);
  return repsStepperHtml("session-dose work-reps-row", figure);
}

function workHtml(item: PlannedWorkItem, state: ViewState): string {
  const reps = nextSetReps(state, item.dose.reps);
  const loadKg = state.workState?.addedLoadKg ?? 0;
  const dose = `${workDoseHtml(reps, workUnit(item))}
      ${doseNoteHtml(item, state.setIndex, reps)}
      ${weightControlsHtml(loadKg, state.addWeightKg ?? DEFAULT_ADDED_LOAD_KG)}`;
  return `
    <div class="work-stage" data-swipe-stage>
      ${heroHtml({
        phase: `Set ${state.setIndex} of ${item.dose.sets}`,
        move: item.exerciseName,
        dose,
        doodle: doodleMarkup(item.doodlePath, item.exerciseName),
      })}
      <section class="session-read">
        ${summaryHtml(item.summary)}
        ${attentionHtml(item.cues, item.cautions)}
        ${stepsHtml(item)}
        <details class="session-why">
          <summary>Why this dose</summary>
          <p class="reason">${escapeHtml(item.reason)}</p>
        </details>
        <p class="hint">Log each set below, or swipe to finish this exercise</p>
      </section>
    </div>
  `;
}

function restHtml(planned: PlannedSession, state: ViewState): string {
  const item = currentWork(planned, state);
  const reps = nextSetReps(state, 0);
  const nextLine = item
    ? `next ${escapeHtml(item.exerciseName)} · Set ${state.setIndex} of ${item.dose.sets}`
    : "next set";
  const getReady = isGetReadyRest(state);
  const getReadyNote = getReady
    ? `<p class="tagline">Easy rest after the ramp: walk, breathe, stay warm.</p>`
    : "";
  return `
    <div class="rest-stage">
      <section class="session-hero">
        <p class="eyebrow session-phase">${getReady ? "Get ready" : "Rest"} · ${nextLine}</p>
        <p class="session-dose">${doseFigureHtml(`<span class="reps" data-rest-left>${state.restLeft}</span>`, SECONDS_UNIT_HTML)}</p>
        <p class="rest-cue" data-rest-cue></p>
        ${getReadyNote}
      </section>
      <section class="session-read">
        <p class="tagline">Next set reps</p>
        ${repsStepperHtml("rest-reps-row", `<span class="reps-edit">${reps}</span>`)}
      </section>
    </div>
  `;
}
