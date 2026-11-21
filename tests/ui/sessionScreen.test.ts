import { afterEach, describe, expect, it, vi } from "vitest";
import { EXERCISE_GRAPH } from "../../src/data/exerciseGraph";
import { SESSION_TEMPLATES, templateToStarter } from "../../src/data/seed";
import type { Readiness } from "../../src/domain/types";
import { resolveExerciseTiming } from "../../src/domain/timing";
import { displayExerciseName } from "../../src/library/displayName";
import { escapeHtml } from "../../src/library/present";
import {
  disconnectHeartRate,
  PULSE_STRAP_ALREADY_CONNECTED,
  PULSE_STRAP_DISCONNECTED,
  setBleHeartRateClientForTests,
  type BleHeartRateClient,
} from "../../src/pulse/hrMonitor";
import { planSession, type PlannedSession, type PlannedWorkItem } from "../../src/rules/planSession";
import { formatClock } from "../../src/session/sessionClock";
import { createEmptyLog } from "../../src/session/setLog";
import { shellHtml } from "../../src/ui/sessionChalk";
import { chalkNowLabel, chalkRailNotches } from "../../src/ui/sessionChalkStrip";
import { INITIAL_PULSE } from "../../src/ui/pulseState";
import { initialState } from "../../src/ui/sessionState";
import type { ViewState } from "../../src/ui/sessionTypes";
import { PULSE_LOST_UI_MS } from "../../src/voice/pulseAlert";
import { useMemoryStorage } from "../helpers/storage";

afterEach(async () => {
  await disconnectHeartRate();
  setBleHeartRateClientForTests(null);
});

function mockNativeClient(): BleHeartRateClient {
  return {
    initialize: vi.fn(async () => undefined),
    requestDevice: vi.fn(async () => ({ deviceId: "strap-1" })),
    connect: vi.fn(async () => undefined),
    startNotifications: vi.fn(async () => undefined),
    stopNotifications: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
  };
}

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
  // Drop any leftover warmup station clock before asserting work dose UI.
  state.holdLeft = 0;
  state.sideSwitchLeft = 0;
  state.workState = {
    slotId: item.slotId,
    exerciseId: item.exerciseId,
    setIndex: 1,
    prescribedReps: item.dose.reps,
    addedLoadKg: 0,
  };
  return state;
}

function restView(planned: PlannedSession, setIndex = 2, restLeft = 90): ViewState {
  const state = workView(planned);
  state.phase = "rest";
  state.setIndex = setIndex;
  state.restLeft = restLeft;
  return state;
}

/** The text between the first `open` marker and the next `close` after it. */
function slice(html: string, open: string, close: string): string {
  const start = html.indexOf(open);
  expect(start).toBeGreaterThan(-1);
  const end = html.indexOf(close, start + open.length);
  return html.slice(start, end === -1 ? undefined : end);
}

function pulseBar(html: string): string {
  return slice(html, '<footer class="session-bar', "</footer>");
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

  /** The first warm-up station swapped for `exerciseId`, rendered. */
  function stationDose(exerciseId: string): string {
    const planned = planLegs();
    planned.warmup[0] = { ...planned.warmup[0]!, exerciseId, stationId: exerciseId, perSide: false };
    const html = shellHtml(planned, warmupView(planned));
    return slice(html, '<p class="session-dose"', 'data-hold-cue');
  }

  it("says a moving station is reps for the time, not a hold (glute bridge, jumping jacks)", () => {
    for (const id of ["glute_bridge", "ntc_jumping_jacks"]) {
      const dose = stationDose(id);
      expect(dose).toContain("reps for</span>");
      expect(dose).toContain('data-station-effort="reps"');
      expect(dose).not.toMatch(/\bhold\b/i);
    }
  });

  it("says an isometric station is a hold", () => {
    const dose = stationDose("hf_99");
    expect(dose).toContain("hold</span>");
    expect(dose).toContain('data-station-effort="hold"');
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
    expect(html).toContain(
      `<span class="reps" data-work-hold-left>${planned.work[index]!.dose.reps}</span>`,
    );
    expect(html).toContain('class="session-dose-unit" aria-hidden="true">s<');
  });

  it("keeps the swipe stage, Log set and steppers inside the work hero", () => {
    const planned = planLegs();
    const html = shellHtml(planned, workView(planned));
    const stage = html.indexOf('data-swipe-stage="work"');
    expect(stage).toBeGreaterThan(-1);
    expect(html.indexOf("session-hero")).toBeGreaterThan(stage);
    expect(html.indexOf("data-log-set")).toBeGreaterThan(stage);
    expect(html).toMatch(/<h1 class="session-move">/);
  });

  it("shows the rest countdown as the hero in seconds", () => {
    const planned = planLegs();
    const html = shellHtml(planned, restView(planned));
    const dose = slice(html, '<div class="session-dose session-dose--rest"', "</div>");
    expect(dose).toContain('<span class="reps" data-rest-left>90</span>');
    expect(dose).toMatch(/class="session-dose-unit" aria-hidden="true">s</);
    expect(html).toContain("data-rest-cue");
  });

  it("puts the next-set doodle to the right of the countdown on work rest", () => {
    const planned = planLegs();
    const item = planned.work[0]!;
    expect(item.doodlePath).toBeTruthy();
    const html = shellHtml(planned, restView(planned));
    const next = displayExerciseName(item.exerciseName);
    expect(html).toMatch(/<p class="eyebrow session-phase">Rest<\/p>/);
    expect(html).not.toContain("Rest · next");
    expect(html).toContain('class="rest-next"');
    expect(html).toContain('class="session-dose session-dose--rest"');
    expect(html).toContain('class="rest-next-doodle"');
    expect(html).toContain('class="doodle"');
    expect(html).toContain(`next ${next} · Set 2 of ${item.dose.sets}`);
    expect(html.indexOf('class="rest-next"')).toBeLessThan(html.indexOf("data-rest-left"));
    expect(html.indexOf("data-rest-left")).toBeLessThan(html.indexOf('class="rest-next-doodle"'));
  });

  it("keeps the next-set line without a doodle frame when the move has none", () => {
    const planned = planLegs();
    const item = planned.work[0]!;
    item.doodlePath = undefined;
    const html = shellHtml(planned, restView(planned));
    expect(html).toContain('class="rest-next"');
    expect(html).toContain(`next ${displayExerciseName(item.exerciseName)} · Set 2 of ${item.dose.sets}`);
    expect(html).not.toContain('class="rest-next-doodle"');
    expect(html).not.toContain('class="doodle"');
  });

  it("shows the upcoming station doodle beside seconds on a warmup gap", () => {
    const planned = planLegs();
    const next = planned.warmup[1];
    expect(next?.doodlePath).toBeTruthy();
    const state = warmupView(planned);
    state.phase = "rest";
    state.warmupIndex = 0;
    state.restLeft = 10;
    const html = shellHtml(planned, state);
    expect(html).toMatch(/<p class="eyebrow session-phase">Rest<\/p>/);
    expect(html).toContain(`next ${escapeHtml(displayExerciseName(next!.name))}`);
    expect(html).toContain('class="session-dose session-dose--rest"');
    expect(html.indexOf("data-rest-left")).toBeLessThan(html.indexOf('class="rest-next-doodle"'));
    expect(html).toContain('class="doodle"');
  });
});

