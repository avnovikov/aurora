import { describe, expect, it } from "vitest";
import type { ExerciseMemory } from "../../src/domain/types";
import {
  applySetLogToMemory,
  emptyMemory,
  normalizeSessionEvaluation,
  sessionEvaluationLabel,
} from "../../src/session/history";
import { buildFamilyLadderIndex, type FamilyLadderIndex } from "../../src/progress/familyLadderIndex";
import type { SetLogEntry, WorkoutLog } from "../../src/session/setLog";

function memory(
  exerciseId: string,
  over: Partial<ExerciseMemory> = {},
): ExerciseMemory {
  return { ...emptyMemory(exerciseId), ...over };
}

function entry(
  over: Partial<SetLogEntry> & Pick<SetLogEntry, "exerciseId" | "stopReason" | "completedReps" | "prescribedReps">,
): SetLogEntry {
  return Object.freeze({
    id: over.id ?? `set_${over.exerciseId}_${over.setIndex ?? 1}`,
    slotId: over.slotId ?? `slot_${over.exerciseId}`,
    exerciseId: over.exerciseId,
    setIndex: over.setIndex ?? 1,
    prescribedReps: over.prescribedReps,
    completedReps: over.completedReps,
    addedLoadKg: over.addedLoadKg ?? 0,
    stopReason: over.stopReason,
    loggedAt: over.loggedAt ?? "2026-11-17T07:00:00.000Z",
    ...(over.durationSeconds !== undefined ? { durationSeconds: over.durationSeconds } : {}),
  });
}

const NOW_FIXED = new Date("2026-11-17T12:00:00Z");
const EMPTY_INDEX = buildFamilyLadderIndex([]);

function log(...entries: SetLogEntry[]): WorkoutLog {
  return { entries };
}

describe("normalizeSessionEvaluation", () => {
  it("maps legacy failed to difficult", () => {
    expect(normalizeSessionEvaluation("failed")).toBe("difficult");
  });

  it("keeps current evaluation values", () => {
    expect(normalizeSessionEvaluation("easy")).toBe("easy");
    expect(normalizeSessionEvaluation("on_target")).toBe("on_target");
    expect(normalizeSessionEvaluation("difficult")).toBe("difficult");
    expect(normalizeSessionEvaluation("wiped")).toBe("wiped");
  });
});

describe("sessionEvaluationLabel", () => {
  it("labels difficult (and legacy failed) as Difficult", () => {
    expect(sessionEvaluationLabel("difficult")).toBe("Difficult");
    expect(sessionEvaluationLabel("failed")).toBe("Difficult");
  });
});

