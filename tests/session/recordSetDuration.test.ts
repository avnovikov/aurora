import { describe, expect, it } from "vitest";
import { emptyMemory, recordSetDuration } from "../../src/session/history";

describe("recordSetDuration", () => {
  it("builds a rolling integer average", () => {
    let memories = recordSetDuration({}, "bodyweight_squat", 100);
    expect(memories.bodyweight_squat?.avgSetDurationSeconds).toBe(100);
    expect(memories.bodyweight_squat?.setDurationSampleCount).toBe(1);

    memories = recordSetDuration(memories, "bodyweight_squat", 50);
    expect(memories.bodyweight_squat?.avgSetDurationSeconds).toBe(75);
    expect(memories.bodyweight_squat?.setDurationSampleCount).toBe(2);
  });

  it("preserves other memory fields", () => {
    const prior = { ...emptyMemory("bodyweight_squat"), bestReps: 12 };
    const next = recordSetDuration({ bodyweight_squat: prior }, "bodyweight_squat", 40);
    expect(next.bodyweight_squat?.bestReps).toBe(12);
  });
});
