import { describe, expect, it } from "vitest";
import { recordWarmupAverage } from "../../src/pulse/warmupHrHistory";
import { assessWarmupWoundUp } from "../../src/pulse/warmupWoundUp";
import { useMemoryStorage } from "../helpers/storage";

useMemoryStorage();

const bounds = { restingBpm: 60, maxBpm: 185 };

describe("warmup wound-up", () => {
  it("uses end-zone when baseline is immature", () => {
    const endAtMs = 100_000;
    const samples = [
      { bpm: 100, atMs: endAtMs - 60_000 },
      { bpm: 150, atMs: endAtMs - 20_000 },
      { bpm: 155, atMs: endAtMs - 5_000 },
      { bpm: 152, atMs: endAtMs - 1_000 },
    ];
    const result = assessWarmupWoundUp({
      warmupLevel: "beginner",
      samples,
      endAtMs,
      bounds,
    });
    expect(result.woundUp).toBe(true);
    expect(result.reason).toBe("end_zone");
  });

  it("prefers personal baseline once mature", () => {
    for (let i = 0; i < 5; i += 1) {
      recordWarmupAverage("advanced", 100);
    }
    const endAtMs = 50_000;
    const samples = [
      { bpm: 118, atMs: 10_000 },
      { bpm: 120, atMs: 20_000 },
      { bpm: 122, atMs: 30_000 },
      { bpm: 90, atMs: endAtMs - 5_000 },
    ];
    const result = assessWarmupWoundUp({
      warmupLevel: "advanced",
      samples,
      endAtMs,
      bounds,
    });
    expect(result.woundUp).toBe(true);
    expect(result.reason).toBe("baseline");
  });
});
