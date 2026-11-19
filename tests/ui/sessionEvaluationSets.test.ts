import { describe, expect, it } from "vitest";
import { commitSessionEvaluation } from "../../src/ui/sessionEvaluation";
import { appendSet, createEmptyLog } from "../../src/session/setLog";
import type { PlannedSession } from "../../src/rules/planSession";
import type { HistoryPulse } from "../../src/pulse/pulseSessionBuffer";

function plannedStub(): PlannedSession {
  return {
    programId: "tmpl_test",
    sessionLabel: "Test",
    lightDay: false,
    warmup: [],
    work: [
      {
        slotId: "s1",
        exerciseId: "bodyweight_squat",
        dose: { sets: 3, reps: 8, targetRir: 2, addedLoadKg: 0 },
        ruleIds: [],
      },
    ],
    cooldown: [],
  } as PlannedSession;
}

describe("commitSessionEvaluation sets", () => {
  it("stores set log rows on the history payload", () => {
    let log = createEmptyLog();
    log = appendSet(log, {
      slotId: "s1",
      exerciseId: "bodyweight_squat",
      setIndex: 1,
      prescribedReps: 8,
      completedReps: 8,
      addedLoadKg: 0,
      stopReason: "completed",
      loggedAt: "2026-11-17T08:00:00.000Z",
    });
    const result = commitSessionEvaluation({
      evaluation: "on_target",
      planned: plannedStub(),
      log,
      memories: {},
    });
    expect(result.history.sets).toHaveLength(1);
    expect(result.history.sets?.[0]).toMatchObject({
      exerciseId: "bodyweight_squat",
      setIndex: 1,
      completedReps: 8,
      prescribedReps: 8,
      loggedAt: "2026-11-17T08:00:00.000Z",
      stopReason: "completed",
    });
    expect(result.history.pulse).toBeUndefined();
  });

  it("copies set averageBpm onto history set rows", () => {
    let log = createEmptyLog();
    log = appendSet(log, {
      slotId: "s1",
      exerciseId: "bodyweight_squat",
      setIndex: 1,
      prescribedReps: 8,
      completedReps: 8,
      addedLoadKg: 0,
      stopReason: "completed",
      averageBpm: 142,
      loggedAt: "2026-11-17T08:00:00.000Z",
    });
    const result = commitSessionEvaluation({
      evaluation: "on_target",
      planned: plannedStub(),
      log,
      memories: {},
    });
    expect(result.history.sets?.[0]?.averageBpm).toBe(142);
  });

  it("attaches HistoryPulse when provided", () => {
    const pulse: HistoryPulse = {
      series: [{ t: 1_000, bpm: 120 }],
      byExercise: [{ exerciseId: "bodyweight_squat", averageBpm: 120, sampleCount: 1 }],
    };
    const result = commitSessionEvaluation({
      evaluation: "on_target",
      planned: plannedStub(),
      log: createEmptyLog(),
      memories: {},
      pulse,
    });
    expect(result.history.pulse).toEqual(pulse);
  });

  it("omits pulse when not provided", () => {
    const result = commitSessionEvaluation({
      evaluation: "on_target",
      planned: plannedStub(),
      log: createEmptyLog(),
      memories: {},
    });
    expect(result.history).not.toHaveProperty("pulse");
  });
});
