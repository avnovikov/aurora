import { describe, expect, it } from "vitest";
import { SESSION_TEMPLATES, templateToStarter } from "../../src/data/seed";
import type { Readiness } from "../../src/domain/types";
import { planSession, type PlannedSession } from "../../src/rules/planSession";
import { estimatePlannedSessionSeconds } from "../../src/rules/sessionDuration";
import {
  warmupViewSeconds,
  WARMUP_TRANSITION_REST_SECONDS,
} from "../../src/rules/warmupPlan";
import { shellHtml } from "../../src/ui/sessionChalk";
import { isWarmupSurface } from "../../src/ui/sessionChalkStrip";
import {
  enterWorkAfterWarmup,
  initialState,
  isGetReadyRest,
  persistPhase,
} from "../../src/ui/sessionState";
import type { ViewState } from "../../src/ui/sessionTypes";

const readiness: Readiness = { sleepQuality: "good", restingHrBpm: 58, painJoints: [] };

function plan(templateId: string): PlannedSession {
  const template = SESSION_TEMPLATES.find((item) => item.id === templateId)!;
  return planSession(readiness, templateToStarter(template), {});
}

function afterLastStation(planned: PlannedSession): ViewState {
  const state = initialState({ planned, onDone: () => undefined });
  state.warmupIndex = planned.warmup.length;
  return state;
}

describe("warm-up → work transition", () => {
  it("rests (Get ready) before the first set after a ramp", () => {
    const planned = plan("tmpl_legs");
    const state = afterLastStation(planned);
    expect(enterWorkAfterWarmup(planned, state)).toBe(WARMUP_TRANSITION_REST_SECONDS);
    expect(state.phase).toBe("rest");
    expect(state.restLeft).toBe(WARMUP_TRANSITION_REST_SECONDS);
    expect(state.workState?.exerciseId).toBe(planned.work[0]?.exerciseId);
    expect(isGetReadyRest(state)).toBe(true);
    expect(isWarmupSurface(planned, state)).toBe(false);
    expect(persistPhase(planned, state)).toBe("work");
    expect(shellHtml(planned, state)).toContain("Get ready · next");
  });

  it("goes straight to work after a warm-up with no ramp (Mobility)", () => {
    const planned = plan("tmpl_mobility");
    const state = afterLastStation(planned);
    expect(enterWorkAfterWarmup(planned, state)).toBe(0);
    expect(state.phase).toBe("work");
    expect(isGetReadyRest(state)).toBe(false);
  });

  it("keeps the normal rest label between sets", () => {
    const planned = plan("tmpl_legs");
    const state = afterLastStation(planned);
    enterWorkAfterWarmup(planned, state);
    state.setIndex = 2;
    expect(isGetReadyRest(state)).toBe(false);
    expect(shellHtml(planned, state)).toContain("Rest · next");
  });

  it("counts the Get ready rest in the planned session estimate", () => {
    const legs = plan("tmpl_legs");
    const mobility = plan("tmpl_mobility");
    const workOnly = (planned: PlannedSession) =>
      estimatePlannedSessionSeconds(planned) - warmupViewSeconds(planned.warmup);
    const legsNoRest = estimatePlannedSessionSeconds({ ...legs, warmup: [] });
    expect(workOnly(legs)).toBe(legsNoRest + WARMUP_TRANSITION_REST_SECONDS);
    expect(workOnly(mobility)).toBe(estimatePlannedSessionSeconds({ ...mobility, warmup: [] }));
  });
});
