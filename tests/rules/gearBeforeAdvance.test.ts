import { describe, expect, it } from "vitest";
import { EXERCISE_GRAPH } from "../../src/data/exerciseGraph";
import type { SeedSlot, StarterProgram } from "../../src/data/seed";
import type { ExerciseMemory } from "../../src/domain/types";
import { planSession } from "../../src/rules/planSession";
import { resolveSlot } from "../../src/rules/resolveSlot";

/**
 * Device bug #285: Supported Split Squat advanced into Suspended Split Squat,
 * then gear care fell back to Bodyweight squat and kept the 1-rep advance dose.
 * Suitability must be filtered before selection — no post-hoc gear fallback.
 */
describe("filter gear before advance (#285)", () => {
  const supported = EXERCISE_GRAPH.wger_2557!;
  const suspended = EXERCISE_GRAPH.fedb_suspended_split_squat!;
  const ready: ExerciseMemory = {
    exerciseId: "wger_2557",
    sessionsAtStandard: 1,
    sessionsBelowFloor: 0,
    lastAddedLoadKg: 0,
    weakLinkSessionsRemaining: 0,
    bestReps: 15,
    loggedTier: "novice",
    skillTier: "novice",
  };

  it("resolveSlot does not advance into a harder move the athlete lacks gear for", () => {
    expect(supported.harderId).toBe("fedb_suspended_split_squat");
    expect(suspended.requires).toContain("suspension");

    const withGear = resolveSlot({
      exercise: supported,
      memory: ready,
      readiness: { painJoints: [], sleepQuality: "fair" },
      dose: { sets: 3, reps: 12, targetRir: 3, addedLoadKg: 0 },
      pinned: false,
      weakLinks: [],
      graph: EXERCISE_GRAPH,
      equipment: ["body", "bar", "suspension"],
    });
    expect(withGear.exerciseId).toBe("fedb_suspended_split_squat");
    expect(withGear.ruleIds).toContain("advance");

    const noSuspension = resolveSlot({
      exercise: supported,
      memory: ready,
      readiness: { painJoints: [], sleepQuality: "fair" },
      dose: { sets: 3, reps: 12, targetRir: 3, addedLoadKg: 0 },
      pinned: false,
      weakLinks: [],
      graph: EXERCISE_GRAPH,
      equipment: ["body", "bar", "kettlebell"],
    });
    expect(noSuspension.exerciseId).toBe("wger_2557");
    expect(noSuspension.ruleIds).not.toContain("advance");
    expect(noSuspension.ruleIds).not.toContain("equipment");
    expect(noSuspension.dose.reps).toBeGreaterThan(1);
  });

  it("planSession never emits Bodyweight squat at 1 rep after a blocked suspension advance", () => {
    const slot: SeedSlot = {
      id: "day_test_single_leg",
      label: "Single-leg squat",
      exerciseId: "wger_2557",
      pattern: "squat",
      dose: { sets: 3, reps: 12, targetRir: 3, addedLoadKg: 0 },
      restSeconds: 90,
      pinned: false,
    };
    const program: StarterProgram = {
      id: "tmpl_test_285",
      name: "Gear-before-advance fixture",
      sessionLabel: "Test",
      warmupByLevel: {
        beginner: ["ankle_rocks"],
        intermediate: ["ankle_rocks"],
        advanced: ["ankle_rocks"],
      },
      cooldownStationIds: [],
      slots: [slot],
    };

    const session = planSession(
      { painJoints: [], sleepQuality: "fair" },
      program,
      { wger_2557: ready },
      { equipment: ["body", "bar", "kettlebell"] },
    );

    expect(session.work).toHaveLength(1);
    const item = session.work[0]!;
    expect(item.exerciseId).toBe("wger_2557");
    expect(item.exerciseId).not.toBe("bodyweight_squat");
    expect(item.ruleIds).not.toContain("equipment");
    expect(item.ruleIds).not.toContain("advance");
    expect(item.dose.reps).toBeGreaterThan(1);
    expect(item.reason).not.toMatch(/Needs suspension/i);
  });
});
