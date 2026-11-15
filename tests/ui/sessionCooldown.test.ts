import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_TEMPLATES, templateToStarter } from "../../src/data/seed";
import type { Readiness } from "../../src/domain/types";
import { planSession, type PlannedSession } from "../../src/rules/planSession";
import { loadSession, saveSession } from "../../src/session/storage";
import { chalkNowLabel, isCooldownSurface } from "../../src/ui/sessionChalkStrip";
import {
  advanceCooldown,
  cooldownSteps,
  enterDone,
  initialState,
  persistPhase,
  startCooldown,
} from "../../src/ui/sessionState";
import type { ViewState } from "../../src/ui/sessionTypes";

const readiness: Readiness = { sleepQuality: "good", restingHrBpm: 58, painJoints: [] };

function plan(templateId: string): PlannedSession {
  const template = SESSION_TEMPLATES.find((item) => item.id === templateId)!;
  return planSession(readiness, templateToStarter(template), {});
}

function afterLastWork(planned: PlannedSession): ViewState {
  const state = initialState({ planned, onDone: () => undefined });
  state.phase = "work";
  state.warmupIndex = planned.warmup.length;
  state.workIndex = planned.work.length;
  return state;
}

describe("cool-down phase", () => {
  it("plans the template's cool-down after the work", () => {
    const legs = plan("tmpl_legs");
    expect(cooldownSteps(legs).map((step) => step.stationId)).toEqual(
      SESSION_TEMPLATES.find((item) => item.id === "tmpl_legs")!.cooldownStationIds,
    );
    expect(cooldownSteps(legs).every((step) => step.source)).toBe(true);
    expect(cooldownSteps(plan("tmpl_mobility"))).toEqual([]);
  });

  it("offers the cool-down on the done screen after the last work item", () => {
    const planned = plan("tmpl_legs");
    const state = afterLastWork(planned);
    expect(enterDone(planned, state)).toBe("offer");
    expect(state.phase).toBe("done");
    expect(chalkNowLabel(planned, state)).toBe("Session done");
  });

  it("finishes straight away when the template has no cool-down", () => {
    const planned = plan("tmpl_mobility");
    const state = afterLastWork(planned);
    expect(enterDone(planned, state)).toBe("finish");
  });

  it("starts the cool-down, runs each stretch, then finishes", () => {
    const planned = plan("tmpl_abs");
    const state = afterLastWork(planned);
    enterDone(planned, state);
    startCooldown(planned, state);
    expect(state.phase).toBe("cooldown");
    expect(state.cooldownIndex).toBe(0);
    expect(isCooldownSurface(planned, state)).toBe(true);
    expect(chalkNowLabel(planned, state)).toContain("Cool-down");

    // Gap between stretches is a rest that still belongs to the cool-down.
    state.phase = "rest";
    expect(isCooldownSurface(planned, state)).toBe(true);
    expect(persistPhase(planned, state)).toBe("cooldown");

    const steps = cooldownSteps(planned).length;
    for (let index = 1; index < steps; index += 1) {
      expect(advanceCooldown(planned, state)).toBe("next");
      expect(state.phase).toBe("cooldown");
    }
    expect(advanceCooldown(planned, state)).toBe("finish");
  });

  it("can only start from the done screen", () => {
    const planned = plan("tmpl_legs");
    const state = afterLastWork(planned);
    expect(() => startCooldown(planned, state)).toThrow();
    const mobility = plan("tmpl_mobility");
    const mobilityState = afterLastWork(mobility);
    mobilityState.phase = "done";
    expect(() => startCooldown(mobility, mobilityState)).toThrow();
  });

  it("persists the done and cooldown phases", () => {
    const planned = plan("tmpl_legs");
    const state = afterLastWork(planned);
    enterDone(planned, state);
    expect(persistPhase(planned, state)).toBe("done");
    startCooldown(planned, state);
    expect(persistPhase(planned, state)).toBe("cooldown");
  });
});

describe("cool-down resume", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function save(planned: PlannedSession, phase: "cooldown" | "done", cooldownIndex?: number): void {
    saveSession({
      readiness,
      planned,
      log: { entries: [] },
      phase,
      warmupIndex: planned.warmup.length,
      workIndex: planned.work.length,
      setIndex: 1,
      cooldownIndex,
      savedAt: new Date().toISOString(),
    });
  }

  it("resumes mid cool-down at the saved stretch", () => {
    const planned = plan("tmpl_skill_hs");
    save(planned, "cooldown", 2);
    const resume = loadSession()!;
    const state = initialState({ planned: resume.planned, resume, onDone: () => undefined });
    expect(state.phase).toBe("cooldown");
    expect(state.cooldownIndex).toBe(2);
    expect(state.workState).toBeNull();
  });

  it("resumes on the done screen with the cool-down still on offer", () => {
    const planned = plan("tmpl_bars");
    save(planned, "done");
    const resume = loadSession()!;
    const state = initialState({ planned: resume.planned, resume, onDone: () => undefined });
    expect(state.phase).toBe("done");
    expect(state.cooldownIndex).toBe(0);
    startCooldown(resume.planned, state);
    expect(state.phase).toBe("cooldown");
  });

  it("treats a session saved before the cool-down existed as having none", () => {
    const planned = plan("tmpl_legs");
    const legacy: PlannedSession = { ...planned };
    delete legacy.cooldown;
    save(legacy, "done");
    const resume = loadSession()!;
    expect(resume.cooldownIndex).toBeUndefined();
    expect(cooldownSteps(resume.planned)).toEqual([]);
    const state = initialState({ planned: resume.planned, resume, onDone: () => undefined });
    expect(state.cooldownIndex).toBe(0);
  });

  it("rejects a negative cool-down index", () => {
    const planned = plan("tmpl_legs");
    expect(() => save(planned, "cooldown", -1)).toThrow();
  });
});
