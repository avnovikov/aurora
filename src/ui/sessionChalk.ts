import { EXERCISE_GRAPH } from "../data/exerciseGraph";
import { doodleMarkup } from "../doodles/doodleMarkup";
import { resolveExerciseTiming } from "../domain/timing";
import type { EffortKind } from "../domain/types";
import { displayExerciseName } from "../library/displayName";
import { escapeHtml } from "../library/present";
import {
  isNativePulseAvailable,
  PULSE_STRAP_ALREADY_CONNECTED,
  PULSE_STRAP_CONNECTED,
} from "../pulse/hrMonitor";
import type { PlannedSession, PlannedWorkItem } from "../rules/planSession";
import { formatClock, sessionClockSnapshot } from "../session/sessionClock";
import { prescribedForNextSet } from "../session/setLog";
import { cooldownOfferLabel } from "../rules/sessionDuration";
import { theoreticalRemainingSeconds } from "./sessionClockProgress";
import {
  SIDE_SWITCH_SECONDS,
  stationEffort,
  warmupStepExerciseId,
  warmupViewSeconds,
  type WarmupStep,
} from "../rules/warmupPlan";
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
import { isPulseLost, pulseChipHtml } from "./sessionPulse";
import "../styles/session.css";

/** Mid-session Swap / Easier / Skip today / Never again controls on the work stage. */
export interface WorkAdjustUi {
  easierAvailable: boolean;
  swapOpen: boolean;
  swapOptions: readonly { id: string; name: string }[];
  status?: string;
  showUndo?: boolean;
}

