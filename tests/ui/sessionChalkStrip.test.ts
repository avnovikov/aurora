import { describe, expect, it } from "vitest";
import type { PlannedSession, PlannedWorkItem } from "../../src/rules/planSession";
import type { WarmupStep } from "../../src/rules/warmupPlan";
import { createEmptyLog } from "../../src/session/setLog";
import {
  chalkNowLabel,
  chalkRailNotches,
  isWarmupSurface,
} from "../../src/ui/sessionChalkStrip";
import { INITIAL_PULSE } from "../../src/ui/pulseState";
import type { ViewState } from "../../src/ui/sessionTypes";

function workItem(
  partial: Pick<PlannedWorkItem, "slotId" | "label" | "exerciseId" | "exerciseName">,
): PlannedWorkItem {
  return {
    dose: { sets: 3, reps: 8, addedLoadKg: 0 },
    restSeconds: 90,
    ruleIds: [],
    reason: "test",
    cues: [],
    ...partial,
  };
}

function warmupStep(name: string, holdSeconds = 12): WarmupStep {
  return {
    stationId: name.toLowerCase().replace(/\s+/g, "_"),
    name,
    region: "hips",
    holdSeconds,
    gapSecondsAfter: 5,
    cues: [],
  };
}

function planned(work: PlannedWorkItem[], warmup: WarmupStep[] = []): PlannedSession {
  return {
    programId: "test",
    sessionLabel: "Test",
    readiness: "good",
    warmup,
    work,
    lightDay: false,
    deload: false,
  };
}

function state(partial: Partial<ViewState>): ViewState {
  return {
    phase: "work",
    warmupIndex: 0,
    workIndex: 0,
    cooldownIndex: 0,
    setIndex: 1,
    log: createEmptyLog(),
    workState: null,
    restLeft: 0,
    pulse: { ...INITIAL_PULSE },
    bpm: null,
    pulseStatus: null,
    startedAtMs: 0,
    plannedTotalSeconds: 1800,
    ...partial,
  };
}

describe("chalkNowLabel", () => {
  const items = [
    workItem({
      slotId: "a",
      label: "Squat",
      exerciseId: "squat",
      exerciseName: "Bodyweight squat",
    }),
    workItem({
      slotId: "b",
      label: "Pull",
      exerciseId: "pull",
      exerciseName: "Pull-up",
    }),
  ];

  it("shows position, current, and next during work", () => {
    const label = chalkNowLabel(
      planned(items),
      state({ phase: "work", workIndex: 0 }),
    );
    expect(label).toBe("1 of 2 · Squat · next Pull");
  });

  it("omits next on the last work slot", () => {
    const label = chalkNowLabel(
      planned(items),
      state({ phase: "work", workIndex: 1 }),
    );
    expect(label).toBe("2 of 2 · Pull");
  });

  it("names the active warmup station", () => {
    const label = chalkNowLabel(
      planned(items, [warmupStep("Hip circles")]),
      state({ phase: "warmup", warmupIndex: 0 }),
    );
    expect(label).toBe("Warmup · 17s · Hip circles · next Squat");
  });
});

describe("isWarmupSurface", () => {
  it("is true during warmup rest before work starts", () => {
    expect(
      isWarmupSurface(
        planned([], [warmupStep("Openers")]),
        state({ phase: "rest", workState: null, warmupIndex: 0 }),
      ),
    ).toBe(true);
  });

  it("is false once work rest begins", () => {
    expect(
      isWarmupSurface(
        planned(
          [
            workItem({
              slotId: "a",
              label: "Squat",
              exerciseId: "squat",
              exerciseName: "Squat",
            }),
          ],
          [warmupStep("Openers")],
        ),
        state({
          phase: "rest",
          workState: {
            slotId: "a",
            exerciseId: "squat",
            setIndex: 1,
            prescribedReps: 8,
            addedLoadKg: 0,
          },
          warmupIndex: 1,
        }),
      ),
    ).toBe(false);
  });
});

describe("chalkRailNotches", () => {
  it("marks warmup done and current work active", () => {
    const session = planned(
      [
        workItem({
          slotId: "a",
          label: "Squat",
          exerciseId: "squat",
          exerciseName: "Squat",
        }),
        workItem({
          slotId: "b",
          label: "Pull",
          exerciseId: "pull",
          exerciseName: "Pull",
        }),
      ],
      [warmupStep("Openers")],
    );
    const notches = chalkRailNotches(
      session,
      state({ phase: "work", workIndex: 0, warmupIndex: 1 }),
    );
    expect(notches.map((n) => n.className)).toEqual(["done", "active", ""]);
  });
});
