import { describe, expect, it } from "vitest";
import { detailHtml } from "../../src/library/libraryDetail";
import type { SeedExercise } from "../../src/data/seed";
import type { HistoryFeedRow } from "../../src/progress/historyFeed";

const exercise = {
  id: "hf_71",
  name: "Pistol squat",
  pattern: "squat",
  type: "dynamic",
  muscles: [],
  joints: [],
} as SeedExercise;

const legacyRow: HistoryFeedRow = {
  key: "k",
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

describe("Library detail logged sets", () => {
  it("appends the History feed at the end of the page", () => {
    const html = detailHtml(exercise, {
      loggedSets: [legacyRow],
      loggedSetsHaveLegacy: true,
    });
    expect(html).toContain("Logged sets");
    expect(html).toContain("From your sessions");
    expect(html).toContain("15 sets that session (summary)");
    expect(html.indexOf("Logged sets")).toBeGreaterThan(html.indexOf("Exercise"));
  });

  it("shows an empty note when there are no rows", () => {
    const html = detailHtml(exercise, { loggedSets: [] });
    expect(html).toContain("No logged sets for this move yet.");
  });
});
