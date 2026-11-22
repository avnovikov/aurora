import { describe, expect, it } from "vitest";
import {
  IMPORT_TEMPLATE_ID,
  historyOnlyIds,
  mergeImportedMemories,
  parseResult,
  planCalisteniappImport,
  replayImportedLevels,
  targetNumber,
  type CalisteniappSession,
} from "../../src/import/calisteniapp";
import { CALISTENIAPP_MAP } from "../../src/data/import/calisteniappMap";
import { EXERCISE_GRAPH } from "../../src/data/exerciseGraph";
import { mergeHistory, HISTORY_CAP } from "../../src/session/history";
import { emptyMemory } from "../../src/progress/levelEvidence";
import type { HistoryEntry } from "../../src/domain/program";

const sessionC: CalisteniappSession = {
  title: "Phase 3 - Session C - Bigger legs",
  date_estimated: "2026-11-13",
  summary: { Effort: "Easy" },
  exercises: [
    {
      name: "Lunges",
      target: "5 sets · 12 reps · 12.0 kg",
      sets: [
        { set: 1, result: "12 reps", weight: null, effort: null },
        { set: 2, result: "12 reps", weight: "12.0 kg", effort: null },
      ],
    },
    {
      name: "Isometric squat",
      target: '5 sets · 20"',
      sets: [{ set: 1, result: '20"', weight: null, effort: null }],
    },
    {
      name: "Isometric single leg hamstring bridge",
      target: '3 sets · 16"',
      sets: [{ set: 1, result: '16"', weight: null, effort: null }],
    },
    {
      name: "Unknown move",
      target: "3 sets · 10 reps",
      sets: [{ set: 1, result: "10 reps", weight: null, effort: null }],
    },
    {
      name: "Deep squat",
      target: "3 sets · 18–20 reps · 12.0 kg",
      sets: [{ set: 1, result: "20 reps", weight: null, effort: null }],
    },
  ],
};

describe("parsing Calisteniapp results", () => {
  it("reads reps, holds and ranges", () => {
    expect(parseResult("12 reps")).toEqual({ kind: "reps", value: 12 });
    expect(parseResult("1 rep")).toEqual({ kind: "reps", value: 1 });
    expect(parseResult('20"')).toEqual({ kind: "hold", value: 20 });
    expect(parseResult("1' 30\"")).toEqual({ kind: "hold", value: 90 });
    expect(parseResult(null)).toBeNull();
    expect(targetNumber("5 sets · 12 reps · 12.0 kg")).toBe(12);
    expect(targetNumber("3 sets · 18–20 reps · 12.0 kg")).toBe(18);
    expect(targetNumber('5 sets · 20"')).toBe(20);
  });
});

describe("planning an import", () => {
  const plan = planCalisteniappImport([sessionC], CALISTENIAPP_MAP, EXERCISE_GRAPH);
  const entry = plan.entries[0]!;

  it("makes one history entry per session at noon UTC on the estimated date", () => {
    expect(plan.entries).toHaveLength(1);
    expect(entry.completedAt).toBe("2026-11-13T12:00:00.000Z");
    expect(entry.templateId).toBe(IMPORT_TEMPLATE_ID);
    expect(entry.templateName).toBe(sessionC.title);
    expect(entry.evaluation).toBe("easy");
    expect(entry.source).toEqual({ app: "calisteniapp", key: "2026-11-13|Phase 3 - Session C - Bigger legs" });
  });

  it("sends weighted sets to the curated weighted twin", () => {
    const lunges = entry.sets!.filter((s) => s.exerciseId === "hf_79" || s.exerciseId === EXERCISE_GRAPH.hf_79!.weightedId);
    expect(lunges.map((s) => s.exerciseId)).toEqual(["hf_79", EXERCISE_GRAPH.hf_79!.weightedId]);
    expect(lunges[0]).toMatchObject({ setIndex: 1, prescribedReps: 12, completedReps: 12, stopReason: "completed" });
  });

  it("keeps hold seconds in completedReps on an isometric move", () => {
    const hold = entry.sets!.find((s) => s.exerciseId === "wger_1733");
    expect(hold).toMatchObject({ prescribedReps: 20, completedReps: 20 });
  });

  it("uses the low end of a target range", () => {
    expect(entry.sets!.find((s) => s.exerciseId === "bodyweight_squat")).toMatchObject({ prescribedReps: 18, completedReps: 20 });
  });

  it("lists skipped names with set counts", () => {
    expect(plan.skipped).toEqual([
      { name: "Isometric single leg hamstring bridge", reason: "unmapped", sets: 1 },
      { name: "Unknown move", reason: "unmapped", sets: 1 },
    ]);
    expect(entry.setCount).toBe(4);
    expect(entry.exerciseIds).toEqual(["hf_79", EXERCISE_GRAPH.hf_79!.weightedId, "wger_1733", "bodyweight_squat"]);
  });

  it("skips a hold logged against a rep move", () => {
    const odd = planCalisteniappImport(
      [{ ...sessionC, exercises: [{ name: "Lunges", target: '3 sets · 20"', sets: [{ set: 1, result: '20"', weight: null, effort: null }] }] }],
      CALISTENIAPP_MAP,
      EXERCISE_GRAPH,
    );
    expect(odd.entries).toHaveLength(0);
    expect(odd.skipped).toEqual([{ name: "Lunges", reason: "kind_mismatch", sets: 1 }]);
  });
});

