import { describe, expect, it } from "vitest";
import {
  appendSet,
  assertLogImmutable,
  createEmptyLog,
  editAddedLoad,
  editNextReps,
  prescribedForNextSet,
  workStateAfterLoggedSet,
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

  it("stores optional whole-second durationSeconds", () => {
    const log = appendSet(createEmptyLog(), validSet({ durationSeconds: 42 }));
    expect(log.entries[0]?.durationSeconds).toBe(42);
    expect(() => appendSet(createEmptyLog(), validSet({ durationSeconds: -1 }))).toThrow(
      /durationSeconds/,
    );
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

describe("editAddedLoad", () => {
  it("sets added load when non-negative", () => {
    expect(editAddedLoad(activeState(), 12).addedLoadKg).toBe(12);
    expect(editAddedLoad(activeState({ addedLoadKg: 12 }), 0).addedLoadKg).toBe(0);
  });

  it("rejects negative or non-finite load", () => {
    expect(() => editAddedLoad(activeState(), -1)).toThrow(
      "addedLoadKg must be a non-negative finite number",
    );
    expect(() => editAddedLoad(activeState(), Number.NaN)).toThrow(
      "addedLoadKg must be a non-negative finite number",
    );
  });
});

describe("workStateAfterLoggedSet", () => {
  it("sticks logged reps for the next set and clears load and set clock", () => {
    const next = workStateAfterLoggedSet(
      activeState({
        setIndex: 1,
        prescribedReps: 8,
        nextRepsOverride: 6,
        addedLoadKg: 12,
        setStartedAtMs: 1_700_000_000_000,
      }),
      2,
      6,
    );

    expect(next.setIndex).toBe(2);
    expect(next.prescribedReps).toBe(6);
    expect(next.nextRepsOverride).toBe(6);
    expect(next.addedLoadKg).toBe(0);
    expect(next.setStartedAtMs).toBeUndefined();
    expect(prescribedForNextSet(next)).toBe(6);
  });

  it("rejects invalid next set index or logged reps", () => {
    expect(() => workStateAfterLoggedSet(activeState(), 0, 6)).toThrow(
      "setIndex must be >= 1",
    );
    expect(() => workStateAfterLoggedSet(activeState(), 2, 0)).toThrow(
      "logged reps must be a positive integer",
    );
  });
});