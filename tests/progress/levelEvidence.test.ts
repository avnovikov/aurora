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

  it("keeps inference live on day 21 and drops after (#116)", () => {
    // TTL uses age > 21, so exactly 21 days is still live.
    const onBoundary = { ...base, inferred: { tier: "intermediate" as const, from: ["a", "b"], at: daysAgo(21) } };
    const past = { ...base, inferred: { tier: "intermediate" as const, from: ["a", "b"], at: daysAgo(22) } };
    expect(liveInferredTier(onBoundary, NOW)).toBe("intermediate");
    expect(liveInferredTier(past, NOW)).toBeUndefined();
  });

  it("evidence tier includes live inferred; plan default yields to logged", () => {
    expect(evidenceTier(base, NOW)).toBeUndefined();
    expect(evidenceTier({ ...base, planTier: "intermediate" }, NOW)).toBe("intermediate");
    expect(evidenceTier({ ...base, planTier: "intermediate", loggedTier: "beginner" }, NOW)).toBe("beginner");
    expect(
      evidenceTier(
        { ...base, inferred: { tier: "advanced", from: ["a", "b"], at: daysAgo(1) } },
        NOW,
      ),
    ).toBe("advanced");
    expect(refreshSkillTier({ ...base, declaredTier: "advanced" }, NOW).skillTier).toBe("advanced");
    expect(refreshSkillTier(base, NOW).skillTier).toBeUndefined();
  });

  it("clears a stale cached skillTier when inference has expired (#116)", () => {
    const stale = {
      ...base,
      skillTier: "advanced" as const,
      inferred: { tier: "advanced" as const, from: ["a", "b"], at: daysAgo(30) },
    };
    expect(refreshSkillTier(stale, NOW).skillTier).toBeUndefined();
    expect(refreshSkillTier(stale, NOW).inferred?.tier).toBe("advanced");
  });

  it("flags a tested level for retest after 42 days without a session", () => {
    expect(needsRetest({ ...base, declaredTier: "advanced", declaredAt: daysAgo(43) }, NOW)).toBe(true);
    expect(needsRetest({ ...base, declaredTier: "advanced", declaredAt: daysAgo(42) }, NOW)).toBe(false);
    expect(needsRetest({ ...base, declaredTier: "advanced", declaredAt: daysAgo(43), lastSessionAt: daysAgo(3) }, NOW)).toBe(false);
    expect(needsRetest({ ...base, loggedTier: "advanced", lastSessionAt: daysAgo(43) }, NOW)).toBe(true);
    expect(needsRetest({ ...base, planTier: "advanced" }, NOW)).toBe(false);
  });
});
