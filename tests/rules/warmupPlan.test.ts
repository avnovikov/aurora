import { describe, expect, it } from "vitest";
import type { WarmupStation } from "../../src/data/warmupStations";
import {
  buildWarmupView,
  warmupViewSeconds,
  WARMUP_GAPS,
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

describe("WARMUP_GAPS", () => {
  it("exposes short default holds with 5s breaks between stations", () => {
    expect(WARMUP_GAPS).toEqual({
      sameArea: 5,
      crossArea: 5,
      holdSeconds: 12,
    });
  });
});

describe("buildWarmupView", () => {
  it("rejects an empty sequence", () => {
    expect(() => buildWarmupView([])).toThrow("Warmup sequence must not be empty");
  });

  it("keeps template order and runs each station once", () => {
    const stations = [
      station({ id: "a", name: "A", holdSeconds: 10 }),
      station({ id: "b", name: "B", holdSeconds: 15, regions: ["push"] }),
      station({ id: "c", name: "C", holdSeconds: 12 }),
    ];
    const steps = buildWarmupView(stations);
    expect(steps.map((step) => step.stationId)).toEqual(["a", "b", "c"]);
    expect(steps.map((step) => step.holdSeconds)).toEqual([10, 15, 12]);
  });

  it("applies gaps between stations and clears the final gap", () => {
    const stations = [
      station({ id: "legs", name: "Legs", regions: ["legs"] }),
      station({ id: "push", name: "Push", regions: ["push"] }),
    ];
    const steps = buildWarmupView(stations);
    expect(steps[0]?.gapSecondsAfter).toBe(WARMUP_GAPS.crossArea);
    expect(steps[1]?.gapSecondsAfter).toBe(0);
  });

  it("sums wall-clock seconds for the view", () => {
    const steps = buildWarmupView([
      station({ id: "a", name: "A", holdSeconds: 10 }),
      station({ id: "b", name: "B", holdSeconds: 10 }),
    ]);
    // 10 + sameArea gap + 10 + final gap 0
    expect(warmupViewSeconds(steps)).toBe(10 + WARMUP_GAPS.sameArea + 10);
  });
});
