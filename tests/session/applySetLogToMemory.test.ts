import { describe, expect, it } from "vitest";
import type { ExerciseMemory } from "../../src/domain/types";
import {
  applySetLogToMemory,
  emptyMemory,
  normalizeSessionEvaluation,
  sessionEvaluationLabel,
} from "../../src/session/history";
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
    );
    expect(next.squat).toEqual(
      memory("squat", { sessionsAtStandard: 2, sessionsBelowFloor: 0 }),
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
    );
    expect(next.squat).toEqual(
      memory("squat", { sessionsAtStandard: 0, sessionsBelowFloor: 1 }),
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
    );
    expect(next.squat).toEqual(
      memory("squat", { sessionsAtStandard: 0, sessionsBelowFloor: 1 }),
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
      { lightDay: true },
    );
    expect(next.squat).toEqual(
      memory("squat", { sessionsAtStandard: 0, sessionsBelowFloor: 1 }),
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
