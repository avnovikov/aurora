import { describe, expect, it } from "vitest";
import { EXERCISE_GRAPH } from "../../src/data/exerciseGraph";
import { SESSION_TEMPLATES, templateToStarter } from "../../src/data/seed";
import type { Readiness } from "../../src/domain/types";
import { resolveExerciseTiming } from "../../src/domain/timing";
import { escapeHtml } from "../../src/library/present";
import { planSession, type PlannedSession, type PlannedWorkItem } from "../../src/rules/planSession";
import { formatClock } from "../../src/session/sessionClock";
import { createEmptyLog } from "../../src/session/setLog";
import { shellHtml } from "../../src/ui/sessionChalk";
import { chalkNowLabel, chalkRailNotches } from "../../src/ui/sessionChalkStrip";
import { INITIAL_PULSE } from "../../src/ui/pulseState";
import { initialState } from "../../src/ui/sessionState";
import type { ViewState } from "../../src/ui/sessionTypes";
import { useMemoryStorage } from "../helpers/storage";

useMemoryStorage();

const readiness: Readiness = { sleepQuality: "good", restingHrBpm: 58, painJoints: [] };

function planTemplate(templateId: string): PlannedSession {
  const template = SESSION_TEMPLATES.find((item) => item.id === templateId)!;
  return planSession(readiness, templateToStarter(template), {});
}

function planLegs(): PlannedSession {
  return planTemplate("tmpl_legs");
}

function isHoldMove(item: PlannedWorkItem): boolean {
  const exercise = EXERCISE_GRAPH[item.exerciseId];
  return exercise !== undefined && resolveExerciseTiming(exercise).effort === "hold";
}

function warmupView(planned: PlannedSession): ViewState {
  const state = initialState({ planned, onDone: () => undefined });
  state.phase = "warmup";
  state.warmupIndex = 0;
  state.log = createEmptyLog();
  state.pulse = { ...INITIAL_PULSE };
  return state;
}

function workView(planned: PlannedSession, workIndex = 0): ViewState {
  const state = warmupView(planned);
  const item = planned.work[workIndex]!;
  state.phase = "work";
  state.warmupIndex = planned.warmup.length;
  state.workIndex = workIndex;
  state.setIndex = 1;
  state.workState = {
    slotId: item.slotId,
    exerciseId: item.exerciseId,
    setIndex: 1,
    prescribedReps: item.dose.reps,
    addedLoadKg: 0,
  };
  return state;
}

/** The text between the first `open` marker and the next `close` after it. */
function slice(html: string, open: string, close: string): string {
  const start = html.indexOf(open);
  expect(start).toBeGreaterThan(-1);
  const end = html.indexOf(close, start + open.length);
  return html.slice(start, end === -1 ? undefined : end);
}

describe("session header", () => {
  it("splits the clock into Elapsed and Left, numbers in their own hooks", () => {
    const planned = planLegs();
    const state = warmupView(planned);
    state.startedAtMs = Date.now();
    const html = shellHtml(planned, state);
    const header = slice(html, '<header class="session-top"', "</header>");
    expect(header).toContain("data-session-clock");
    expect(header).toMatch(/>Elapsed<\/span>/);
    expect(header).toMatch(/>Left<\/span>/);
    expect(header).toMatch(/data-session-elapsed>0:0\d</);
    const left = formatClock(state.plannedTotalSeconds);
    expect(header).toContain(`data-session-left>${left}<`);
  });

  it("replaces the dot row with one segment per station, the current one marked", () => {
    const planned = planLegs();
    const state = warmupView(planned);
    const html = shellHtml(planned, state);
    const rail = slice(html, '<ol class="session-rail"', "</ol>");
    const notches = chalkRailNotches(planned, state);
    expect(rail).toContain('aria-label="Stations"');
    expect(rail.match(/<li/g)).toHaveLength(notches.length);
    expect(rail.match(/aria-current="step"/g)).toHaveLength(1);
    const current = notches.find((notch) => notch.className === "active")!;
    expect(slice(rail, 'aria-current="step"', "</li>")).toContain(escapeHtml(current.title));
    expect(html).not.toContain("chalk-rail");
  });

  it("keeps the small phase · minutes · move · next line under the bar", () => {
    const planned = planLegs();
    const state = warmupView(planned);
    const html = shellHtml(planned, state);
    const header = slice(html, '<header class="session-top"', "</header>");
    expect(header.indexOf("session-rail")).toBeLessThan(header.indexOf("chalk-now"));
    expect(header).toContain(chalkNowLabel(planned, state));
  });
});

