import { describe, expect, it } from "vitest";
import { emptyMemory, loadMemories } from "../../src/session/history";
import { MEMORY_KEY } from "../../src/storage/storageKeys";
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
    [MEMORY_KEY]: JSON.stringify({
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
