import { describe, expect, it } from "vitest";
import { EXERCISE_GRAPH } from "../../src/data/exerciseGraph";
import { resolveExerciseTiming } from "../../src/domain/timing";
import type { PlannedSession, PlannedWorkItem } from "../../src/rules/planSession";
import { estimatePlannedSessionSeconds } from "../../src/rules/sessionDuration";
import {
  estimateRemainingSessionSeconds,
  type SessionProgress,
} from "../../src/rules/sessionRemaining";
import type { WarmupStep } from "../../src/rules/warmupPlan";
import { warmupTransitionSeconds, warmupViewSeconds } from "../../src/rules/warmupPlan";

function step(partial: Partial<WarmupStep> & Pick<WarmupStep, "stationId" | "holdSeconds">): WarmupStep {
  return {
    name: partial.stationId,
    region: "hips",
    gapSecondsAfter: 0,
    cues: [],
    ...partial,
  };
}

function workItem(partial: Partial<PlannedWorkItem> = {}): PlannedWorkItem {
  return {
    slotId: "slot_a",
    label: "Pull-up",
    exerciseId: "pullup",
    exerciseName: "Pull-up",
    dose: { sets: 3, reps: 8, targetRir: 2, addedLoadKg: 0 },
    restSeconds: 120,
    ruleIds: [],
    reason: "test",
    cues: [],
    cautions: [],
    ...partial,
  };
}

function planned(partial: Partial<PlannedSession> = {}): PlannedSession {
  return {
    programId: "test",
    sessionLabel: "Test",
    readiness: {
      sleepQuality: "good",
      restingHrBpm: 58,
      painJoints: [],
    },
    warmup: [
      step({ stationId: "raise", holdSeconds: 10, gapSecondsAfter: 5 }),
      step({ stationId: "ramp", holdSeconds: 20, gapSecondsAfter: 0, phase: "potentiate" }),
    ],
    work: [workItem()],
    lightDay: false,
    deload: false,
    ...partial,
  };
}

function progress(partial: Partial<SessionProgress>): SessionProgress {
  return {
    surface: "warmup",
    phase: "warmup",
    warmupIndex: 0,
    workIndex: 0,
    setIndex: 1,
    restLeft: 0,
    holdLeft: 0,
    sideSwitchLeft: 0,
    ...partial,
  };
}

/** Work + rests only (planned total minus warm-up stations and get-ready rest). */
function workSecondsOf(session: PlannedSession): number {
  return (
    estimatePlannedSessionSeconds(session) -
    warmupViewSeconds(session.warmup) -
    warmupTransitionSeconds(session.warmup)
  );
}

describe("estimateRemainingSessionSeconds", () => {
  it("matches the full plan at the start of the first hold", () => {
    const session = planned();
    const first = session.warmup[0]!;
    const remaining = estimateRemainingSessionSeconds(
      session,
      progress({ holdLeft: first.holdSeconds }),
    );
    expect(remaining).toBe(estimatePlannedSessionSeconds(session));
  });

  it("drops finished stations even when wall-clock is still early", () => {
    const session = planned();
    const second = session.warmup[1]!;
    const remaining = estimateRemainingSessionSeconds(
      session,
      progress({
        warmupIndex: 1,
        holdLeft: second.holdSeconds,
      }),
    );
    const laterWarmup =
      warmupViewSeconds(session.warmup.slice(1)) +
      warmupTransitionSeconds(session.warmup);
    expect(remaining).toBe(laterWarmup + workSecondsOf(session));
    expect(remaining).toBeLessThan(estimatePlannedSessionSeconds(session));
  });

  it("uses restLeft for the current gap, not the full planned gap", () => {
    const session = planned();
    const remaining = estimateRemainingSessionSeconds(
      session,
      progress({
        phase: "rest",
        warmupIndex: 0,
        restLeft: 2,
      }),
    );
    const afterGap =
      warmupViewSeconds(session.warmup.slice(1)) +
      warmupTransitionSeconds(session.warmup);
    expect(remaining).toBe(2 + afterGap + workSecondsOf(session));
  });

  it("counts only unfinished work sets from the current setIndex", () => {
    const session = planned({
      warmup: [step({ stationId: "only", holdSeconds: 10, gapSecondsAfter: 0 })],
    });
    const pullup = EXERCISE_GRAPH.pullup!;
    const unit = 8 * resolveExerciseTiming(pullup).secondsPerRep;
    const remaining = estimateRemainingSessionSeconds(
      session,
      progress({
        surface: "work",
        phase: "work",
        warmupIndex: session.warmup.length,
        setIndex: 2,
      }),
    );
    expect(remaining).toBe(2 * unit + 120);
  });

  it("adds restLeft during an inter-set rest before the next set's work", () => {
    const session = planned({
      warmup: [step({ stationId: "only", holdSeconds: 10, gapSecondsAfter: 0 })],
    });
    const pullup = EXERCISE_GRAPH.pullup!;
    const unit = 8 * resolveExerciseTiming(pullup).secondsPerRep;
    const remaining = estimateRemainingSessionSeconds(
      session,
      progress({
        surface: "work",
        phase: "rest",
        warmupIndex: session.warmup.length,
        setIndex: 2,
        restLeft: 40,
      }),
    );
    expect(remaining).toBe(40 + 2 * unit + 120);
  });

  it("returns 0 once the session is done (cool-down is not in the estimate)", () => {
    const session = planned();
    expect(
      estimateRemainingSessionSeconds(
        session,
        progress({ surface: "done", phase: "done", warmupIndex: session.warmup.length }),
      ),
    ).toBe(0);
    expect(
      estimateRemainingSessionSeconds(
        session,
        progress({ surface: "cooldown", phase: "cooldown", warmupIndex: session.warmup.length }),
      ),
    ).toBe(0);
  });
});
