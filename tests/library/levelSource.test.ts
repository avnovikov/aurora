import { describe, expect, it } from "vitest";
import { describeLevelSource } from "../../src/library/levelSource";
import { emptyMemory } from "../../src/session/history";

const NOW = new Date("2026-11-17T12:00:00Z");
const name = (id: string) => ({ a: "Bulgarian split squat", b: "Split squat" })[id] ?? id;
const base = emptyMemory("x");

describe("describeLevelSource", () => {
  it("names the source of the level", () => {
    expect(describeLevelSource({ ...base, declaredTier: "advanced", declaredAt: NOW.toISOString() }, NOW, name).label).toBe("Your pick");
    expect(describeLevelSource({ ...base, loggedTier: "advanced", lastSessionAt: NOW.toISOString() }, NOW, name).label).toBe("Logged sets");
    expect(describeLevelSource({ ...base, inferred: { tier: "intermediate", from: ["a", "b"], at: NOW.toISOString() } }, NOW, name).label)
      .toBe("Inferred from Bulgarian split squat + Split squat");
    expect(describeLevelSource({ ...base, planTier: "intermediate" }, NOW, name).label).toBe("Plan default");
    expect(describeLevelSource(base, NOW, name).label).toBeNull();
  });

  it("flags a stale tested level for retest", () => {
    const old = new Date(NOW.getTime() - 50 * 86_400_000).toISOString();
    expect(describeLevelSource({ ...base, declaredTier: "advanced", declaredAt: old }, NOW, name).retest).toBe(true);
  });

  it("does not flag a recent session for retest", () => {
    expect(describeLevelSource({ ...base, loggedTier: "advanced", lastSessionAt: NOW.toISOString() }, NOW, name).retest).toBe(false);
  });

  it("says Your pick when declared and logged agree", () => {
    const m = { ...base, declaredTier: "advanced" as const, loggedTier: "advanced" as const, declaredAt: NOW.toISOString() };
    expect(describeLevelSource(m, NOW, name).label).toBe("Your pick");
  });

  it("falls back to Plan default when the inferred tier expired", () => {
    const old = new Date(NOW.getTime() - 22 * 86_400_000).toISOString();
    const m = { ...base, planTier: "intermediate" as const, inferred: { tier: "intermediate" as const, from: ["a"], at: old } };
    expect(describeLevelSource(m, NOW, name).label).toBe("Plan default");
  });
});
