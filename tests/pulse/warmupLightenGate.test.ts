import { describe, expect, it } from "vitest";
import { decideWarmupLightenGate } from "../../src/pulse/warmupLightenGate";
import { recordWarmupAverage } from "../../src/pulse/warmupHrHistory";
import { useMemoryStorage } from "../helpers/storage";

useMemoryStorage();

const bounds = { restingBpm: 60, maxBpm: 185 };
const readiness = { painJoints: [] as string[], sleepQuality: "good" as const };

describe("decideWarmupLightenGate", () => {
  it("asks when end-zone samples look wound up", () => {
    const endAtMs = 100_000;
    const result = decideWarmupLightenGate({
      readiness,
      warmupLevel: "beginner",
      samples: [
        { bpm: 100, atMs: endAtMs - 60_000 },
        { bpm: 150, atMs: endAtMs - 20_000 },
        { bpm: 155, atMs: endAtMs - 5_000 },
        { bpm: 152, atMs: endAtMs - 1_000 },
      ],
      endAtMs,
      bounds,
    });
    expect(result.shouldAsk).toBe(true);
    expect(result.features.hr).toBe(1);
  });

  it("does not ask when baseline is mature and avg is calm", () => {
    for (let i = 0; i < 5; i += 1) {
      recordWarmupAverage("advanced", 110);
    }
    const endAtMs = 50_000;
    const result = decideWarmupLightenGate({
      readiness,
      warmupLevel: "advanced",
      samples: [
        { bpm: 108, atMs: 10_000 },
        { bpm: 110, atMs: 20_000 },
        { bpm: 112, atMs: 30_000 },
        { bpm: 109, atMs: endAtMs - 5_000 },
      ],
      endAtMs,
      bounds,
    });
    expect(result.shouldAsk).toBe(false);
  });
});
