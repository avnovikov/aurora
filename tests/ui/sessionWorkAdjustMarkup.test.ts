import { describe, expect, it } from "vitest";
import { SESSION_TEMPLATES, templateToStarter } from "../../src/data/seed";
import type { Readiness } from "../../src/domain/types";
import { planSession, type PlannedSession } from "../../src/rules/planSession";
import { createEmptyLog } from "../../src/session/setLog";
import { shellHtml, type WorkAdjustUi } from "../../src/ui/sessionChalk";
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

const adjust: WorkAdjustUi = {
  easierAvailable: true,
  swapOpen: false,
  swapOptions: [],
};

describe("work adjust toolbar markup", () => {
  it("shows Swap, Easier, Skip today, Never again after the read section", () => {
    const planned = planLegs();
    const html = shellHtml(planned, workState(planned), adjust);
    expect(html).toContain("data-work-swap");
    expect(html).toContain("data-work-easier");
    expect(html).toContain("data-work-skip-today");
    expect(html).toContain("data-work-never");
    expect(html.indexOf("session-move")).toBeLessThan(html.indexOf("data-work-swap"));
    expect(html.indexOf("session-read")).toBeLessThan(html.indexOf("data-work-swap"));
  });

  it("puts Easier in the sticky bar before Couldn't finish and Skip set", () => {
    const planned = planLegs();
    const html = shellHtml(planned, workState(planned), adjust);
    const bar = html.slice(html.indexOf('<footer class="session-bar'));
    const easier = bar.indexOf("data-work-easier");
    const fail = bar.indexOf("data-fail-set");
    const skip = bar.indexOf("data-skip");
    expect(easier).toBeGreaterThan(-1);
    expect(easier).toBeLessThan(fail);
    expect(fail).toBeLessThan(skip);
    expect(bar).not.toContain("data-work-swap");
  });

  it("disables Easier when unavailable", () => {
    const planned = planLegs();
    const html = shellHtml(planned, workState(planned), { ...adjust, easierAvailable: false });
    expect(html).toMatch(/data-work-easier[^>]*aria-disabled="true"/);
    expect(html).toContain('id="work-no-easier"');
    expect(html).toContain('id="work-bar-no-easier"');
  });

  it("lists swap picks when open", () => {
    const planned = planLegs();
    const html = shellHtml(planned, workState(planned), {
      ...adjust,
      swapOpen: true,
      swapOptions: [{ id: "bodyweight_squat", name: "Bodyweight squat" }],
    });
    expect(html).toContain('data-work-swap-pick="bodyweight_squat"');
  });

  it("omits the toolbar on warmup", () => {
    const planned = planLegs();
    const state = workState(planned);
    state.phase = "warmup";
    state.warmupIndex = 0;
    const html = shellHtml(planned, state, adjust);
    expect(html).not.toContain("data-work-swap");
  });

  it("keeps Undo reachable off the work stage after Never again", () => {
    const planned = planLegs();
    const state = workState(planned);
    state.phase = "done";
    const html = shellHtml(planned, state, {
      easierAvailable: false,
      swapOpen: false,
      swapOptions: [],
      status: "Excluded: Nordic curl. No substitute fits.",
      showUndo: true,
    });
    expect(html).toContain("data-work-undo");
    expect(html).toContain("data-work-adjust-status");
    expect(html).not.toContain("data-work-swap");
  });

  it("dims disabled Easier", () => {
    const planned = planLegs();
    const html = shellHtml(planned, workState(planned), { ...adjust, easierAvailable: false });
    expect(html).toMatch(/data-work-easier[^>]*aria-disabled="true"/);
  });
});
