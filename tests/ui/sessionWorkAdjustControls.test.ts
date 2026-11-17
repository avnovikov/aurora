/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_PLAN_QUEUE, SESSION_TEMPLATES, templateToStarter } from "../../src/data/seed";
import type { Readiness } from "../../src/domain/types";
import { planSession, type PlannedSession } from "../../src/rules/planSession";
import { createEmptyLog } from "../../src/session/setLog";
import { shellHtml, type WorkAdjustUi } from "../../src/ui/sessionChalk";
import {
  wireSessionControls,
  type SessionControlHandlers,
} from "../../src/ui/sessionControls";
import { INITIAL_PULSE } from "../../src/ui/pulseState";
import { initialState } from "../../src/ui/sessionState";
import type { ViewState } from "../../src/ui/sessionTypes";
import { useMemoryStorage } from "../helpers/storage";

useMemoryStorage(() => ({ "aurora.poc.planQueue.v1": JSON.stringify(DEFAULT_PLAN_QUEUE) }));

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

function handlers(over: Partial<SessionControlHandlers> = {}): SessionControlHandlers {
  return {
    onPaint: vi.fn(),
    onStartRest: vi.fn(),
    onFinishExercise: vi.fn(),
    onSkipRest: vi.fn(),
    onFinishStation: vi.fn(),
    onWarmupNotForMe: vi.fn(),
    onWorkSwap: vi.fn(),
    onWorkEasier: vi.fn(),
    onWorkSkipToday: vi.fn(),
    onWorkNever: vi.fn(),
    onWorkSwapPick: vi.fn(),
    onWorkUndo: vi.fn(),
    onWorkSetEnding: vi.fn(),
    onSlowSetArmed: vi.fn(),
    onFinishAll: vi.fn(),
    onStartCooldown: vi.fn(),
    onSkipCooldown: vi.fn(),
    onPulseLostSim: vi.fn(),
    onPulseBpm: vi.fn(),
    onPulseDisconnected: vi.fn(),
    ...over,
  };
}

function mount(planned: PlannedSession, adjust: WorkAdjustUi, h: SessionControlHandlers): HTMLElement {
  const state = workState(planned);
  const root = document.createElement("div");
  root.innerHTML = shellHtml(planned, state, adjust);
  wireSessionControls(root, planned, state, h);
  return root;
}

describe("work adjust controls", () => {
  it("Skip today finishes the exercise", () => {
    const planned = planLegs();
    const h = handlers();
    const root = mount(planned, { easierAvailable: true, swapOpen: false, swapOptions: [] }, h);
    root.querySelector<HTMLElement>("[data-work-skip-today]")!.click();
    expect(h.onWorkSkipToday).toHaveBeenCalledOnce();
  });

  it("ignores disabled Easier", () => {
    const planned = planLegs();
    const h = handlers();
    const root = mount(planned, { easierAvailable: false, swapOpen: false, swapOptions: [] }, h);
    root.querySelector<HTMLElement>("[data-work-easier]")!.click();
    expect(h.onWorkEasier).not.toHaveBeenCalled();
  });

  it("Swap pick forwards the exercise id", () => {
    const planned = planLegs();
    const h = handlers();
    const root = mount(
      planned,
      {
        easierAvailable: true,
        swapOpen: true,
        swapOptions: [{ id: "bodyweight_squat", name: "Bodyweight squat" }],
      },
      h,
    );
    root.querySelector<HTMLElement>('[data-work-swap-pick="bodyweight_squat"]')!.click();
    expect(h.onWorkSwapPick).toHaveBeenCalledWith("bodyweight_squat");
  });

  it("Never again calls its handler", () => {
    const planned = planLegs();
    const h = handlers();
    const root = mount(planned, { easierAvailable: true, swapOpen: false, swapOptions: [] }, h);
    root.querySelector<HTMLElement>("[data-work-never]")!.click();
    expect(h.onWorkNever).toHaveBeenCalledOnce();
  });

  it("Undo calls its handler", () => {
    const planned = planLegs();
    const h = handlers();
    const root = mount(
      planned,
      {
        easierAvailable: true,
        swapOpen: false,
        swapOptions: [],
        status: "Excluded: Nordic curl. Now: Hip hinge.",
        showUndo: true,
      },
      h,
    );
    root.querySelector<HTMLElement>("[data-work-undo]")!.click();
    expect(h.onWorkUndo).toHaveBeenCalledOnce();
  });
});
