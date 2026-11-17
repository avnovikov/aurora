import { describe, expect, it } from "vitest";
import { minTier, stepDown } from "../../src/domain/skillTier";
import {
  evidenceTier,
  liveInferredTier,
  needsRetest,
  refreshSkillTier,
  testedTier,
} from "../../src/progress/levelEvidence";
import { emptyMemory } from "../../src/session/history";

const NOW = new Date("2026-11-17T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

describe("tier helpers", () => {
  it("minTier and stepDown", () => {
    expect(minTier("advanced", "beginner")).toBe("beginner");
    expect(stepDown("advanced")).toBe("intermediate");
    expect(stepDown("novice")).toBeNull();
  });
});

describe("level evidence", () => {
  const base = emptyMemory("x");

  it("tested tier is the higher of declared and logged", () => {
    expect(testedTier(base)).toBeUndefined();
    expect(testedTier({ ...base, declaredTier: "beginner", loggedTier: "advanced" })).toBe("advanced");
  });

  it("inferred tiers expire after 21 days; a future time counts as now", () => {
    const live = { ...base, inferred: { tier: "intermediate" as const, from: ["a", "b"], at: daysAgo(20) } };
    const dead = { ...base, inferred: { tier: "intermediate" as const, from: ["a", "b"], at: daysAgo(22) } };
    const future = { ...base, inferred: { tier: "intermediate" as const, from: ["a", "b"], at: daysAgo(-5) } };
    expect(liveInferredTier(live, NOW)).toBe("intermediate");
    expect(liveInferredTier(dead, NOW)).toBeUndefined();
    expect(liveInferredTier(future, NOW)).toBe("intermediate");
  });

  it("evidence tier = max(tested, live inferred, plan default)", () => {
    expect(evidenceTier(base, NOW)).toBeUndefined();
    expect(evidenceTier({ ...base, planTier: "intermediate", loggedTier: "beginner" }, NOW)).toBe("intermediate");
    expect(refreshSkillTier({ ...base, declaredTier: "advanced" }, NOW).skillTier).toBe("advanced");
    expect(refreshSkillTier(base, NOW).skillTier).toBeUndefined();
  });

  it("flags a tested level for retest after 42 days without a session", () => {
    expect(needsRetest({ ...base, declaredTier: "advanced", declaredAt: daysAgo(43) }, NOW)).toBe(true);
    expect(needsRetest({ ...base, declaredTier: "advanced", declaredAt: daysAgo(43), lastSessionAt: daysAgo(3) }, NOW)).toBe(false);
    expect(needsRetest({ ...base, planTier: "advanced" }, NOW)).toBe(false);
  });
});
