import { describe, expect, it } from "vitest";
import {
  averageWarmupBpm,
  recordWarmupAverage,
  WARMUP_HR_BASELINE_MIN,
  warmupHrMedian,
} from "../../src/pulse/warmupHrHistory";
import { useMemoryStorage } from "../helpers/storage";

useMemoryStorage();

describe("warmup HR history", () => {
  it("averages usable samples and ignores sparse noise", () => {
    expect(averageWarmupBpm([90, 92, 94])).toBe(92);
    expect(averageWarmupBpm([90, 91])).toBeNull();
  });

  it("needs five samples before a median baseline exists", () => {
    for (let i = 0; i < WARMUP_HR_BASELINE_MIN - 1; i += 1) {
      recordWarmupAverage("intermediate", 100 + i);
    }
    expect(warmupHrMedian("intermediate")).toBeNull();
    recordWarmupAverage("intermediate", 110);
    expect(warmupHrMedian("intermediate")).toBe(102);
  });
});
