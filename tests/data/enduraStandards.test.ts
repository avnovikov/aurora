import { describe, expect, it } from "vitest";
import {
  enduraRuleFor,
  fromEndura,
  scaleStandards,
} from "../../src/data/enrich/enduraStandards";
import type { EffortKind } from "../../src/domain/types";

const enduraStandardsFor = (name: string, effort: EffortKind) => enduraRuleFor(name, effort)?.standards ?? null;

describe("fromEndura / scaleStandards", () => {
  it("maps Endura N/I/A/E onto Aurora beginner…elite with novice ≈ ⅔ of N", () => {
    expect(fromEndura(6, 15, 28, 45)).toEqual({
      novice: 4,
      beginner: 6,
      intermediate: 15,
      advanced: 28,
      elite: 45,
    });
  });

  it("scales assisted variants with ceil × 1.2", () => {
    const free = fromEndura(6, 15, 28, 45);
    expect(scaleStandards(free, 1.2)).toEqual({
      novice: 5,
      beginner: 8,
      intermediate: 18,
      advanced: 34,
      elite: 54,
    });
  });
});

describe("enduraRuleFor", () => {
  it("uses free split squat Endura floors", () => {
    expect(enduraStandardsFor("Split Squats", "reps")).toEqual(
      fromEndura(6, 15, 28, 45),
    );
  });

  it("applies +20% for Supported Split Squat", () => {
    expect(enduraStandardsFor("Supported Split Squat", "reps")).toEqual(
      scaleStandards(fromEndura(6, 15, 28, 45), 1.2),
    );
  });

  it("uses incline push-up Endura table (not push-up × 1.2)", () => {
    expect(enduraStandardsFor("Incline Push-Up", "reps")).toEqual(
      fromEndura(15, 35, 65, 100),
    );
  });

  it("uses pull-up Endura floors", () => {
    expect(enduraStandardsFor("Pull-up", "reps")).toEqual(
      fromEndura(4, 8, 13, 18),
    );
  });

  it("derives elevated pike as floor pike ÷ 1.2", () => {
    expect(enduraStandardsFor("Elevated pike push-up", "reps")).toEqual(
      scaleStandards(fromEndura(7, 18, 35, 58), 1 / 1.2),
    );
  });

  it("gives the plain push-up, pull-up, incline and straight-bar dip bands to the exact twin only (#262)", () => {
    expect(enduraStandardsFor("Standard Push-Up", "reps")).toEqual(fromEndura(17, 22, 29, 36));
    expect(enduraStandardsFor("Push-ups", "reps")).toEqual(fromEndura(17, 22, 29, 36));
    expect(enduraStandardsFor("Pull-up", "reps")).toEqual(fromEndura(4, 8, 13, 18));
    expect(enduraStandardsFor("Incline Push-Up", "reps")).toEqual(fromEndura(15, 35, 65, 100));
    expect(enduraStandardsFor("Straight Bar Dip", "reps")).toEqual(fromEndura(5, 12, 22, 35));
    // Harder or easier variants fall through to the researched table.
    for (const name of [
      "L-Sit Pull-Up",
      "Hindu Push-Up",
      "Push-up with shoulder tap",
      "Knee push-up",
      "Low incline push-up",
      "Archer Straight-Bar Dip",
      "Bent-Knee Australian Pull-Up",
      "Archer Australian Pull-Up",
      "Australian Chin-Up",
    ]) {
      expect(enduraStandardsFor(name, "reps"), name).toBeNull();
    }
    // Named specific rows are unchanged.
    expect(enduraStandardsFor("Archer Push-Up", "reps")).toEqual(fromEndura(2, 6, 12, 20));
    expect(enduraStandardsFor("Chin-Up", "reps")).toEqual(fromEndura(6, 14, 24, 35));
  });

  it("caps the muscle-up elite below the pull-up's (#262)", () => {
    const muscleUp = enduraRuleFor("Muscle-up", "reps")!;
    expect(muscleUp.standards).toEqual({ novice: 1, beginner: 2, intermediate: 6, advanced: 12, elite: 15 });
    expect(muscleUp.source).toBe("Endura muscle-up men 20–29, elite capped below pull-up");
    const pullUp = enduraStandardsFor("Pull-up", "reps")!;
    for (const tier of ["novice", "beginner", "intermediate", "advanced", "elite"] as const) {
      expect(muscleUp.standards[tier]).toBeLessThan(pullUp[tier]);
    }
  });

  it("returns null for unmatched names", () => {
    expect(enduraStandardsFor("Dead bug", "reps")).toBeNull();
    expect(enduraStandardsFor("Band pull-aparts", "reps")).toBeNull();
  });
});
