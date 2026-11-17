import { describe, expect, it } from "vitest";
import {
  historyFeedListHtml,
  historyFeedRowMeta,
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

  it("can render titles as Library links", () => {
    const html = historyFeedListHtml([setRow], { linkTitles: true });
    expect(html).toContain('data-open-exercise="hf_71"');
    expect(html).toContain("Pistol squat");
  });
});
