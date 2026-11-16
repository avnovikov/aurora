import { describe, expect, it } from "vitest";
import type { WarmupStation } from "../../src/data/warmupStations";
import { holdDose } from "../../src/data/warmupStations";
import {
  buildWarmupView,
  warmupViewSeconds,
  WARMUP_GAPS,
} from "../../src/rules/warmupPlan";
import { WARMUP_STATION_BY_ID } from "../../src/data/warmupStations";

function station(
  partial: Pick<WarmupStation, "id" | "name"> &
    Partial<
      Pick<
        WarmupStation,
        "regions" | "holdSeconds" | "cues" | "perSide" | "prescription" | "exerciseId" | "phase" | "source" | "difficulty"
      >
    >,
): WarmupStation {
  return {
    exerciseId: partial.exerciseId ?? partial.id,
    phase: partial.phase ?? "mobilise",
    source: partial.source ?? "test",
    difficulty: partial.difficulty ?? "beginner",
    regions: partial.regions ?? ["legs"],
    holdSeconds: partial.holdSeconds ?? 12,
    cues: partial.cues ?? ["Cue"],
    perSide: partial.perSide ?? false,
    ...partial,
  };
}

describe("WARMUP_GAPS", () => {
  it("exposes short default holds, 10 s breaks and a 5 s side switch", () => {
    expect(WARMUP_GAPS).toEqual({
      sameArea: 10,
      crossArea: 10,
      holdSeconds: 12,
      sideSwitch: 5,
    });
  });
});

describe("per-side stations", () => {
  it("carries perSide into the view and counts the 5 s switch", () => {
    const steps = buildWarmupView([
      station({ id: "a", name: "A", holdSeconds: 30, perSide: true }),
      station({ id: "b", name: "B", holdSeconds: 20 }),
    ]);
    expect(steps.map((step) => step.perSide)).toEqual([true, false]);
    // 30 + 5 switch + 10 gap + 20
    expect(warmupViewSeconds(steps)).toBe(65);
  });
});

describe("prescription expansion", () => {
  it("expands 2 × 20 s per side into four timed steps", () => {
    const steps = buildWarmupView([
      station({
        id: "side",
        name: "Side plank",
        holdSeconds: 90,
        prescription: holdDose(2, 20, "perSide"),
      }),
    ]);
    expect(steps.map((step) => step.holdSeconds)).toEqual([20, 20, 20, 20]);
    expect(steps.map((step) => step.side)).toEqual(["left", "right", "left", "right"]);
    expect(steps.map((step) => step.perSide)).toEqual([false, false, false, false]);
    expect(steps.map((step) => step.name)).toEqual([
      "Side plank (left)",
      "Side plank (right)",
      "Side plank (left)",
      "Side plank (right)",
    ]);
  });

  it("expands authored side plank station into four 20 s steps", () => {
    const sidePlank = WARMUP_STATION_BY_ID.hf_100;
    expect(sidePlank?.prescription).toEqual(holdDose(2, 20, "perSide"));
    const steps = buildWarmupView([sidePlank!]);
    expect(steps).toHaveLength(4);
    expect(steps.every((step) => step.holdSeconds === 20)).toBe(true);
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
