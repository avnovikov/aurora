import { describe, expect, it } from "vitest";
import type { Readiness } from "../../src/domain/types";
import { lightenPlannedSession } from "../../src/rules/lightenPlannedSession";
import type { PlannedSession, PlannedWorkItem } from "../../src/rules/planSession";

const readiness: Readiness = { painJoints: [], sleepQuality: "good" };

function work(over: Partial<PlannedWorkItem> = {}): PlannedWorkItem {
  return {
    slotId: "s1",
    exerciseId: "squat",
    name: "Squat",
    dose: { sets: 5, reps: 8, targetRir: 2, addedLoadKg: 0 },
    restSeconds: 90,
    ruleIds: ["hold"],
    reason: "Hold",
    ...over,
  };
}

function planned(over: Partial<PlannedSession> = {}): PlannedSession {
  return {
    programId: "tmpl",
    sessionLabel: "Legs",
    readiness,
    warmup: [],
    work: [work()],
    lightDay: false,
    deload: false,
    ...over,
  };
}

describe("lightenPlannedSession", () => {
  it("applies light-day dose and marks the session", () => {
    const next = lightenPlannedSession(planned());
    expect(next.lightDay).toBe(true);
    expect(next.work[0]!.dose.sets).toBe(3);
    expect(next.work[0]!.dose.targetRir).toBe(3);
    expect(next.work[0]!.ruleIds).toContain("light_day");
    expect(next.work[0]!.reason).toContain("light day after warmup pulse");
  });

  it("appends reason from ruleIds, not a fragile 'light' substring", () => {
    const next = lightenPlannedSession(
      planned({ work: [work({ reason: "Hold the light" })] }),
    );
    expect(next.work[0]!.reason).toBe("Hold the light; light day after warmup pulse");
  });

  it("is a no-op when already light", () => {
    const already = planned({ lightDay: true, work: [work({ dose: { sets: 2, reps: 8, targetRir: 3, addedLoadKg: 0 } })] });
    expect(lightenPlannedSession(already)).toBe(already);
  });
});
