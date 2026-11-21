import { describe, expect, it } from "vitest";
import { emptyMemory, loadMemories } from "../../src/session/history";
import { MEMORY_V2_KEY } from "../../src/storage/storageKeys";
import { useMemoryStorage } from "../helpers/storage";

const NOW = new Date("2026-11-17T12:00:00Z");
const daysBefore = (days: number) =>
  new Date(NOW.getTime() - days * 86_400_000).toISOString();
const inferred = (days: number) => ({
  tier: "advanced",
  from: ["a", "b"],
  at: daysBefore(days),
});

describe("loadMemories refresh (#112)", () => {
  useMemoryStorage(() => ({
    [MEMORY_V2_KEY]: JSON.stringify({
      stale: { ...emptyMemory("stale"), skillTier: "elite" },
      expired: { ...emptyMemory("expired"), skillTier: "advanced", inferred: inferred(30) },
      live: { ...emptyMemory("live"), inferred: inferred(5) },
    }),
  }));

  it("drops a cached tier with no evidence", () => {
    expect(loadMemories(NOW).stale.skillTier).toBeUndefined();
  });

  it("drops an expired inferred tier", () => {
    expect(loadMemories(NOW).expired.skillTier).toBeUndefined();
  });

  it("keeps a live inferred tier", () => {
    expect(loadMemories(NOW).live.skillTier).toBe("advanced");
  });
});

describe("loadMemories PB → loggedTier (#289)", () => {
  describe("stale beginner with PB at intermediate standard", () => {
    // Device: hip thrust bestReps 20, loggedTier left at beginner (standard @ 18).
    useMemoryStorage(() => ({
      [MEMORY_V2_KEY]: JSON.stringify({
        hf_87: {
          ...emptyMemory("hf_87"),
          bestReps: 20,
          planTier: "intermediate",
          loggedTier: "beginner",
          skillTier: "beginner",
        },
      }),
    }));

    it("raises loggedTier and skillTier to intermediate", () => {
      const memory = loadMemories(NOW).hf_87;
      expect(memory?.loggedTier).toBe("intermediate");
      expect(memory?.skillTier).toBe("intermediate");
    });
  });

  describe("loggedTier already above PB", () => {
    useMemoryStorage(() => ({
      [MEMORY_V2_KEY]: JSON.stringify({
        hf_87: {
          ...emptyMemory("hf_87"),
          bestReps: 20,
          loggedTier: "advanced",
          skillTier: "advanced",
        },
      }),
    }));

    it("keeps the higher loggedTier", () => {
      const memory = loadMemories(NOW).hf_87;
      expect(memory?.loggedTier).toBe("advanced");
      expect(memory?.skillTier).toBe("advanced");
    });
  });
});
