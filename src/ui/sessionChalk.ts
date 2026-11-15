import type { PlannedSession, PlannedWorkItem } from "../rules/planSession";
import { prescribedForNextSet } from "../session/setLog";
import type { ViewState } from "./sessionTypes";
import { currentWork } from "./sessionState";

export function shellHtml(planned: PlannedSession, state: ViewState): string {
  const light = planned.lightDay ? "light-day" : "";
  const pulseClass = state.pulse.connected && state.bpm === null ? "pulse-lost" : "";
  return `
    <main class="shell session ${light}">
      ${chalkHtml(planned, state)}
      <div class="pulse-row ${pulseClass}">
        <span>Pulse ${state.bpm ?? "—"}</span>
        <button type="button" data-sim-pulse-ok>Pulse ok</button>
        <button type="button" data-sim-pulse-lost>Pulse lost</button>
      </div>
      ${bodyHtml(planned, state)}
    </main>
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
  const warmupNotch = `<li class="${warmupNotchClass(state, planned)}">Warmup · 10 min</li>`;
  const workNotches = planned.work.map((item, index) => {
    const cls = workNotchClass(state, index);
    return `<li class="${cls}">${item.label}</li>`;
  });
  const notches = [warmupNotch, ...workNotches];
  return `<ol class="chalk">${notches.join("")}</ol>`;
}

function cuesListHtml(cues: string[]): string {
  const items = cues.map((cue) => `<li>${cue}</li>`).join("");
  return `<ul class="cues">${items}</ul>`;
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
  if (!state.workState) {
    state.workState = {
      slotId: item.slotId,
      exerciseId: item.exerciseId,
      setIndex: state.setIndex,
      prescribedReps: item.dose.reps,
      addedLoadKg: item.dose.addedLoadKg,
    };
  }
  return workHtml(item, state);
}

function warmupHtml(planned: PlannedSession, state: ViewState): string {
  const step = planned.warmup[state.warmupIndex];
  if (!step) {
    return `<p class="tagline">Warmup complete</p>`;
  }
  const media = step.doodlePath
    ? `<img class="doodle" src="${step.doodlePath}" alt="Doodle for ${step.name}" />`
    : "";
  return `
    <p class="eyebrow">Warmup</p>
    <h2>${step.name}</h2>
    <p class="tagline">${step.region} · hold <span data-warmup-left>${step.holdSeconds}</span>s</p>
    ${media}
    <p class="reason">Continuous block · 5s same area · 10s cross area</p>
  `;
}

function workHtml(item: PlannedWorkItem, state: ViewState): string {
  const reps = state.workState ? prescribedForNextSet(state.workState) : item.dose.reps;
  const cues = state.showingCues ? cuesListHtml(item.cues) : "";
  const media = item.doodlePath
    ? `<img class="doodle" src="${item.doodlePath}" alt="Doodle for ${item.exerciseName}" />`
    : "";
  return `
    <div class="work-stage" data-swipe-stage>
      <p class="eyebrow">${item.label} · Set ${state.setIndex} of ${item.dose.sets}</p>
      <h2>${item.exerciseName}</h2>
      <p class="reps">${reps}</p>
      <p class="reason">${item.reason}</p>
      ${media}
      <div class="row">
        <button type="button" data-cues>Description</button>
        <button type="button" class="cta" data-log-set>Log set</button>
        <button type="button" data-fail-set>Failed</button>
        <button type="button" data-skip>Skip</button>
      </div>
      <p class="hint">Swipe right → left to finish exercise</p>
      ${cues}
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

export function doneShellHtml(setCount: number): string {
  return `
    <main class="shell">
      <p class="eyebrow">Session</p>
      <h1>Done</h1>
      <p class="tagline">${setCount} sets logged.</p>
      <button type="button" class="cta" data-home>Back to check-in</button>
    </main>
  `;
}