export function shellHtml(
  planned: PlannedSession,
  state: ViewState,
  adjust: WorkAdjustUi | null = null,
): string {
  const light = planned.lightDay || planned.deload ? "light-day" : "";
  const surface = surfaceHtml(planned, state, adjust);
  const pendingUndo = pendingAdjustNoticeHtml(adjust, surface.workToolbar);
  return `
    <main class="shell session ${light}">
      <header class="session-top">
        ${sessionClockHtml(planned, state)}
        ${chalkHtml(planned, state)}
      </header>
      ${pendingUndo}
      ${surface.body}
      ${pulseBarHtml(state, surface.barActions)}
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

/** Success copy the pulse chip already conveys — keep the status line quiet. */
const QUIET_PULSE_SUCCESS = new Set([
  PULSE_STRAP_CONNECTED,
  PULSE_STRAP_ALREADY_CONNECTED,
]);

/** True only for problem / progress copy — not success when the chip already shows linked. */
function shouldShowPulseStatus(status: string | null): status is string {
  if (!status) {
    return false;
  }
  return !QUIET_PULSE_SUCCESS.has(status);
}

function pulseStatusHtml(status: string | null): string {
  if (!shouldShowPulseStatus(status)) {
    return "";
  }
  return `<p class="session-bar-status" data-pulse-status>${escapeHtml(status)}</p>`;
}

/** Pinned to the bottom, in thumb reach: the set actions (during work), the pulse reading and the Strap controls. */
function pulseBarHtml(state: ViewState, actions: string): string {
  const pulseClass = isPulseLost(state) ? " pulse-lost" : "";
  return `
      <footer class="session-bar pulse-row${pulseClass}">
        ${actions}
        ${pulseStatusHtml(state.pulseStatus)}
        ${pulseChipHtml(state)}
        <details class="pulse-more strap">
          <summary>Strap</summary>
          <div class="strap-actions">${pulseControlsHtml(state)}</div>
        </details>
      </footer>`;
}

/** "Elapsed 0:01 · Left 31:40", each number in its own hook for the 1 s repaint. */
function sessionClockHtml(
  planned: PlannedSession,
  state: ViewState,
  nowMs: number = Date.now(),
): string {
  const clock = sessionClockSnapshot(
    state.startedAtMs,
    nowMs,
    theoreticalRemainingSeconds(planned, state),
  );
  return `<div class="session-clock" data-session-clock>
          <p class="session-clock-part"><span class="session-clock-label">Elapsed</span> <span class="session-clock-num" data-session-elapsed>${formatClock(clock.elapsedSeconds)}</span></p>
          <span class="visually-hidden">·</span>
          <p class="session-clock-part"><span class="session-clock-label">Left</span> <span class="session-clock-num" data-session-left>${formatClock(clock.remainingSeconds)}</span></p>
        </div>`;
}

function pulseControlsHtml(state: ViewState): string {
  if (isNativePulseAvailable()) {
    const connectDisabled = state.pulse.connected ? " disabled" : "";
    return `
      <button type="button" data-pulse-connect${connectDisabled}>Connect pulse</button>
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


interface Surface {
  body: string;
  /** Set actions for the bottom bar; only a working set has them. */
  barActions: string;
  /** True when the full work adjust toolbar is already inside `body`. */
  workToolbar: boolean;
}

function offWork(body: string): Surface {
  return { body, barActions: "", workToolbar: false };
}

function surfaceHtml(
  planned: PlannedSession,
  state: ViewState,
  adjust: WorkAdjustUi | null,
): Surface {
  if (isWarmupSurface(planned, state)) {
    return offWork(warmupHtml(planned, state));
  }
  if (isCooldownSurface(planned, state)) {
    return offWork(cooldownHtml(planned, state));
  }
  if (state.phase === "done") {
    return offWork(doneHtml(planned, state));
  }
  if (state.phase === "rest" && state.workState) {
    return offWork(restHtml(planned, state));
  }
  const item = currentWork(planned, state);
  if (!item) {
    return offWork(`<section class="session-read"><p class="tagline">No work items.</p></section>`);
  }
  return {
    body: workHtml(item, state, adjust),
    barActions: WORK_ACTIONS_HTML,
    workToolbar: true,
  };
}

function warmupHtml(planned: PlannedSession, state: ViewState): string {
  if (!planned.warmup[state.warmupIndex]) {
    return `<section class="session-read"><p class="tagline">Warmup complete</p></section>`;
  }
  return stationOrGapHtml("Warmup", planned.warmup, state.warmupIndex, state);
}

function cooldownHtml(planned: PlannedSession, state: ViewState): string {
  const steps = cooldownSteps(planned);
  if (!steps[state.cooldownIndex]) {
    return `<section class="session-read"><p class="tagline">Cool-down complete</p></section>`;
  }
  return `
    ${stationOrGapHtml("Cool-down", steps, state.cooldownIndex, state)}
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

function warmupNotForMeHtml(exerciseId: string, move: string): string {
  return `<p class="work-actions-secondary"><button type="button" class="btn-quiet" data-warmup-not-for-me data-exercise-id="${escapeHtml(exerciseId)}" aria-label="Not for me: ${escapeHtml(move)}">Not for me</button></p>`;
}

/** What the clock on a timed station means: keep repping, or keep still. */
const STATION_EFFORT: Record<EffortKind, { label: string; note: string }> = {
  reps: { label: "reps for", note: "Keep repping at a steady pace until the time is up" },
  hold: { label: "hold", note: "Keep still in the position until the time is up" },
};

/** One timed station (warm-up or cool-down) with its evidence citation in small text. */
function stationHtml(eyebrow: string, step: WarmupStep): string {
  const effort = stationEffort(step);
  const source = step.source
    ? `<p class="station-source">${escapeHtml(step.source)}</p>`
    : "";
  const dose = `
      <p class="session-dose"><span class="session-dose-q">${escapeHtml(step.region)} <span aria-hidden="true">·</span> ${STATION_EFFORT[effort].label}</span> ${doseFigureHtml(`<span data-warmup-left>${step.holdSeconds}</span>`, SECONDS_UNIT_HTML)}</p>
      <p class="dose-note" data-station-effort="${effort}">${STATION_EFFORT[effort].note}</p>
      <p class="rest-cue" data-hold-cue aria-live="polite"></p>
      ${sideSwitchHtml(step)}`;
  const move = displayExerciseName(step.name);
  const exerciseId = warmupStepExerciseId(step);
  const notForMe = eyebrow === "Warmup" ? warmupNotForMeHtml(exerciseId, move) : "";
  return `
    <div class="station-stage swipe-stage" data-swipe-stage="station">
      ${heroHtml({ phase: eyebrow, move, dose, doodle: doodleMarkup(step.doodlePath, move) })}
      <section class="session-read">
        ${summaryHtml(EXERCISE_GRAPH[exerciseId]?.description)}
        ${attentionHtml(step.cues)}
        ${source}
        ${notForMe}
        <p class="hint">Swipe left to finish this one now</p>
      </section>
    </div>
  `;
}

/**
 * Station `index` while it runs; in its gap (the timer has put the view into
 * rest, the index not yet advanced) the rest before the station after it.
 */
function stationOrGapHtml(
  eyebrow: string,
  steps: readonly WarmupStep[],
  index: number,
  state: ViewState,
): string {
  return state.phase === "rest"
    ? stationGapHtml(steps[index + 1], state)
    : stationHtml(eyebrow, steps[index]!);
}

/** The short rest between two stations: the countdown and the station that comes next. */
function stationGapHtml(next: WarmupStep | undefined, state: ViewState): string {
  const nextLine = next ? `next ${escapeHtml(displayExerciseName(next.name))}` : "next station";
  return `
    <div class="rest-stage swipe-stage" data-swipe-stage="rest">
      ${restHeroHtml(`Rest · ${nextLine}`, state)}
      <section class="session-read">
        <p class="hint">Swipe left to start it now</p>
      </section>
    </div>
  `;
}

/**
 * Rest countdown as the hero. `lead` sits under the phase eyebrow (work rest
 * puts the next-move row there); `extra` goes after the cue.
 */
function restHeroHtml(
  eyebrow: string,
  state: ViewState,
  { lead = "", extra = "" }: { lead?: string; extra?: string } = {},
): string {
  return `
      <section class="session-hero">
        <p class="eyebrow session-phase">${eyebrow}</p>
        ${lead}
        <p class="session-dose">${doseFigureHtml(`<span class="reps" data-rest-left>${state.restLeft}</span>`, SECONDS_UNIT_HTML)}</p>
        <p class="rest-cue" data-rest-cue></p>
        ${extra}
      </section>`;
}

/** Compact doodle + next-set line for work rest; no empty frame when the move has no doodle. */
function workRestNextHtml(item: PlannedWorkItem | null, state: ViewState): string {
  let picture = "";
  let line = "next set";
  if (item) {
    const move = displayExerciseName(item.exerciseName);
    const doodle = doodleMarkup(item.doodlePath, move);
    if (doodle) picture = `<div class="rest-next-doodle">${doodle}</div>`;
    line = `next ${escapeHtml(move)} · Set ${state.setIndex} of ${item.dose.sets}`;
  }
  return `
    <div class="rest-next">
      ${picture}
      <p class="rest-next-line">${line}</p>
    </div>`;
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
  const names = steps.map((step) => escapeHtml(displayExerciseName(step.name))).join(" · ");
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

/** Quiet toolbar button: `Label: move` for the aria-label. */
function workAdjustAction(dataAttr: string, label: string, move: string, extra = ""): string {
  return `<button type="button" class="btn-quiet" ${dataAttr}${extra} aria-label="${escapeHtml(label)}: ${escapeHtml(move)}">${label}</button>`;
}

function easierAdjustHtml(available: boolean, move: string): string {
  if (available) {
    return workAdjustAction("data-work-easier", "Easier", move);
  }
  return `${workAdjustAction(
    "data-work-easier",
    "Easier",
    move,
    ` aria-disabled="true" aria-describedby="work-no-easier"`,
  )}<span class="visually-hidden" id="work-no-easier">No easier step</span>`;
}

function swapPicksHtml(adjust: WorkAdjustUi): string {
  if (!adjust.swapOpen) {
    return "";
  }
  if (adjust.swapOptions.length === 0) {
    return `<p class="lib-meta" data-work-swap-empty>No other move fits this slot with your gear, joints and exclusions.</p>`;
  }
  const picks = adjust.swapOptions
    .map(
      (option) =>
        `<button type="button" class="btn-quiet" data-work-swap-pick="${escapeHtml(option.id)}">${escapeHtml(option.name)}</button>`,
    )
    .join("");
  return `<div class="session-work-swap" role="group" aria-label="Swap for">${picks}</div>`;
}

function workAdjustStatusHtml(adjust: WorkAdjustUi): string {
  if (!adjust.status) {
    return "";
  }
  return `<p class="session-work-adjust-status" role="status" data-work-adjust-status>${escapeHtml(adjust.status)}</p>`;
}

function workAdjustUndoHtml(adjust: WorkAdjustUi): string {
  if (!adjust.showUndo) {
    return "";
  }
  return `<button type="button" class="btn-quiet" data-work-undo aria-label="Undo exclusion">Undo</button>`;
}

/** Status + Undo when Never again advanced off the work stage (next rest / done / cool-down). */
function pendingAdjustNoticeHtml(adjust: WorkAdjustUi | null, workToolbar: boolean): string {
  if (!adjust?.showUndo || workToolbar) {
    return "";
  }
  return `<div class="session-work-adjust session-work-adjust-pending">${workAdjustStatusHtml(adjust)}${workAdjustUndoHtml(adjust)}</div>`;
}

/** Toolbar above the hero: Swap · Easier · Skip today · Never again. */
function workAdjustHtml(adjust: WorkAdjustUi | null, move: string): string {
  if (!adjust) {
    return "";
  }
  return `
    <div class="session-work-adjust">
      <div class="session-work-adjust-row">
        ${workAdjustAction("data-work-swap", "Swap", move, ` aria-pressed="${adjust.swapOpen ? "true" : "false"}"`)}
        ${easierAdjustHtml(adjust.easierAvailable, move)}
        ${workAdjustAction("data-work-skip-today", "Skip today", move)}
        ${workAdjustAction("data-work-never", "Never again", move)}
      </div>
      ${swapPicksHtml(adjust)}
      ${workAdjustStatusHtml(adjust)}${workAdjustUndoHtml(adjust)}
    </div>`;
}

function workHtml(item: PlannedWorkItem, state: ViewState, adjust: WorkAdjustUi | null): string {
  const reps = nextSetReps(state, item.dose.reps);
  const loadKg = state.workState?.addedLoadKg ?? 0;
  const move = displayExerciseName(item.exerciseName);
  const dose = `${workDoseHtml(reps, workUnit(item))}
      ${doseNoteHtml(item, state.setIndex, reps)}
      ${weightControlsHtml(loadKg, state.addWeightKg)}`;
  return `
    <div class="work-stage swipe-stage" data-swipe-stage="work">
      ${workAdjustHtml(adjust, move)}
      ${heroHtml({
        phase: `Set ${state.setIndex} of ${item.dose.sets}`,
        move,
        dose,
        doodle: doodleMarkup(item.doodlePath, move),
      })}
      <section class="session-read">
        ${summaryHtml(item.summary)}
        ${attentionHtml(item.cues, item.cautions)}
        ${stepsHtml(item)}
        <details class="session-why">
          <summary>Why this dose</summary>
          <p class="reason">${escapeHtml(item.reason)}</p>
        </details>
        <p class="hint">Log each set below, or swipe left to log it and rest</p>
      </section>
    </div>
  `;
}

function restHtml(planned: PlannedSession, state: ViewState): string {
  const item = currentWork(planned, state);
  const reps = nextSetReps(state, 0);
  const getReady = isGetReadyRest(state);
  const phase = getReady ? "Get ready" : "Rest";
  const getReadyNote = getReady
    ? `<p class="tagline">Easy rest after the ramp: walk, breathe, stay warm.</p>`
    : "";
  return `
    <div class="rest-stage swipe-stage" data-swipe-stage="rest">
      ${restHeroHtml(phase, state, { lead: workRestNextHtml(item, state), extra: getReadyNote })}
      <section class="session-read">
        <p class="tagline">Next set reps</p>
        ${repsStepperHtml("rest-reps-row", `<span class="reps-edit">${reps}</span>`)}
        <p class="hint">Swipe left to end the rest now</p>
      </section>
    </div>
  `;
}
