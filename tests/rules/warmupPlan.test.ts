import { describe, expect, it } from "vitest";
import type { WarmupStation } from "../../src/data/warmupStations";
import {
  planWarmup,
  WARMUP_GAPS,
  type WarmupPlanInput,
} from "../../src/rules/warmupPlan";

function station(
  partial: Pick<WarmupStation, "id" | "name"> &
    Partial<Pick<WarmupStation, "regions" | "holdSeconds" | "cues">>,
): WarmupStation {
  return {
    regions: partial.regions ?? ["legs"],
    holdSeconds: partial.holdSeconds ?? 12,
    cues: partial.cues ?? ["Cue"],
    ...partial,
  };
}

function planWithStations(
  stations: WarmupStation[],
  focusRegions: WarmupPlanInput["focusRegions"],
  targetSeconds?: number,
) {
  return planWarmup({ stations, focusRegions, targetSeconds });
}

describe("WARMUP_GAPS", () => {
  it("exposes short 10–15s default holds with 5s breaks between stations", () => {
    expect(WARMUP_GAPS).toEqual({
      sameArea: 5,
      crossArea: 5,
      holdSeconds: 12,
    });
    expect(WARMUP_GAPS.holdSeconds).toBeGreaterThanOrEqual(10);
    expect(WARMUP_GAPS.holdSeconds).toBeLessThanOrEqual(15);
  });
});

describe("planWarmup", () => {
  it("rejects an empty station pool", () => {
    expect(() => planWithStations([], ["legs"])).toThrow(
      "Warmup station pool must not be empty",
    );
  });

  it("rejects a non-positive target duration", () => {
    const stations = [station({ id: "a", name: "March" })];
    expect(() => planWithStations(stations, ["legs"], 0)).toThrow(
      "Warmup targetSeconds must be positive",
    );
  });

  it("uses each station's own holdSeconds", () => {
    const stations = [
      station({ id: "short", name: "Short", holdSeconds: 10 }),
      station({ id: "long", name: "Long", holdSeconds: 15, regions: ["push"] }),
    ];
    const steps = planWithStations(stations, ["legs", "push"], 50);
    expect(steps.some((step) => step.holdSeconds === 10)).toBe(true);
    expect(steps.some((step) => step.holdSeconds === 15)).toBe(true);
    expect(steps[0]?.cues.length).toBeGreaterThan(0);
    expect(steps[0]?.stationId).toBeTruthy();
  });

  it("uses shorter gaps between the same load region", () => {
    const stations = [
      station({ id: "legs_a", name: "Legs A", regions: ["legs"] }),
      station({ id: "legs_b", name: "Legs B", regions: ["legs"] }),
    ];
    const steps = planWithStations(stations, ["legs"], 120);
    expect(steps.length).toBeGreaterThanOrEqual(2);
    expect(steps[0]?.gapSecondsAfter).toBe(0);
    expect(steps[1]?.gapSecondsAfter).toBe(WARMUP_GAPS.sameArea);
  });

  it("uses longer gaps when the load region changes", () => {
    const stations = [
      station({ id: "legs", name: "Legs", regions: ["legs"] }),
      station({ id: "push", name: "Push", regions: ["push"] }),
    ];
    const steps = planWithStations(stations, ["legs", "push"], 120);
    const crossGap = steps.find(
      (step, index) =>
        index > 0 && step.region === "push" && steps[index - 1]?.region === "legs",
    );
    expect(crossGap?.gapSecondsAfter).toBe(WARMUP_GAPS.crossArea);
  });

  it("clears the gap after the final step", () => {
    const stations = [station({ id: "solo", name: "Solo" })];
    const steps = planWithStations(stations, ["legs"], 80);
    expect(steps.at(-1)?.gapSecondsAfter).toBe(0);
  });
});
