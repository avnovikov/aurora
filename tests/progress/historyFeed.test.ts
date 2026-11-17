import { describe, expect, it } from "vitest";
import { buildHistoryFeed } from "../../src/progress/historyFeed";
import type { HistoryEntry } from "../../src/domain/program";
import type { Exercise } from "../../src/domain/types";

function exercise(id: string, pattern: Exercise["pattern"]): Exercise {
  return {
    id,
    name: id,
    pattern,
    type: "dynamic",
    muscles: [],
    joints: [],
  };
}

describe("buildHistoryFeed", () => {
  const graph = {
    a: exercise("a", "vertical_pull"),
    b: exercise("b", "horizontal_pull"),
    squat_a: exercise("squat_a", "squat"),
  };

  const historyWithSets: HistoryEntry[] = [
    {
      id: "h1",
      completedAt: "2026-11-17T09:00:00.000Z",
      templateId: "t",
      templateName: "T",
      evaluation: "on_target",
      setCount: 2,
      exerciseIds: ["a", "b"],
      sets: [
        {
          exerciseId: "a",
          setIndex: 1,
          prescribedReps: 8,
          completedReps: 8,
          loggedAt: "2026-11-17T08:50:00.000Z",
          stopReason: "completed",
        },
        {
          exerciseId: "b",
          setIndex: 1,
          prescribedReps: 10,
          completedReps: 9,
          loggedAt: "2026-11-17T08:55:00.000Z",
          stopReason: "completed",
        },
      ],
    },
  ];

  const legacyHistory: HistoryEntry[] = [
    {
      id: "hist_legacy",
      completedAt: "2026-11-17T09:54:20.038Z",
      templateId: "day_a",
      templateName: "Lower body · A",
      evaluation: "difficult",
      setCount: 15,
      exerciseIds: ["squat_a", "b"],
    },
  ];

  it("lists all sets newest-first by default", () => {
    const feed = buildHistoryFeed({ history: historyWithSets, graph });
    expect(feed.rows).toHaveLength(2);
    expect(feed.rows[0]?.exerciseId).toBe("b");
  });

  it("filters to one exercise", () => {
    const feed = buildHistoryFeed({
      history: historyWithSets,
      graph,
      filter: { kind: "exercise", exerciseId: "a" },
    });
    expect(feed.rows).toHaveLength(1);
    expect(feed.rows[0]?.exerciseId).toBe("a");
  });

  it("filters to a pattern bundle", () => {
    const feed = buildHistoryFeed({
      history: historyWithSets,
      graph,
      filter: {
        kind: "pattern",
        pattern: "vertical_pull",
        exerciseIds: ["a"],
      },
    });
    expect(feed.rows.map((r) => r.exerciseId)).toEqual(["a"]);
  });

  it("synthesises legacy session rows when sets are missing", () => {
    const feed = buildHistoryFeed({ history: legacyHistory, graph });
    expect(feed.hasLegacyOnly).toBe(true);
    expect(feed.rows).toHaveLength(2);
    expect(feed.rows.every((row) => row.kind === "legacy_session")).toBe(true);
    expect(feed.rows[0]?.when).toBe("2026-11-17T09:54:20.038Z");
    expect(feed.rows.find((r) => r.exerciseId === "squat_a")?.sessionSetCount).toBe(
      15,
    );
  });

  it("filters legacy rows by pattern", () => {
    const feed = buildHistoryFeed({
      history: legacyHistory,
      graph,
      filter: {
        kind: "pattern",
        pattern: "squat",
        exerciseIds: ["squat_a"],
      },
    });
    expect(feed.rows).toHaveLength(1);
    expect(feed.rows[0]?.exerciseId).toBe("squat_a");
    expect(feed.rows[0]?.kind).toBe("legacy_session");
  });
});