describe("forward swipe", () => {
  it("tells the athlete a left swipe logs the set and rests", () => {
    const planned = planLegs();
    const html = shellHtml(planned, workView(planned));
    expect(html).toContain("swipe left to log it and rest");
    expect(html).not.toContain("swipe to finish this exercise");
  });

  it("makes the rest a swipe stage that ends the rest early", () => {
    const planned = planLegs();
    const state = workView(planned);
    state.phase = "rest";
    state.setIndex = 2;
    state.restLeft = 90;
    const html = shellHtml(planned, state);
    expect(html).toContain('data-swipe-stage="rest"');
    expect(html).not.toContain('data-swipe-stage="work"');
    expect(slice(html, 'data-swipe-stage="rest"', "</section>\n    </div>")).toContain(
      "Swipe left to end the rest now",
    );
  });
});

describe("pulse bar", () => {
  it("pins Pulse and Strap in a bar after the content", () => {
    const planned = planLegs();
    const html = shellHtml(planned, warmupView(planned));
    const bar = pulseBar(html);
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
    state.pulse = {
      connected: true,
      lastValidAtMs: Date.now() - (PULSE_LOST_UI_MS + 1_000),
      lastShoutAtMs: null,
    };
    state.pulseStatus = PULSE_STRAP_DISCONNECTED;
    const bar = pulseBar(shellHtml(planned, state));
    expect(bar).toContain("pulse-lost");
    expect(bar).toContain("data-pulse-status");
  });

  it("does not flash lost the moment a reading is briefly missing", () => {
    const planned = planLegs();
    const state = warmupView(planned);
    state.bpm = null;
    state.pulse = {
      connected: true,
      lastValidAtMs: Date.now() - Math.floor(PULSE_LOST_UI_MS / 5),
      lastShoutAtMs: null,
    };
    expect(pulseBar(shellHtml(planned, state))).not.toMatch(
      /session-bar pulse-row pulse-lost/,
    );
  });

  it("hides connected status text when the strap is already linked", () => {
    const planned = planLegs();
    const state = warmupView(planned);
    state.pulse = { ...state.pulse, connected: true };
    state.bpm = 72;
    state.pulseStatus = PULSE_STRAP_ALREADY_CONNECTED;
    const bar = pulseBar(shellHtml(planned, state));
    expect(bar).toContain("Pulse 72");
    expect(bar).not.toContain("data-pulse-status");
    expect(bar).not.toContain(PULSE_STRAP_ALREADY_CONNECTED);
  });

  it("disables Connect pulse when connected and enables it when not", () => {
    setBleHeartRateClientForTests(mockNativeClient());
    const planned = planLegs();
    const state = warmupView(planned);
    state.pulse = { ...state.pulse, connected: true };
    expect(pulseBar(shellHtml(planned, state))).toContain(
      "data-pulse-connect disabled",
    );

    state.pulse = { ...state.pulse, connected: false };
    const openBar = pulseBar(shellHtml(planned, state));
    expect(openBar).toContain("data-pulse-connect");
    expect(openBar).not.toContain("data-pulse-connect disabled");
  });
});
