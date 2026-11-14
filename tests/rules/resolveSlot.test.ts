import { describe, expect, it } from "vitest";
import type {
  Exercise,
  ExerciseMemory,
  ResolveInput,
} from "../../src/domain/types";
import { resolveSlot } from "../../src/rules/resolveSlot";

function exercise(
  partial: Partial<Exercise> & Pick<Exercise, "id" | "name">,
): Exercise {
  return {
    pattern: "squat",
    type: "dynamic",
    muscles: [{ group: "quadriceps", role: "primary" }],
    joints: ["knee"],
    ...partial,
  };
}

function memory(
  partial: Partial<ExerciseMemory> & Pick<ExerciseMemory, "exerciseId">,
): ExerciseMemory {
  return {
    sessionsAtStandard: 0,
    sessionsBelowFloor: 0,
    lastAddedLoadKg: 0,
    weakLinkSessionsRemaining: 0,
    ...partial,
  };
}

function baseInput(overrides: Partial<ResolveInput> = {}): ResolveInput {
  const squat = exercise({ id: "squat", name: "Bodyweight squat", harderId: "pistol", easierId: "sit_squat" });
  const pistol = exercise({ id: "pistol", name: "Pistol squat", easierId: "squat" });
  const sit = exercise({ id: "sit_squat", name: "Sit squat", harderId: "squat" });
  const box = exercise({
    id: "box_squat",
    name: "High box squat",
    joints: ["hip"],
  });
  const graph = { squat, pistol, sit_squat: sit, box_squat: box };
  return {
    exercise: squat,
    memory: memory({ exerciseId: "squat" }),
    readiness: { painJoints: [] },
    dose: { sets: 4, reps: 8, targetRir: 2, addedLoadKg: 0 },
    pinned: false,
    weakLinks: [],
    graph,
    ...overrides,
  };
}

describe("resolveSlot", () => {
  it("holds the prescription when nothing special happens", () => {
    const result = resolveSlot(baseInput());
    expect(result.exerciseId).toBe("squat");
    expect(result.ruleIds).toContain("hold");
    expect(result.dose.sets).toBe(4);
  });

  it("does not treat one miss as a stall", () => {
    const result = resolveSlot(
      baseInput({
        memory: memory({ exerciseId: "squat", sessionsBelowFloor: 1 }),
      }),
    );
    expect(result.exerciseId).toBe("squat");
    expect(result.ruleIds).toContain("hold");
  });

  it("lightens dose on poor sleep without changing exercise", () => {
    const result = resolveSlot(
      baseInput({
        readiness: { painJoints: [], sleepQuality: "poor" },
        memory: memory({ exerciseId: "squat", sessionsAtStandard: 2 }),
      }),
    );
    expect(result.exerciseId).toBe("squat");
    expect(result.ruleIds).toContain("light_day");
    expect(result.ruleIds).not.toContain("advance");
    expect(result.dose.sets).toBe(2);
    expect(result.dose.targetRir).toBe(3);
  });

  it("advances after two sessions at standard when not a light day", () => {
    const result = resolveSlot(
      baseInput({
        memory: memory({ exerciseId: "squat", sessionsAtStandard: 2 }),
      }),
    );
    expect(result.exerciseId).toBe("pistol");
    expect(result.ruleIds).toContain("advance");
  });

  it("pain beats a good pulse and swaps pattern mate without that joint", () => {
    const result = resolveSlot(
      baseInput({
        readiness: { painJoints: ["knee"], sleepQuality: "good" },
      }),
    );
    expect(result.exerciseId).toBe("box_squat");
    expect(result.ruleIds).toEqual(["pain"]);
  });

  it("pin blocks advance but still allows light-day dose", () => {
    const result = resolveSlot(
      baseInput({
        pinned: true,
        readiness: { painJoints: [], sleepQuality: "poor" },
        memory: memory({ exerciseId: "squat", sessionsAtStandard: 2 }),
      }),
    );
    expect(result.exerciseId).toBe("squat");
    expect(result.ruleIds).toContain("pin");
    expect(result.ruleIds).toContain("light_day");
    expect(result.ruleIds).not.toContain("advance");
    expect(result.dose.sets).toBe(2);
  });

  it("inserts weak link after two below-floor sessions", () => {
    const result = resolveSlot(
      baseInput({
        memory: memory({ exerciseId: "squat", sessionsBelowFloor: 2 }),
        lastFailRegion: "end",
        weakLinks: [
          {
            exerciseId: "squat",
            region: "end",
            kind: "sticking_strength",
            muscleGroups: ["quadriceps"],
            componentExerciseId: "step_up",
            sourceNote: "test",
          },
        ],
      }),
    );
    expect(result.exerciseId).toBe("squat");
    expect(result.insertedWeakLinkExerciseId).toBe("step_up");
    expect(result.ruleIds).toContain("stall_weak_link");
    expect(result.dose.sets).toBe(3);
  });

  it("regresses when stalled and no weak link matches", () => {
    const result = resolveSlot(
      baseInput({
        memory: memory({ exerciseId: "squat", sessionsBelowFloor: 2 }),
      }),
    );
    expect(result.exerciseId).toBe("sit_squat");
    expect(result.ruleIds).toContain("stall_regress");
  });
});
