import { describe, expect, it } from "vitest";
import { planSession } from "../../src/rules/planSession";

describe("planSession", () => {
  it("plans warmup steps and work items from the Legs starter template", () => {
    const session = planSession({ painJoints: [], sleepQuality: "fair" });

    expect(session.programId).toBe("tmpl_legs");
    expect(session.warmup.length).toBeGreaterThan(0);
    expect(session.work).toHaveLength(2);
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
});
