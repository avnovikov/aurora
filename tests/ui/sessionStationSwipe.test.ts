import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_TEMPLATES, templateToStarter } from "../../src/data/seed";
import type { Readiness } from "../../src/domain/types";
import { displayExerciseName } from "../../src/library/displayName";
import type { WarmupStep } from "../../src/rules/warmupPlan";
import { planSession, type PlannedSession } from "../../src/rules/planSession";
import { createEmptyLog } from "../../src/session/setLog";
import { shellHtml } from "../../src/ui/sessionChalk";
import { INITIAL_PULSE } from "../../src/ui/pulseState";
import { paintPulseReading } from "../../src/ui/sessionPulse";
import { initialState, needsWorkState, startCooldown } from "../../src/ui/sessionState";
import type { ViewState } from "../../src/ui/sessionTypes";
import { startStationHold } from "../../src/ui/sessionWarmup";
import { useMemoryStorage } from "../helpers/storage";

useMemoryStorage();

vi.mock("../../src/voice/coachVoice", () => ({
  speakExactLine: async () => undefined,
}));

const readiness: Readiness = { sleepQuality: "good", restingHrBpm: 58, painJoints: [] };

function planWithCooldown(): PlannedSession {
  const template = SESSION_TEMPLATES.find((item) => item.cooldownStationIds.length > 1)!;
  return planSession(readiness, templateToStarter(template), {});
}

function warmupState(planned: PlannedSession): ViewState {
  const state = initialState({ planned, onDone: () => undefined });
  state.phase = "warmup";
  state.warmupIndex = 0;
  state.log = createEmptyLog();
  state.pulse = { ...INITIAL_PULSE };
  return state;
}

/** The gap after warm-up station `index`: the timer has put the view into rest. */
function warmupGapState(planned: PlannedSession, index: number): ViewState {
  const state = warmupState(planned);
  state.warmupIndex = index;
  state.phase = "rest";
  state.restLeft = planned.warmup[index]!.gapSecondsAfter;
  return state;
}

function firstGapIndex(steps: readonly WarmupStep[]): number {
  return steps.findIndex((step) => step.gapSecondsAfter > 0);
}

describe("warm-up and cool-down stations can be swiped", () => {
  it("puts a warm-up station on a swipe stage with a hint", () => {
    const planned = planWithCooldown();
    const html = shellHtml(planned, warmupState(planned));
    expect(html).toContain(`data-swipe-stage="station"`);
    expect(html).toMatch(/swipe left/i);
  });

  it("puts a cool-down stretch on a swipe stage too", () => {
    const planned = planWithCooldown();
    const state = warmupState(planned);
    state.warmupIndex = planned.warmup.length;
    state.workIndex = planned.work.length;
    state.phase = "done";
    startCooldown(planned, state);
    expect(shellHtml(planned, state)).toContain(`data-swipe-stage="station"`);
  });
});

describe("the gap between warm-up stations", () => {
  it("is a swipeable rest that names the next station, not the first set", () => {
    const planned = planWithCooldown();
    const index = firstGapIndex(planned.warmup);
    expect(index).toBeGreaterThan(-1);
    const html = shellHtml(planned, warmupGapState(planned, index));
    const next = displayExerciseName(planned.warmup[index + 1]!.name);
    expect(html).toContain(`data-swipe-stage="rest"`);
    expect(html).toContain("data-rest-left");
    expect(html).toMatch(/<p class="eyebrow session-phase">Rest<\/p>/);
    expect(html).toContain(`next ${next}`);
    expect(html).toContain('class="rest-next-line"');
    expect(html).not.toContain("Get ready");
    expect(html).not.toContain("Next set reps");
  });

  it("does not set up the first work set while the warm-up is still running", () => {
    const planned = planWithCooldown();
    const state = warmupGapState(planned, firstGapIndex(planned.warmup));
    expect(needsWorkState(planned, state)).toBe(false);
  });

  it("sets up the work set once the warm-up is over", () => {
    const planned = planWithCooldown();
    const state = warmupState(planned);
    state.warmupIndex = planned.warmup.length;
    state.phase = "work";
    expect(needsWorkState(planned, state)).toBe(true);
    state.workState = { slotId: "x", exerciseId: "x", setIndex: 1, prescribedReps: 5, addedLoadKg: 0 };
    expect(needsWorkState(planned, state)).toBe(false);
  });
});

function step(partial: Partial<WarmupStep>): WarmupStep {
  return {
    stationId: "s",
    exerciseId: "s",
    name: "Station",
    region: "legs",
    holdSeconds: 30,
    gapSecondsAfter: 0,
    cues: [],
    ...partial,
  };
}

function nullRoot(): HTMLElement {
  return { querySelector: () => null } as unknown as HTMLElement;
}

describe("finishing a station early", () => {
  beforeEach(() => {
    vi.stubGlobal("window", globalThis);
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("moves straight on when the station has no gap, and stops its clock", () => {
    const onAdvance = vi.fn();
    const handle = startStationHold(nullRoot(), step({}), { phase: "warmup" } as ViewState, "warmup", {
      onAdvance,
      onPaint: vi.fn(),
      onRestGap: vi.fn(),
    });
    handle?.finish();
    expect(onAdvance).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000);
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it("starts the gap rest, as when the clock runs out", () => {
    const onRestGap = vi.fn();
    const state = { phase: "warmup", restLeft: 0 } as ViewState;
    const handle = startStationHold(nullRoot(), step({ gapSecondsAfter: 15 }), state, "warmup", {
      onAdvance: vi.fn(),
      onPaint: vi.fn(),
      onRestGap,
    });
    handle?.finish();
    expect(state.phase).toBe("rest");
    expect(state.restLeft).toBe(15);
    expect(onRestGap).toHaveBeenCalledTimes(1);
  });

  it("ignores a second finish", () => {
    const onAdvance = vi.fn();
    const handle = startStationHold(nullRoot(), step({}), { phase: "warmup" } as ViewState, "warmup", {
      onAdvance,
      onPaint: vi.fn(),
      onRestGap: vi.fn(),
    });
    handle?.finish();
    handle?.finish();
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });
});

describe("a pulse reading", () => {
  function pulseRoot(): {
    root: HTMLElement;
    chip: { textContent: string; zone: string | null };
    classes: Set<string>;
  } {
    const chip = {
      textContent: "",
      zone: null as string | null,
      setAttribute(name: string, value: string) {
        if (name === "data-hr-zone") {
          this.zone = value;
        }
      },
      removeAttribute(name: string) {
        if (name === "data-hr-zone") {
          this.zone = null;
        }
      },
    };
    const classes = new Set<string>(["pulse-lost"]);
    const bar = {
      classList: {
        toggle: (name: string, on: boolean) => (on ? classes.add(name) : classes.delete(name)),
      },
    };
    const root = {
      querySelector(selector: string) {
        if (selector === ".pulse-chip") {
          return chip;
        }
        return selector === ".session-bar" ? bar : null;
      },
    } as unknown as HTMLElement;
    return { root, chip, classes };
  }

  it("updates the chip in place instead of repainting the screen", () => {
    const { root, chip, classes } = pulseRoot();
    const state = { bpm: 72, pulse: { ...INITIAL_PULSE, connected: true } } as ViewState;
    paintPulseReading(root, state);
    expect(chip.textContent).toBe("Pulse 72");
    expect(classes.has("pulse-lost")).toBe(false);
  });
});