describe("dose as hero", () => {
  it("shows the warm-up hold as a big number with its unit, from the step", () => {
    const planned = planLegs();
    const step = planned.warmup[0]!;
    const html = shellHtml(planned, warmupView(planned));
    const hero = slice(html, '<section class="session-hero"', "</section>");
    expect(hero).toContain(">Warmup</p>");
    expect(hero).toContain(`>${escapeHtml(step.name)}</h1>`);
    const dose = slice(hero, '<p class="session-dose"', "</p>");
    expect(dose).toContain(step.region);
    expect(dose).toContain(`<span data-warmup-left>${step.holdSeconds}</span>`);
    expect(dose).toMatch(/class="session-dose-unit" aria-hidden="true">s</);
  });

  it("places the doodle under the dose in its own frame, before the description", () => {
    const planned = planLegs();
    const html = shellHtml(planned, warmupView(planned));
    const dose = html.indexOf('class="session-dose"');
    const frame = html.indexOf('class="session-frame"');
    const doodle = html.indexOf('class="doodle"');
    const summary = html.indexOf("session-summary");
    expect(dose).toBeLessThan(frame);
    expect(frame).toBeLessThan(doodle);
    expect(doodle).toBeLessThan(summary);
  });

  it("orders description, cues, then the citation on a station", () => {
    const planned = planLegs();
    const step = planned.warmup.find((item) => item.source)!;
    const state = warmupView(planned);
    state.warmupIndex = planned.warmup.indexOf(step);
    const html = shellHtml(planned, state);
    const read = slice(html, '<section class="session-read"', "</section>");
    expect(read.indexOf("session-summary")).toBeLessThan(read.indexOf("data-attention"));
    expect(read.indexOf("data-attention")).toBeLessThan(read.indexOf("station-source"));
  });

  it("shows the work set reps as the hero with its unit, steppers either side", () => {
    const planned = planLegs();
    const item = planned.work[0]!;
    const html = shellHtml(planned, workView(planned));
    const dose = slice(html, '<div class="row session-dose work-reps-row"', "</div>");
    expect(dose).toContain("data-reps-minus");
    expect(dose).toContain("data-reps-plus");
    expect(dose).toContain(`<span class="reps">${item.dose.reps}</span>`);
    expect(dose).toContain(`class="session-dose-unit">${isHoldMove(item) ? "s" : "reps"}<`);
  });

  it("uses seconds for a timed work move", () => {
    const planned = planTemplate("tmpl_abs");
    const index = planned.work.findIndex(isHoldMove);
    expect(index).toBeGreaterThan(-1);
    const html = shellHtml(planned, workView(planned, index));
    expect(html).toContain(`<span class="reps">${planned.work[index]!.dose.reps}</span>`);
    expect(html).toContain('class="session-dose-unit">s<');
  });

  it("keeps the swipe stage, Log set and steppers inside the work hero", () => {
    const planned = planLegs();
    const html = shellHtml(planned, workView(planned));
    const stage = html.indexOf("data-swipe-stage");
    expect(stage).toBeGreaterThan(-1);
    expect(html.indexOf("session-hero")).toBeGreaterThan(stage);
    expect(html.indexOf("data-log-set")).toBeGreaterThan(stage);
    expect(html).toMatch(/<h1 class="session-move">/);
  });

  it("shows the rest countdown as the hero in seconds", () => {
    const planned = planLegs();
    const state = workView(planned);
    state.phase = "rest";
    state.setIndex = 2;
    state.restLeft = 90;
    const html = shellHtml(planned, state);
    const dose = slice(html, '<p class="session-dose"', "</p>");
    expect(dose).toContain('<span class="reps" data-rest-left>90</span>');
    expect(dose).toMatch(/class="session-dose-unit" aria-hidden="true">s</);
    expect(html).toContain("Rest · next");
    expect(html).toContain("data-rest-cue");
  });
});

describe("pulse bar", () => {
  it("pins Pulse and Strap in a bar after the content", () => {
    const planned = planLegs();
    const html = shellHtml(planned, warmupView(planned));
    const bar = slice(html, '<footer class="session-bar', "</footer>");
    expect(bar).toContain("Pulse: no reading");
    expect(bar).toMatch(/<summary>Strap<\/summary>/);
    expect(bar).toContain('class="strap-actions"');
    expect(bar).toContain("data-sim-pulse-ok");
    expect(bar).toContain("data-sim-pulse-lost");
    expect(html.indexOf("session-read")).toBeLessThan(html.indexOf("session-bar"));
  });

  it("shows the reading and a lost strap in the bar", () => {
    const planned = planLegs();
    const state = warmupView(planned);
    state.bpm = 62;
    expect(shellHtml(planned, state)).toContain("Pulse 62");
    state.bpm = null;
    state.pulse = { ...state.pulse, connected: true };
    state.pulseStatus = "Pulse strap disconnected.";
    const bar = slice(shellHtml(planned, state), '<footer class="session-bar', "</footer>");
    expect(bar).toContain("pulse-lost");
    expect(bar).toContain("data-pulse-status");
  });
});
