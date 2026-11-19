import { describe, expect, it } from "vitest";
import type { HistorySessionBlock } from "../../src/progress/historySessionBlocks";
import {
  historySessionBlockHtml,
  historySessionBlocksHtml,
} from "../../src/progress/historyFeedPresent";

const setBlock: HistorySessionBlock = {
  sessionId: "h1",
  templateName: "Upper body · A",
  completedAt: "2026-11-17T09:00:00.000Z",
  evaluation: "on_target",
  legacy: false,
  legacyRows: [],
  exercises: [
    {
      exerciseId: "a",
      exerciseName: "Pull-up",
      completedRepsBySet: [20, 25, 30],
      averageBpm: 148,
    },
    {
      exerciseId: "b",
      exerciseName: "Row",
      completedRepsBySet: [9],
    },
  ],
  pulse: {
    series: [
      { t: 1, bpm: 130 },
      { t: 2, bpm: 140 },
    ],
    byExercise: [{ exerciseId: "a", averageBpm: 148, sampleCount: 10 }],
  },
};

const legacyBlock: HistorySessionBlock = {
  sessionId: "hist_legacy",
  templateName: "Lower body · A",
  completedAt: "2026-11-15T09:54:20.038Z",
  evaluation: "difficult",
  legacy: true,
  exercises: [],
  legacyRows: [
    {
      key: "hist_legacy:legacy:squat_a",
      kind: "legacy_session",
      exerciseId: "squat_a",
      exerciseName: "Squat",
      setIndex: 0,
      completedReps: 0,
      prescribedReps: 0,
      when: "2026-11-15T09:54:20.038Z",
      sessionId: "hist_legacy",
      stopReason: "completed",
      sessionSetCount: 15,
    },
  ],
};

describe("historySessionBlocksHtml", () => {
  it("renders session header with assessment and rolled-up reps", () => {
    const html = historySessionBlockHtml(setBlock, { linkTitles: false });
    expect(html).toContain("Upper body · A");
    expect(html).toContain("On target");
    expect(html).toContain("Pull-up");
    expect(html).toContain("20 / 25 / 30");
    expect(html).toContain("avg 148");
    expect(html).toContain("Row");
    expect(html).toContain("9");
    expect(html).not.toMatch(/Row[\s\S]*avg/);
  });

  it("includes compact pulse series inside the block", () => {
    const html = historySessionBlockHtml(setBlock, { linkTitles: false });
    expect(html).toContain('data-pulse-series');
    expect(html).toContain("130 · 140");
  });

  it("keeps legacy summary meta under the session header", () => {
    const html = historySessionBlockHtml(legacyBlock, { linkTitles: false });
    expect(html).toContain("Lower body · A");
    expect(html).toContain("Difficult");
    expect(html).toContain("15 sets that session (summary)");
  });

  it("renders empty state when there are no blocks", () => {
    const html = historySessionBlocksHtml([], { hasLegacyOnly: false });
    expect(html).toContain("No sessions yet");
  });

  it("uses legacy empty copy when storage has summary-only sessions", () => {
    const html = historySessionBlocksHtml([], { hasLegacyOnly: true });
    expect(html).toContain("No matching sessions.");
    expect(html).toContain("Older sessions only stored a summary");
  });
});
