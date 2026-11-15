import { describe, expect, it, vi } from "vitest";
import { SESSION_TEMPLATES, templateToStarter } from "../../src/data/seed";
import type { Readiness } from "../../src/domain/types";
import { planSession, type PlannedSession } from "../../src/rules/planSession";
import { createEmptyLog, editNextReps, DEFAULT_ADDED_LOAD_KG } from "../../src/session/setLog";
import { shellHtml } from "../../src/ui/sessionChalk";
import {
  completeSet,
  type SessionControlHandlers,
} from "../../src/ui/sessionControls";
import { INITIAL_PULSE } from "../../src/ui/pulseState";
import { initialState } from "../../src/ui/sessionState";
import type { ViewState } from "../../src/ui/sessionTypes";
import { useMemoryStorage } from "../helpers/storage";

useMemoryStorage();

const readiness: Readiness = { sleepQuality: "good", restingHrBpm: 58, painJoints: [] };

function planLegs(): PlannedSession {
  const template = SESSION_TEMPLATES.find((item) => item.id === "tmpl_legs")!;
  return planSession(readiness, templateToStarter(template), {});
}

function workState(planned: PlannedSession): ViewState {
  const state = initialState({ planned, onDone: () => undefined });
  state.phase = "work";
  state.warmupIndex = planned.warmup.length;
  state.workIndex = 0;
  state.setIndex = 1;
  state.workState = {
    slotId: planned.work[0]!.slotId,
    exerciseId: planned.work[0]!.exerciseId,
    setIndex: 1,
    prescribedReps: planned.work[0]!.dose.reps,
    addedLoadKg: 0,
  };
  state.log = createEmptyLog();
  state.pulse = { ...INITIAL_PULSE };
  return state;
}

function handlers(state: ViewState): SessionControlHandlers {
  return {
    onPaint: vi.fn(),
    onStartRest: vi.fn((_voice, onDone) => onDone()),
    onLeaveRest: vi.fn(() => {
      state.restLeft = 0;
      state.phase = "work";
    }),
    onFinishExercise: vi.fn(),
    onFinishAll: vi.fn(),
    onStartCooldown: vi.fn(),
    onSkipCooldown: vi.fn(),
    onPulseLostSim: vi.fn(),
    onPulseBpm: vi.fn(),
    onPulseDisconnected: vi.fn(),
  };
}

describe("work screen log-set edit markup", () => {
  it("shows reps steppers and optional add-weight on work", () => {
    const planned = planLegs();
    const state = workState(planned);
    const html = shellHtml(planned, state);
    expect(html).toContain("data-reps-minus");
    expect(html).toContain("data-reps-plus");
    expect(html).toContain("data-add-weight");
    expect(html).not.toContain("data-load-minus");
  });

  it("shows load steppers once weight is on", () => {
    const planned = planLegs();
    const state = workState(planned);
    state.workState = { ...state.workState!, addedLoadKg: DEFAULT_ADDED_LOAD_KG };
    const html = shellHtml(planned, state);
    expect(html).toContain("data-load-minus");
    expect(html).toContain("data-load-plus");
    expect(html).toContain(`${DEFAULT_ADDED_LOAD_KG}`);
    expect(html).not.toContain("data-add-weight");
  });
});

describe("completeSet sticky reps", () => {
  it("logs edited reps and sticks them for the next set without weight", () => {
    const planned = planLegs();
    const item = planned.work[0]!;
    expect(item.dose.sets).toBeGreaterThan(1);
    const state = workState(planned);
    state.workState = editNextReps(state.workState!, item.dose.reps - 2);
    state.workState = { ...state.workState, addedLoadKg: DEFAULT_ADDED_LOAD_KG };
    const loggedReps = item.dose.reps - 2;
    const h = handlers(state);

    completeSet(planned, state, "completed", h);

    expect(state.log.entries).toHaveLength(1);
    expect(state.log.entries[0]?.completedReps).toBe(loggedReps);
    expect(state.log.entries[0]?.addedLoadKg).toBe(DEFAULT_ADDED_LOAD_KG);
    expect(state.setIndex).toBe(2);
    expect(state.phase).toBe("work");
    expect(state.workState?.prescribedReps).toBe(loggedReps);
    expect(state.workState?.nextRepsOverride).toBe(loggedReps);
    expect(state.workState?.addedLoadKg).toBe(0);
    expect(h.onFinishExercise).not.toHaveBeenCalled();
  });

  it("on skip finishes the exercise without writing sticky from zero", () => {
    const planned = planLegs();
    const state = workState(planned);
    const before = state.workState!.prescribedReps;
    const h = handlers(state);

    completeSet(planned, state, "skipped", h);

    expect(state.log.entries[0]?.completedReps).toBe(0);
    expect(h.onFinishExercise).toHaveBeenCalled();
    expect(state.workState?.prescribedReps).toBe(before);
  });
});
