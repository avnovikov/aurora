import { describe, expect, it } from "vitest";
import type { PlannedSession, PlannedWorkItem } from "../../src/rules/planSession";
import type { WarmupStep } from "../../src/rules/warmupPlan";
import { createEmptyLog } from "../../src/session/setLog";
import { shellHtml } from "../../src/ui/sessionChalk";
import { INITIAL_PULSE } from "../../src/ui/pulseState";
import type { ViewState } from "../../src/ui/sessionTypes";

function workItem(
  partial: Pick<PlannedWorkItem, "slotId" | "label" | "exerciseId" | "exerciseName"> & {
    sets?: number;
  },
): PlannedWorkItem {
  const { sets = 3, ...rest } = partial;
  return {
    dose: { sets, reps: 8, addedLoadKg: 0 },
    restSeconds: 90,
    ruleIds: [],
    reason: "test",
    cues: [],
    ...rest,
  };
}

function step(partial: Partial<WarmupStep> & Pick<WarmupStep, "stationId" | "name">): WarmupStep {
  return {
    exerciseId: partial.exerciseId ?? partial.stationId,
    region: "core",
    holdSeconds: 15,
    gapSecondsAfter: 5,
    cues: [],
    ...partial,
  };
}

function planned(warmup: WarmupStep[], work: PlannedWorkItem[] = []): PlannedSession {
  return {
    programId: "test",
    sessionLabel: "Test",
    readiness: "good",
    warmup,
    work:
      work.length > 0
        ? work
        : [
            workItem({
              slotId: "a",
              label: "Push",
              exerciseId: "push_up",
              exerciseName: "Push-up",
            }),
          ],
    lightDay: false,
    deload: false,
  };
}

function state(partial: Partial<ViewState>): ViewState {
  return {
    phase: "warmup",
    warmupIndex: 0,
    workIndex: 0,
    cooldownIndex: 0,
    setIndex: 1,
    log: createEmptyLog(),
    workState: null,
    restLeft: 0,
    holdLeft: 0,
    sideSwitchLeft: 0,
    pulse: { ...INITIAL_PULSE },
    bpm: null,
    pulseStatus: null,
    startedAtMs: 0,
    plannedTotalSeconds: 1800,
    addWeightKg: 0,
    ...partial,
  };
}

describe("session chalk set line", () => {
  it("shows Warmup → Set X of Y → name for a multi-round station", () => {
    const warmup = [
      step({ stationId: "hollow", name: "Hollow hold" }),
      step({ stationId: "hollow", name: "Hollow hold" }),
    ];
    const html = shellHtml(planned(warmup), state({ phase: "warmup", warmupIndex: 1 }));
    expect(html).toMatch(/<p class="eyebrow session-phase">Warmup<\/p>/);
    expect(html).toMatch(/<p class="eyebrow session-set">Set 2 of 2<\/p>/);
    expect(html).toContain("Hollow hold");
    expect(html.indexOf("session-phase")).toBeLessThan(html.indexOf("session-set"));
    expect(html.indexOf("session-set")).toBeLessThan(html.indexOf("session-move"));
  });

  it("omits the set line for a single warmup station", () => {
    const warmup = [step({ stationId: "march", name: "March in place" })];
    const html = shellHtml(planned(warmup), state({ phase: "warmup", warmupIndex: 0 }));
    expect(html).toMatch(/<p class="eyebrow session-phase">Warmup<\/p>/);
    expect(html).not.toContain("session-set");
    expect(html).not.toContain("Set 1 of 1");
  });

  it("shows work Set X of Y on the shared set line, not as the phase eyebrow", () => {
    const session = planned([], [
      workItem({
        slotId: "a",
        label: "Push",
        exerciseId: "push_up",
        exerciseName: "Push-up",
        sets: 3,
      }),
    ]);
    const html = shellHtml(
      session,
      state({
        phase: "work",
        warmupIndex: session.warmup.length,
        setIndex: 2,
        workState: {
          slotId: "a",
          exerciseId: "push_up",
          setIndex: 2,
          prescribedReps: 8,
          addedLoadKg: 0,
        },
      }),
    );
    expect(html).toMatch(/<p class="eyebrow session-set">Set 2 of 3<\/p>/);
    expect(html).not.toMatch(/session-phase">Set /);
    expect(html).not.toMatch(/session-phase">Work/);
  });
});
