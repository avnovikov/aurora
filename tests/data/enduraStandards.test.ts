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

  it("returns null for unmatched names", () => {
    expect(enduraStandardsFor("Dead bug", "reps")).toBeNull();
    expect(enduraStandardsFor("Band pull-aparts", "reps")).toBeNull();
  });
});