describe("applySetLogToMemory", () => {
  it("marks at-standard when every logged set hits the prescribed reps", () => {
    const memories = {
      squat: memory("squat", { sessionsAtStandard: 1, sessionsBelowFloor: 2 }),
    };
    const next = applySetLogToMemory(
      memories,
      log(
        entry({
          exerciseId: "squat",
          setIndex: 1,
          prescribedReps: 8,
          completedReps: 8,
          stopReason: "completed",
        }),
        entry({
          exerciseId: "squat",
          setIndex: 2,
          prescribedReps: 8,
          completedReps: 8,
          stopReason: "completed",
        }),
      ),
      { now: NOW_FIXED, index: EMPTY_INDEX },
    );
    expect(next.squat).toEqual(
      memory("squat", { sessionsAtStandard: 2, sessionsBelowFloor: 0, lastSessionAt: NOW_FIXED.toISOString() }),
    );
  });

  it("leaves skipped / never-started exercises untouched", () => {
    const memories = {
      curl: memory("curl", { sessionsAtStandard: 3, sessionsBelowFloor: 1, bestReps: 10 }),
      squat: memory("squat", { sessionsAtStandard: 0 }),
    };
    const before = structuredClone(memories.curl!);
    const next = applySetLogToMemory(
      memories,
      log(
        entry({
          exerciseId: "squat",
          prescribedReps: 8,
          completedReps: 8,
          stopReason: "completed",
        }),
        entry({
          exerciseId: "curl",
          prescribedReps: 10,
          completedReps: 0,
          stopReason: "skipped",
        }),
      ),
    );
    expect(next.curl).toEqual(before);
    expect(next.squat?.sessionsAtStandard).toBe(1);
  });

  it("leaves memory byte-identical when the exercise never appears in the log", () => {
    const memories = {
      curl: memory("curl", { sessionsAtStandard: 2, sessionsBelowFloor: 1 }),
    };
    const before = structuredClone(memories);
    const next = applySetLogToMemory(memories, log());
    expect(next.curl).toEqual(before.curl);
    expect(next).toEqual(before);
  });

  it("marks below floor only for muscular_failure short of the prescribed reps", () => {
    const memories = {
      squat: memory("squat", { sessionsAtStandard: 2, sessionsBelowFloor: 0 }),
    };
    const next = applySetLogToMemory(
      memories,
      log(
        entry({
          exerciseId: "squat",
          setIndex: 1,
          prescribedReps: 8,
          completedReps: 8,
          stopReason: "completed",
        }),
        entry({
          exerciseId: "squat",
          setIndex: 2,
          prescribedReps: 8,
          completedReps: 5,
          stopReason: "muscular_failure",
        }),
      ),
      { now: NOW_FIXED, index: EMPTY_INDEX },
    );
    expect(next.squat).toEqual(
      memory("squat", { sessionsAtStandard: 0, sessionsBelowFloor: 1, lastSessionAt: NOW_FIXED.toISOString() }),
    );
  });

  it("resets at-standard only when sets are short without muscular failure", () => {
    const memories = {
      squat: memory("squat", { sessionsAtStandard: 2, sessionsBelowFloor: 1 }),
    };
    const next = applySetLogToMemory(
      memories,
      log(
        entry({
          exerciseId: "squat",
          prescribedReps: 8,
          completedReps: 6,
          stopReason: "completed",
        }),
      ),
      { now: NOW_FIXED, index: EMPTY_INDEX },
    );
    expect(next.squat).toEqual(
      memory("squat", { sessionsAtStandard: 0, sessionsBelowFloor: 1, lastSessionAt: NOW_FIXED.toISOString() }),
    );
  });

  it("does not count a light-day miss toward stall", () => {
    const memories = {
      squat: memory("squat", { sessionsAtStandard: 2, sessionsBelowFloor: 1 }),
    };
    const next = applySetLogToMemory(
      memories,
      log(
        entry({
          exerciseId: "squat",
          prescribedReps: 8,
          completedReps: 4,
          stopReason: "muscular_failure",
        }),
      ),
      { lightDay: true, now: NOW_FIXED, index: EMPTY_INDEX },
    );
    expect(next.squat).toEqual(
      memory("squat", { sessionsAtStandard: 0, sessionsBelowFloor: 1, lastSessionAt: NOW_FIXED.toISOString() }),
    );
  });

  it("ignores session rating — evaluation is not an input", () => {
    const memories = {
      squat: memory("squat", { sessionsAtStandard: 0, sessionsBelowFloor: 0 }),
      curl: memory("curl", { sessionsAtStandard: 4, sessionsBelowFloor: 0 }),
    };
    const next = applySetLogToMemory(
      memories,
      log(
        entry({
          exerciseId: "squat",
          prescribedReps: 8,
          completedReps: 8,
          stopReason: "completed",
        }),
      ),
    );
    expect(next.squat?.sessionsAtStandard).toBe(1);
    expect(next.curl).toEqual(memories.curl);
  });
});

describe("inferred tiers at session close (#112 rule 7, rule 2)", () => {
  const NOW = new Date("2026-11-17T12:00:00Z");
  const index = buildFamilyLadderIndex([
    { id: "hf_108", name: "Dragon Flag" },
    { id: "ab_wheel", name: "Ab Wheel Rollout" },
    { id: "hollow_hold", name: "Hollow Hold" },
  ]);
  const inferred = (id: string) =>
    memory(id, {
      inferred: { tier: "intermediate" as const, from: ["ab_wheel", "hf_108"], at: NOW.toISOString() },
    });
  const set = (
    exerciseId: string,
    completedReps: number,
    stopReason: "completed" | "muscular_failure",
  ) => entry({ exerciseId, completedReps, prescribedReps: 10, stopReason });

  it("a clean session confirms an inferred tier as logged", () => {
    const out = applySetLogToMemory(
      { hollow_hold: inferred("hollow_hold") },
      log(set("hollow_hold", 10, "completed")),
      { now: NOW, index },
    );
    expect(out.hollow_hold).toMatchObject({ loggedTier: "intermediate", lastSessionAt: NOW.toISOString() });
    expect(out.hollow_hold?.inferred).toBeUndefined();
  });

  it("a failed set removes the inferred tier and caps harder rungs", () => {
    const out = applySetLogToMemory(
      { hollow_hold: inferred("hollow_hold") },
      log(set("hollow_hold", 6, "muscular_failure")),
      { now: NOW, index },
    );
    expect(out.hollow_hold?.inferred).toBeUndefined();
    expect(out.ab_wheel?.failedCaps).toMatchObject([{ tier: "intermediate", from: "hollow_hold" }]);
  });
});

