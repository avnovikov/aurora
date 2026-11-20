import { describe, expect, it } from "vitest";
import type { HistoryEntry } from "../../src/domain/program";
import type { Exercise } from "../../src/domain/types";
import { buildHistorySessionBlocks } from "../../src/progress/historySessionBlocks";

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

const graph = {
  a: exercise("a", "vertical_pull"),
  b: exercise("b", "horizontal_pull"),
  squat_a: exercise("squat_a", "squat"),
};

const sessionWithSets: HistoryEntry = {
  id: "h1",
  completedAt: "2026-11-17T09:00:00.000Z",
  templateId: "t",
  templateName: "Upper body · A",
  evaluation: "on_target",
  setCount: 4,
  exerciseIds: ["a", "b"],
  sets: [
    {
      exerciseId: "a",
      setIndex: 1,
      prescribedReps: 8,
      completedReps: 20,
      loggedAt: "2026-11-17T08:50:00.000Z",
      stopReason: "completed",
      averageBpm: 140,
    },
    {
      exerciseId: "a",
      setIndex: 2,
      prescribedReps: 8,
      completedReps: 25,
      loggedAt: "2026-11-17T08:52:00.000Z",
      stopReason: "completed",
      averageBpm: 150,
    },
    {
      exerciseId: "a",
      setIndex: 3,
      prescribedReps: 8,
      completedReps: 30,
      loggedAt: "2026-11-17T08:54:00.000Z",
      stopReason: "completed",
    },
    {
      exerciseId: "b",
      setIndex: 1,
      prescribedReps: 10,
      completedReps: 9,
      loggedAt: "2026-11-17T08:56:00.000Z",
      stopReason: "completed",
      averageBpm: 120,
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

const olderSession: HistoryEntry = {
  id: "h0",
  completedAt: "2026-11-16T09:00:00.000Z",
  templateId: "t0",
  templateName: "Lower body · B",
  evaluation: "easy",
  setCount: 1,
  exerciseIds: ["b"],
  sets: [
    {
      exerciseId: "b",
      setIndex: 1,
      prescribedReps: 5,
      completedReps: 5,
      loggedAt: "2026-11-16T08:50:00.000Z",
      stopReason: "completed",
    },
  ],
};

const legacySession: HistoryEntry = {
  id: "hist_legacy",
  completedAt: "2026-11-15T09:54:20.038Z",
  templateId: "day_a",
  templateName: "Lower body · A",
  evaluation: "difficult",
  setCount: 15,
  exerciseIds: ["squat_a", "b"],
};

describe("buildHistorySessionBlocks", () => {
  it("rolls up completed reps in logged order per exercise", () => {
    const { blocks } = buildHistorySessionBlocks({
      history: [sessionWithSets],
      graph,
    });
    expect(blocks).toHaveLength(1);
    const block = blocks[0]!;
    expect(block.legacy).toBe(false);
    expect(block.templateName).toBe("Upper body · A");
    expect(block.evaluation).toBe("on_target");
    expect(block.exercises.map((e) => e.exerciseId)).toEqual(["a", "b"]);
    expect(block.exercises[0]?.completedRepsBySet).toEqual([20, 25, 30]);
    expect(block.exercises[1]?.completedRepsBySet).toEqual([9]);
  });

  it("prefers pulse.byExercise average over set averageBpm mean", () => {
    const { blocks } = buildHistorySessionBlocks({
      history: [sessionWithSets],
      graph,
    });
    expect(blocks[0]?.exercises[0]?.averageBpm).toBe(148);
    expect(blocks[0]?.exercises[1]?.averageBpm).toBe(120);
  });

  it("omits averageBpm when neither byExercise nor set averages exist", () => {
    const { blocks } = buildHistorySessionBlocks({
      history: [olderSession],
      graph,
    });
    expect(blocks[0]?.exercises[0]?.averageBpm).toBeUndefined();
  });

  it("orders sessions newest-first", () => {
    const { blocks } = buildHistorySessionBlocks({
      history: [olderSession, sessionWithSets],
      graph,
    });
    expect(blocks.map((b) => b.sessionId)).toEqual(["h1", "h0"]);
  });

  it("filters to one exercise within matching sessions", () => {
    const { blocks } = buildHistorySessionBlocks({
      history: [sessionWithSets],
      graph,
      filter: { kind: "exercise", exerciseId: "a" },
    });
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.exercises.map((e) => e.exerciseId)).toEqual(["a"]);
  });

  it("filters to a pattern bundle", () => {
    const { blocks } = buildHistorySessionBlocks({
      history: [sessionWithSets],
      graph,
      filter: {
        kind: "pattern",
        pattern: "vertical_pull",
        exerciseIds: ["a"],
      },
    });
    expect(blocks[0]?.exercises.map((e) => e.exerciseId)).toEqual(["a"]);
  });

  it("keeps legacy summary rows without fabricated rollups", () => {
    const { blocks } = buildHistorySessionBlocks({
      history: [legacySession],
      graph,
    });
    expect(blocks).toHaveLength(1);
    const block = blocks[0]!;
    expect(block.legacy).toBe(true);
    expect(block.templateName).toBe("Lower body · A");
    expect(block.evaluation).toBe("difficult");
    expect(block.exercises).toHaveLength(0);
    expect(block.legacyRows).toHaveLength(2);
    expect(block.legacyRows.every((row) => row.kind === "legacy_session")).toBe(
      true,
    );
    expect(block.legacyRows[0]?.sessionSetCount).toBe(15);
  });

  it("attaches pulse on set sessions when present", () => {
    const { blocks } = buildHistorySessionBlocks({
      history: [sessionWithSets],
      graph,
    });
    expect(blocks[0]?.pulse?.series).toHaveLength(2);
  });

  it("drops legacy sessions a filter excludes", () => {
    const { blocks } = buildHistorySessionBlocks({
      history: [legacySession],
      graph,
      filter: { kind: "exercise", exerciseId: "a" },
    });
    expect(blocks).toHaveLength(0);
  });
});
