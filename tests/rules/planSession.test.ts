import { describe, expect, it } from "vitest";
import { SESSION_TEMPLATES, templateToStarter } from "../../src/data/seed";
import type { ExerciseMemory } from "../../src/domain/types";
import { planSession } from "../../src/rules/planSession";

const readiness = { painJoints: [], sleepQuality: "fair" } as const;

function memory(exerciseId: string, over: Partial<ExerciseMemory>): ExerciseMemory {
  return {
    exerciseId,
    sessionsAtStandard: 0,
    sessionsBelowFloor: 0,
    lastAddedLoadKg: 0,
    weakLinkSessionsRemaining: 0,
    ...over,
  };
}

describe("planSession warm-up level", () => {
  const legs = templateToStarter(SESSION_TEMPLATES.find((t) => t.id === "tmpl_legs")!);
  const ids = (session: ReturnType<typeof planSession>) => session.warmup.map((step) => step.stationId);

  it("plans the beginner warm-up when the target family tier is unknown", () => {
    const session = planSession(readiness, legs, {});
    expect(session.warmupLevel).toBe("beginner");
    expect(ids(session)).toEqual(legs.warmupByLevel.beginner);
  });

  it("picks the level from the athlete's tier in the target family", () => {
    const memories = { bulgarian_split: memory("bulgarian_split", { skillTier: "elite" }) };
    const session = planSession(readiness, legs, memories);
    expect(session.warmupLevel).toBe("advanced");
    expect(ids(session)).toEqual(legs.warmupByLevel.advanced);
  });

  it("lets the caller override the level", () => {
    const session = planSession(readiness, legs, {}, { warmupLevel: "intermediate" });
    expect(ids(session)).toEqual(legs.warmupByLevel.intermediate);
  });
});

describe("planSession", () => {
  it("plans warmup steps and work items from the Legs starter template", () => {
    const session = planSession({ painJoints: [], sleepQuality: "fair" });

    expect(session.programId).toBe("tmpl_legs");
    expect(session.warmup.length).toBeGreaterThan(0);
    expect(session.work).toHaveLength(5);
    expect(session.lightDay).toBe(false);
    expect(session.work.every((item) => item.cues.length > 0)).toBe(true);
  });

  it("marks a light day and applies light-day rules when sleep was poor", () => {
    const session = planSession({ painJoints: [], sleepQuality: "poor" });

    expect(session.lightDay).toBe(true);
    expect(session.work.every((item) => item.ruleIds.includes("light_day"))).toBe(
      true,
    );
    for (const item of session.work) {
      expect(item.dose.sets).toBeLessThanOrEqual(2);
      expect(item.dose.targetRir).toBeGreaterThanOrEqual(3);
    }
  });

  it("applies deload to every slot and flags the session", () => {
    const session = planSession(
      { painJoints: [], sleepQuality: "fair" },
      undefined,
      undefined,
      { deloadActive: true },
    );

    expect(session.deload).toBe(true);
    expect(session.lightDay).toBe(false);
    for (const item of session.work) {
      expect(item.ruleIds).toContain("deload");
      expect(item.ruleIds).not.toContain("advance");
      expect(item.reason).toMatch(/deload/i);
      expect(item.dose.targetRir).toBeGreaterThanOrEqual(3);
    }
  });

  it("leaves deload off by default", () => {
    const session = planSession({ painJoints: [], sleepQuality: "fair" });
    expect(session.deload).toBe(false);
  });
});