describe("failure caps per source (#112 rule 2)", () => {
  const NOW = new Date("2026-11-17T12:00:00Z");
  const index: FamilyLadderIndex = {
    byId: new Map([
      ["low", { id: "low", name: "Low", familyId: "f", rank: 1 }],
      ["mid", { id: "mid", name: "Mid", familyId: "f", rank: 2 }],
      ["high", { id: "high", name: "High", familyId: "f", rank: 3 }],
    ]),
    byFamily: new Map([
      [
        "f",
        [
          { id: "low", name: "Low", familyId: "f", rank: 1 },
          { id: "mid", name: "Mid", familyId: "f", rank: 2 },
          { id: "high", name: "High", familyId: "f", rank: 3 },
        ],
      ],
    ]),
  };
  const fail = (id: string) =>
    entry({ exerciseId: id, completedReps: 5, prescribedReps: 10, stopReason: "muscular_failure" });
  const pass = (id: string) =>
    entry({ exerciseId: id, completedReps: 10, prescribedReps: 10, stopReason: "completed" });
  const run = (memories: Record<string, ExerciseMemory>, e: SetLogEntry, lightDay = false) =>
    applySetLogToMemory(memories, log(e), { now: NOW, index, lightDay });

  it("a light-day failure keeps the inferred tier and sets no caps", () => {
    const tested = (id: string) =>
      memory(id, { declaredTier: "intermediate", declaredAt: NOW.toISOString() });
    const start = {
      low: memory("low", {
        inferred: { tier: "beginner", from: ["high", "mid"], at: NOW.toISOString() },
      }),
      mid: tested("mid"),
      high: tested("high"),
    };
    const out = run(start, fail("low"), true);
    expect(out.low?.inferred).toEqual(start.low.inferred);
    expect(out.mid?.failedCaps).toBeUndefined();
    expect(out.high?.failedCaps).toBeUndefined();
    expect(out.low?.sessionsBelowFloor).toBe(0);
  });

  it("a failure caps harder rungs until the same move is at standard again", () => {
    const failed = run({}, fail("low"));
    expect(failed.mid?.failedCaps).toMatchObject([{ from: "low" }]);
    expect(failed.high?.failedCaps).toMatchObject([{ from: "low" }]);
    const cleared = run(failed, pass("low"));
    expect(cleared.mid && "failedCaps" in cleared.mid).toBe(false);
    expect(cleared.high && "failedCaps" in cleared.high).toBe(false);
  });

  it("keeps one cap per failing source", () => {
    const afterLow = run({}, fail("low"));
    const afterMid = run(afterLow, fail("mid"));
    expect(afterMid.high?.failedCaps?.map((c) => c.from).sort()).toEqual(["low", "mid"]);
    const afterPass = run(afterMid, pass("mid"));
    expect(afterPass.high?.failedCaps?.map((c) => c.from)).toEqual(["low"]);
  });

  it("two consecutive failures on one move leave exactly one self-cap", () => {
    const twice = run(run({}, fail("low")), fail("low"));
    expect(twice.low?.failedCaps?.filter((c) => c.from === "low")).toHaveLength(1);
    expect(twice.low?.failedCaps).toHaveLength(1);
  });

  it("another move's clean session does not clear a cap", () => {
    const failed = run({}, fail("low"));
    const out = run(failed, pass("high"));
    expect(out.high?.failedCaps?.map((c) => c.from)).toEqual(["low"]);
  });
});

describe("a failure removes the inferred tier (#112 rule 7)", () => {
  const NOW = new Date("2026-11-17T12:00:00Z");
  const member = (id: string, rank: number) => ({ id, name: id, familyId: "f", rank });
  const members = [member("low", 1), member("mid", 2), member("high", 3)];
  const index: FamilyLadderIndex = {
    byId: new Map(members.map((m) => [m.id, m])),
    byFamily: new Map([["f", members]]),
  };
  const advanced = (id: string) => memory(id, { declaredTier: "advanced", declaredAt: NOW.toISOString() });
  const ORIGINAL_AT = "2026-11-10T12:00:00.000Z";
  const start = {
    low: memory("low", { inferred: { tier: "intermediate", from: ["high", "mid"], at: ORIGINAL_AT } }),
    mid: advanced("mid"),
    high: advanced("high"),
  };
  const fail = entry({ exerciseId: "low", completedReps: 5, prescribedReps: 10, stopReason: "muscular_failure" });
  const pass = entry({ exerciseId: "low", completedReps: 10, prescribedReps: 10, stopReason: "completed" });

  it("is not re-inferred at the failed tier from the same supporters", () => {
    const out = applySetLogToMemory(start, log(fail), { now: NOW, index });
    const tier = out.low?.inferred?.tier;
    expect(tier === undefined || tier === "beginner" || tier === "novice").toBe(true);
    expect(out.low?.inferred?.at).not.toBe(ORIGINAL_AT);
    expect(out.low?.failedCaps).toMatchObject([{ tier: "beginner", from: "low" }]);
  });

  it("lifts the self-cap on the move's next at-standard session", () => {
    const failed = applySetLogToMemory(start, log(fail), { now: NOW, index });
    const passed = applySetLogToMemory(failed, log(pass), { now: NOW, index });
    expect(passed.low && "failedCaps" in passed.low).toBe(false);
  });
});