describe("merging into history", () => {
  const imported = planCalisteniappImport([sessionC], CALISTENIAPP_MAP, EXERCISE_GRAPH).entries;
  const live: HistoryEntry = {
    id: "hist_1",
    completedAt: "2026-11-21T09:33:28.513Z",
    templateId: "day_a",
    templateName: "Full body · A",
    evaluation: "difficult",
    setCount: 1,
    exerciseIds: ["hf_4"],
  };

  it("adds imported entries newest first and skips ones already imported", () => {
    const once = mergeHistory([live], imported);
    expect(once.added).toBe(1);
    expect(once.history.map((h) => h.completedAt)).toEqual([live.completedAt, "2026-11-13T12:00:00.000Z"]);
    const twice = mergeHistory(once.history, imported);
    expect(twice.added).toBe(0);
    expect(twice.duplicates).toBe(1);
    expect(twice.history).toHaveLength(2);
  });

  it("keeps up to the raised cap", () => {
    expect(HISTORY_CAP).toBe(1000);
    const many = Array.from({ length: 1005 }, (_, i) => ({
      ...imported[0]!,
      completedAt: new Date(Date.UTC(2024, 0, 1) + i * 86_400_000).toISOString(),
      source: { app: "calisteniapp" as const, key: `k${i}` },
    }));
    const merged = mergeHistory([], many);
    expect(merged.history).toHaveLength(1000);
    expect(merged.history[0]!.source!.key).toBe("k1004");
  });
});

describe("levels from imported sessions", () => {
  const now = new Date("2026-11-22T12:00:00Z");

  it("scales results by the detraining curve before they become personal bests", () => {
    const recent = planCalisteniappImport([{ ...sessionC, date_estimated: "2026-11-13" }], CALISTENIAPP_MAP, EXERCISE_GRAPH).entries;
    const old = planCalisteniappImport([{ ...sessionC, date_estimated: "2026-08-01" }], CALISTENIAPP_MAP, EXERCISE_GRAPH).entries;
    expect(replayImportedLevels(recent, now).bodyweight_squat!.bestReps).toBe(20);
    const decayed = replayImportedLevels(old, now).bodyweight_squat!.bestReps!;
    expect(decayed).toBeLessThan(20);
    expect(decayed).toBeGreaterThan(10);
  });

  it("keeps history-only moves out of levels", () => {
    const entries = planCalisteniappImport(
      [{ ...sessionC, exercises: [{ name: "Partial single leg squat", target: "5 sets · 15 reps", sets: [{ set: 1, result: "15 reps", weight: null, effort: null }] }] }],
      CALISTENIAPP_MAP,
      EXERCISE_GRAPH,
    ).entries;
    expect(entries[0]!.sets![0]!.exerciseId).toBe("wger_1948");
    expect(historyOnlyIds(CALISTENIAPP_MAP).has("wger_1948")).toBe(true);
    expect(replayImportedLevels(entries, now, historyOnlyIds(CALISTENIAPP_MAP)).wger_1948).toBeUndefined();
  });

  it("stamps evidence with the session date", () => {
    const mem = replayImportedLevels(planCalisteniappImport([sessionC], CALISTENIAPP_MAP, EXERCISE_GRAPH).entries, now);
    expect(mem.bodyweight_squat!.lastSessionAt).toBe("2026-11-13T12:00:00.000Z");
  });

  it("never overwrites newer live state; only raises best and logged tier", () => {
    const live = {
      bodyweight_squat: {
        ...emptyMemory("bodyweight_squat"),
        bestReps: 15,
        sessionsBelowFloor: 2,
        lastSessionAt: "2026-11-21T09:00:00.000Z",
      },
    };
    const imported = {
      bodyweight_squat: { ...emptyMemory("bodyweight_squat"), bestReps: 20, lastSessionAt: "2026-11-13T12:00:00.000Z" },
      calf_raise: { ...emptyMemory("calf_raise"), bestReps: 20 },
    };
    const merged = mergeImportedMemories(live, imported, now);
    expect(merged.bodyweight_squat).toMatchObject({ bestReps: 20, sessionsBelowFloor: 2, lastSessionAt: "2026-11-21T09:00:00.000Z" });
    expect(merged.calf_raise!.bestReps).toBe(20);
  });
});
