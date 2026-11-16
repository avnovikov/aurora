import { describe, expect, it } from "vitest";
import {
  expandHoldPrescription,
  type ExercisePrescription,
} from "../../src/domain/prescription";

function hold(
  partial: Partial<ExercisePrescription> &
    Pick<ExercisePrescription, "rounds" | "amountMin" | "amountMax">,
): ExercisePrescription {
  return {
    effort: "hold",
    scope: "total",
    ...partial,
  };
}

describe("expandHoldPrescription", () => {
  it("expands 2 × 20 s per side into four 20 s segments L R L R", () => {
    const segments = expandHoldPrescription(
      hold({ rounds: 2, amountMin: 20, amountMax: 20, scope: "perSide" }),
    );
    expect(segments).toEqual([
      { seconds: 20, side: "left" },
      { seconds: 20, side: "right" },
      { seconds: 20, side: "left" },
      { seconds: 20, side: "right" },
    ]);
  });

  it("expands 3 × 25 s total into three segments with no side", () => {
    expect(
      expandHoldPrescription(hold({ rounds: 3, amountMin: 25, amountMax: 25 })),
    ).toEqual([{ seconds: 25 }, { seconds: 25 }, { seconds: 25 }]);
  });

  it("uses amountMin for each warm-up segment when the band has a range", () => {
    expect(
      expandHoldPrescription(hold({ rounds: 2, amountMin: 15, amountMax: 20 })),
    ).toEqual([{ seconds: 15 }, { seconds: 15 }]);
  });

  it("rejects non-hold effort, bad rounds, and inverted bands", () => {
    expect(() =>
      expandHoldPrescription({
        effort: "reps",
        rounds: 2,
        amountMin: 10,
        amountMax: 10,
        scope: "total",
      }),
    ).toThrow(/hold/i);
    expect(() =>
      expandHoldPrescription(hold({ rounds: 0, amountMin: 20, amountMax: 20 })),
    ).toThrow(/rounds/i);
    expect(() =>
      expandHoldPrescription(hold({ rounds: 1, amountMin: 30, amountMax: 20 })),
    ).toThrow(/amountMin/i);
  });
});
