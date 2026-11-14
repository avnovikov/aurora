import { describe, expect, it } from "vitest";
import {
  appendSet,
  assertLogImmutable,
  createEmptyLog,
  editNextReps,
  prescribedForNextSet,
  type ActiveWorkState,
} from "../../src/session/setLog";

function activeState(overrides: Partial<ActiveWorkState> = {}): ActiveWorkState {
  return {
    slotId: "slot_squat",
    exerciseId: "bodyweight_squat",
    setIndex: 1,
    prescribedReps: 8,
    addedLoadKg: 0,
    ...overrides,
  };
}

function validSet(
  overrides: Partial<Parameters<typeof appendSet>[1]> = {},
) {
  return {
    slotId: "slot_squat",
    exerciseId: "bodyweight_squat",
    setIndex: 1,
    prescribedReps: 8,
    completedReps: 8,
    addedLoadKg: 0,
    stopReason: "completed" as const,
    ...overrides,
  };
}

describe("appendSet", () => {
  it("appends a frozen entry to the log", () => {
    const log = appendSet(createEmptyLog(), validSet());

    expect(log.entries).toHaveLength(1);
    expect(Object.isFrozen(log.entries[0])).toBe(true);
    assertLogImmutable(log);
  });

  it("rejects invalid prescribed or completed reps", () => {
    expect(() =>
      appendSet(createEmptyLog(), validSet({ prescribedReps: 0 })),
    ).toThrow("prescribedReps must be >= 1");
    expect(() =>
      appendSet(createEmptyLog(), validSet({ completedReps: -1 })),
    ).toThrow("completedReps must be >= 0");
    expect(() =>
      appendSet(createEmptyLog(), validSet({ setIndex: 0 })),
    ).toThrow("setIndex must be >= 1");
  });
});

describe("editNextReps", () => {
  it("overrides the next prescribed reps when the value is valid", () => {
    const updated = editNextReps(activeState(), 6);

    expect(updated.nextRepsOverride).toBe(6);
    expect(prescribedForNextSet(updated)).toBe(6);
  });

  it("rejects non-positive or non-integer reps", () => {
    expect(() => editNextReps(activeState(), 0)).toThrow(
      "Next reps must be a positive integer",
    );
    expect(() => editNextReps(activeState(), -2)).toThrow(
      "Next reps must be a positive integer",
    );
    expect(() => editNextReps(activeState(), 2.5)).toThrow(
      "Next reps must be a positive integer",
    );
  });
});