import { describe, expect, it } from "vitest";
import type { SeedExercise } from "../../src/data/seed";
import {
  planWarmup,
  WARMUP_GAPS,
  type WarmupPlanInput,
} from "../../src/rules/warmupPlan";

function warmupExercise(
  partial: Pick<SeedExercise, "id" | "name"> &
    Partial<Pick<SeedExercise, "regions">>,
): SeedExercise {
  return {
    pattern: "mobility",
    type: "dynamic",
    muscles: [{ group: "quadriceps", role: "primary" }],
    joints: ["hip"],
    cues: [],
    regions: partial.regions ?? ["legs"],
    ...partial,
  };
}

function planWithPool(
  pool: SeedExercise[],
  focusRegions: WarmupPlanInput["focusRegions"],
  targetSeconds?: number,
) {
  return planWarmup({ pool, focusRegions, targetSeconds });
}

describe("WARMUP_GAPS", () => {
  it("exposes 5s same-area and 10s cross-area spacing", () => {
    expect(WARMUP_GAPS).toEqual({
      sameArea: 5,
      crossArea: 10,
      holdSeconds: 40,
    });
  });
});

describe("planWarmup", () => {
  it("rejects an empty pool", () => {
    expect(() => planWithPool([], ["legs"])).toThrow(
      "Warmup pool must not be empty",
    );
  });

  it("rejects a non-positive target duration", () => {
    const pool = [warmupExercise({ id: "a", name: "March" })];
    expect(() => planWithPool(pool, ["legs"], 0)).toThrow(
      "Warmup targetSeconds must be positive",
    );
  });

  it("uses shorter gaps between the same load region", () => {
    const pool = [
      warmupExercise({ id: "legs_a", name: "Legs A", regions: ["legs"] }),
      warmupExercise({ id: "legs_b", name: "Legs B", regions: ["legs"] }),
    ];
    const steps = planWithPool(pool, ["legs"], 120);
    expect(steps.length).toBeGreaterThanOrEqual(2);
    expect(steps[0]?.gapSecondsAfter).toBe(0);
    expect(steps[1]?.gapSecondsAfter).toBe(WARMUP_GAPS.sameArea);
  });

  it("uses longer gaps when the load region changes", () => {
    const pool = [
      warmupExercise({ id: "legs", name: "Legs", regions: ["legs"] }),
      warmupExercise({ id: "push", name: "Push", regions: ["push"] }),
    ];
    const steps = planWithPool(pool, ["legs", "push"], 120);
    const crossGap = steps.find(
      (step, index) =>
        index > 0 && step.region === "push" && steps[index - 1]?.region === "legs",
    );
    expect(crossGap?.gapSecondsAfter).toBe(WARMUP_GAPS.crossArea);
  });

  it("clears the gap after the final step", () => {
    const pool = [warmupExercise({ id: "solo", name: "Solo" })];
    const steps = planWithPool(pool, ["legs"], 80);
    expect(steps.at(-1)?.gapSecondsAfter).toBe(0);
  });
});