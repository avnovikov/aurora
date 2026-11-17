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
  };

  const history: HistoryEntry[] = [
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

  it("lists all sets newest-first by default", () => {
    const feed = buildHistoryFeed({ history, graph });
    expect(feed.rows).toHaveLength(2);
    expect(feed.rows[0]?.exerciseId).toBe("b");
  });

  it("filters to one exercise", () => {
    const feed = buildHistoryFeed({
      history,
      graph,
      filter: { kind: "exercise", exerciseId: "a" },
    });
    expect(feed.rows).toHaveLength(1);
    expect(feed.rows[0]?.exerciseId).toBe("a");
  });

  it("filters to a pattern bundle", () => {
    const feed = buildHistoryFeed({
      history,
      graph,
      filter: {
        kind: "pattern",
        pattern: "vertical_pull",
        exerciseIds: ["a"],
      },
    });
    expect(feed.rows.map((r) => r.exerciseId)).toEqual(["a"]);
  });
});
