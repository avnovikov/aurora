import { describe, expect, it } from "vitest";
import {
  averageBpmInWindow,
  buildHistoryPulse,
  createPulseSessionBuffer,
  recordPulseSample,
  type PulseSessionBuffer,
} from "../../src/pulse/pulseSessionBuffer";

function record(
  buffer: PulseSessionBuffer,
  t: number,
  bpm: number,
  phase: "warmup" | "work" | "rest" | "cooldown" | "done" = "work",
  exerciseId: string | null = "ex_a",
): void {
  recordPulseSample(buffer, { t, bpm, phase, exerciseId: phase === "work" ? exerciseId : null });
}

describe("pulseSessionBuffer", () => {
  it("keeps at most one sample per second (latest bpm wins)", () => {
    const buffer = createPulseSessionBuffer();
    record(buffer, 1_000, 100);
    record(buffer, 1_400, 110);
    record(buffer, 1_900, 120);
    record(buffer, 2_000, 130);
    expect(buffer.samples).toEqual([
      { t: 1_900, bpm: 120, phase: "work", exerciseId: "ex_a" },
      { t: 2_000, bpm: 130, phase: "work", exerciseId: "ex_a" },
    ]);
  });

  it("averages whole bpm in a set window inclusive of endpoints", () => {
    const buffer = createPulseSessionBuffer();
    record(buffer, 1_000, 100);
    record(buffer, 2_000, 110);
    record(buffer, 3_000, 120);
    record(buffer, 4_000, 200); // outside
    expect(averageBpmInWindow(buffer, 1_000, 3_000)).toBe(110);
  });

  it("returns null average when the window has no samples", () => {
    const buffer = createPulseSessionBuffer();
    record(buffer, 5_000, 140);
    expect(averageBpmInWindow(buffer, 1_000, 2_000)).toBeNull();
  });

  it("builds history pulse series and by-exercise averages", () => {
    const buffer = createPulseSessionBuffer();
    record(buffer, 1_000, 100, "warmup", null);
    record(buffer, 2_000, 120, "work", "ex_a");
    record(buffer, 3_000, 140, "work", "ex_a");
    record(buffer, 4_000, 160, "work", "ex_b");
    record(buffer, 5_000, 100, "rest", null);

    expect(buildHistoryPulse(buffer)).toEqual({
      series: [
        { t: 1_000, bpm: 100 },
        { t: 2_000, bpm: 120 },
        { t: 3_000, bpm: 140 },
        { t: 4_000, bpm: 160 },
        { t: 5_000, bpm: 100 },
      ],
      byExercise: [
        { exerciseId: "ex_a", averageBpm: 130, sampleCount: 2 },
        { exerciseId: "ex_b", averageBpm: 160, sampleCount: 1 },
      ],
    });
  });

  it("returns undefined history pulse when there are no samples", () => {
    expect(buildHistoryPulse(createPulseSessionBuffer())).toBeUndefined();
  });
});
