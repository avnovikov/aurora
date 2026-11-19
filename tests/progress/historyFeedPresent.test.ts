import { describe, expect, it } from "vitest";
import {
  historyFeedListHtml,
  historyFeedRowMeta,
  sessionPulseBlockHtml,
} from "../../src/progress/historyFeedPresent";
import type { HistoryFeedRow } from "../../src/progress/historyFeed";

const setRow: HistoryFeedRow = {
  key: "k1",
  kind: "set",
  exerciseId: "hf_71",
  exerciseName: "Pistol squat",
  setIndex: 2,
  completedReps: 8,
  prescribedReps: 10,
  when: "2026-11-17T09:54:20.038Z",
  sessionId: "h1",
  stopReason: "completed",
};

const legacyRow: HistoryFeedRow = {
  key: "k2",
  kind: "legacy_session",
  exerciseId: "hf_71",
  exerciseName: "Pistol squat",
  setIndex: 0,
  completedReps: 0,
  prescribedReps: 0,
  when: "2026-11-17T09:54:20.038Z",
  sessionId: "h1",
  stopReason: "completed",
  sessionSetCount: 15,
};

describe("historyFeedPresent", () => {
  it("formats set and legacy meta the same as History", () => {
    expect(historyFeedRowMeta(setRow)).toMatch(/Set 2 · 8 \/ 10 ·/);
    expect(historyFeedRowMeta(legacyRow)).toMatch(
      /15 sets that session \(summary\) ·/,
    );
  });

  it("includes Avg pulse when the set has averageBpm", () => {
    expect(historyFeedRowMeta({ ...setRow, averageBpm: 142 })).toMatch(
      /Avg pulse 142/,
    );
  });

  it("can render titles as Library links", () => {
    const html = historyFeedListHtml([setRow], { linkTitles: true });
    expect(html).toContain('data-open-exercise="hf_71"');
    expect(html).toContain("Pistol squat");
  });

  it("renders a compact session pulse block from series", () => {
    const html = sessionPulseBlockHtml({
      templateName: "Lower body",
      completedAt: "2026-11-19T09:43:59.596Z",
      pulse: {
        series: [
          { t: 1_000, bpm: 100 },
          { t: 2_000, bpm: 140 },
          { t: 3_000, bpm: 120 },
        ],
        byExercise: [{ exerciseId: "hf_71", averageBpm: 130, sampleCount: 2 }],
      },
      exerciseNames: { hf_71: "Pistol squat" },
    });
    expect(html).toContain("data-session-pulse");
    expect(html).toContain("Lower body");
    expect(html).toContain("Pistol squat · avg 130");
    expect(html).toMatch(/100[\s\S]*140[\s\S]*120/);
  });
});
