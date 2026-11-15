import { describe, expect, it } from "vitest";
import { planSession } from "../../src/rules/planSession";

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
