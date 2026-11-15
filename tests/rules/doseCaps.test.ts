import { describe, expect, it } from "vitest";
import { EXERCISE_GRAPH } from "../../src/data/exerciseGraph";
import type { Exercise, SkillTier } from "../../src/domain/types";
import { memoryAtLevel } from "../../src/plan/levelDeclare";
import { CORE_HOLD_CAP, doseCap, HOLD_CAP, holdRepeats, pyramidSetSeconds, REP_CAP } from "../../src/rules/doseCaps";
import { applySkillDose } from "../../src/rules/skillDose";

const LEVELS: readonly SkillTier[] = ["beginner", "intermediate", "advanced"];
const DOSE = { sets: 3, reps: 8, targetRir: 2, addedLoadKg: 0 };

function byName(name: string): Exercise {
  const exercise = Object.values(EXERCISE_GRAPH).find((item) => item.name === name);
  if (!exercise) {
    throw new Error(`No Library exercise named ${name}`);
  }
  return exercise;
}

function dosedReps(exercise: Exercise, level: SkillTier): { reps: number; tier: SkillTier; rir: number } {
  const result = applySkillDose(DOSE, exercise, memoryAtLevel(undefined, exercise, level));
  return { reps: result.dose.reps, tier: result.tier, rir: result.dose.targetRir };
}

describe("dose caps", () => {
  it("caps reps at 12 / 15 / 20 (ACSM 2009 ranges)", () => {
    expect(REP_CAP.beginner).toBe(12);
    expect(REP_CAP.intermediate).toBe(15);
    expect(REP_CAP.advanced).toBe(20);
  });

  it("doses a beginner prisoner squat at 12, not 28", () => {
    expect(dosedReps(byName("Prisoner Squat"), "beginner").reps).toBe(12);
  });

  it("keeps beginner core holds short (McGill 2010)", () => {
    expect(dosedReps(byName("Forearm Plank"), "beginner").reps).toBe(CORE_HOLD_CAP.beginner);
  });

  it("never prescribes more than the cap for any Library move at any level", () => {
    const over: string[] = [];
    for (const exercise of Object.values(EXERCISE_GRAPH)) {
      if (!exercise.standards) {
        continue;
      }
      for (const level of LEVELS) {
        const { reps, tier } = dosedReps(exercise, level);
        const cap = doseCap(exercise, tier);
        if (reps > cap) {
          over.push(`${exercise.name} @${level}: ${reps} > ${cap}`);
        }
      }
    }
    expect(over).toEqual([]);
  });

  it("caps non-core holds at 30 / 45 / 60 s", () => {
    expect(dosedReps(byName("Wall Sit"), "beginner").reps).toBeLessThanOrEqual(HOLD_CAP.beginner);
    expect(dosedReps(byName("Planche Lean"), "intermediate").reps).toBeLessThanOrEqual(HOLD_CAP.intermediate);
  });

  it("doses beginners 3 reps in reserve and intermediates 2", () => {
    expect(dosedReps(byName("Prisoner Squat"), "beginner").rir).toBe(3);
    expect(dosedReps(byName("Standard Push-Up"), "intermediate").rir).toBe(2);
  });
});

describe("descending pyramid for short core holds (McGill 2010)", () => {
  it("runs 5, 3, 1 holds over three sets of a 10 s plank", () => {
    expect(holdRepeats(byName("Forearm Plank"), 3, 10)).toEqual([5, 3, 1]);
  });

  it("keeps one hold per set above 10 s and for non-core holds", () => {
    expect(holdRepeats(byName("Forearm Plank"), 3, 20)).toBeNull();
    expect(holdRepeats(byName("Wall Sit"), 3, 10)).toBeNull();
  });

  it("times a pyramid set as its holds plus a breath between", () => {
    expect(pyramidSetSeconds(5, 10)).toBe(5 * 10 + 4 * 5);
    expect(pyramidSetSeconds(1, 10)).toBe(10);
  });
});
