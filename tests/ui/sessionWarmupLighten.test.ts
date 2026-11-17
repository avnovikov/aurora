import { describe, expect, it } from "vitest";
import type { Readiness } from "../../src/domain/types";
import { loadLightenExamples } from "../../src/pulse/lightenLearning";
import type { PlannedSession, PlannedWorkItem } from "../../src/rules/planSession";
import { resolveWarmupLightenChoice } from "../../src/ui/sessionWarmupLighten";
import { useMemoryStorage } from "../helpers/storage";

useMemoryStorage();

const readiness: Readiness = { painJoints: [], sleepQuality: "good" };

function planned(): PlannedSession {
  const item: PlannedWorkItem = {
    slotId: "s1",
    exerciseId: "squat",
    name: "Squat",
    dose: { sets: 5, reps: 8, targetRir: 2, addedLoadKg: 0 },
    restSeconds: 90,
    ruleIds: ["hold"],
    reason: "Hold",
  };
  return {
    programId: "tmpl",
    sessionLabel: "Legs",
    readiness,
    warmup: [],
    work: [item],
    lightDay: false,
    deload: false,
  };
}

describe("resolveWarmupLightenChoice", () => {
  it("rewrites dose when accepted and records the decision", () => {
    const next = resolveWarmupLightenChoice({
      planned: planned(),
      pending: { features: { sleep: 0, pain: 0, hr: 2 }, preferLight: true },
      acceptedLight: true,
      sessionStartedAtMs: 42,
    });
    expect(next.lightDay).toBe(true);
    expect(next.work[0]!.dose.sets).toBe(3);
    expect(loadLightenExamples()).toHaveLength(1);
  });

  it("keeps the plan when declined", () => {
    const original = planned();
    const next = resolveWarmupLightenChoice({
      planned: original,
      pending: { features: { sleep: 0, pain: 0, hr: 1 }, preferLight: false },
      acceptedLight: false,
      sessionStartedAtMs: 42,
    });
    expect(next).toBe(original);
    expect(next.lightDay).toBe(false);
  });
});
