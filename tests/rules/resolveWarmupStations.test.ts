import { describe, expect, it } from "vitest";
import type { WarmupStation } from "../../src/data/warmupStations";
import { WARMUP_STATION_BY_ID } from "../../src/data/warmupStations";
import {
  resolveWarmupStations,
  rewriteWarmupStepsAfterExclude,
} from "../../src/rules/resolveWarmupStations";
import { buildWarmupView } from "../../src/rules/warmupPlan";

function station(
  id: string,
  phase: WarmupStation["phase"] = "raise",
): WarmupStation {
  const fromCatalogue = WARMUP_STATION_BY_ID[id];
  if (fromCatalogue) {
    return { ...fromCatalogue, phase: fromCatalogue.phase ?? phase };
  }
  return {
    id,
    exerciseId: id,
    name: id,
    phase,
    regions: ["general"],
    holdSeconds: 60,
    source: "test",
    difficulty: "beginner",
    cues: ["Cue"],
    perSide: false,
  };
}

function exerciseIds(stations: readonly WarmupStation[]): string[] {
  return stations.map((station) => station.exerciseId);
}

describe("resolveWarmupStations", () => {
  it("leaves the sequence alone when nothing is excluded", () => {
    const input = [station("pulse_raiser_march"), station("ntc_jumping_jacks"), station("ankle_rocks")];
    expect(exerciseIds(resolveWarmupStations(input, []))).toEqual([
      "pulse_raiser_march",
      "ntc_jumping_jacks",
      "ankle_rocks",
    ]);
  });

  it("swaps an excluded Raise for another Raise not already in the list", () => {
    const input = [station("pulse_raiser_march"), station("ankle_rocks")];
    const resolved = resolveWarmupStations(input, ["pulse_raiser_march"]);
    expect(exerciseIds(resolved)).toEqual(["ntc_jumping_jacks", "ankle_rocks"]);
    expect(resolved[0]!.holdSeconds).toBe(input[0]!.holdSeconds);
    expect(resolved[0]!.phase).toBe("raise");
  });

  it("falls back to toy soldiers when the other Raise is already claimed", () => {
    const input = [station("pulse_raiser_march"), station("ankle_rocks")];
    const resolved = resolveWarmupStations(input, ["pulse_raiser_march", "ntc_jumping_jacks"]);
    expect(exerciseIds(resolved)).toEqual(["ntc_toy_soldiers", "ankle_rocks"]);
  });

  it("does not steal a Raise that still appears later in the template", () => {
    const input = [station("pulse_raiser_march"), station("ntc_jumping_jacks"), station("ankle_rocks")];
    expect(exerciseIds(resolveWarmupStations(input, ["pulse_raiser_march"]))).toEqual([
      "ntc_toy_soldiers",
      "ntc_jumping_jacks",
      "ankle_rocks",
    ]);
  });

  it("never leaves an excluded exercise in the list and stays non-empty when a Raise remains", () => {
    const input = [
      station("pulse_raiser_march"),
      station("ntc_jumping_jacks"),
      station("ankle_rocks"),
    ];
    const excluded = ["pulse_raiser_march", "ntc_jumping_jacks", "ankle_rocks"];
    const resolved = resolveWarmupStations(input, excluded);
    expect(resolved.length).toBeGreaterThan(0);
    expect(resolved.every((station) => !excluded.includes(station.exerciseId))).toBe(true);
  });
});

describe("rewriteWarmupStepsAfterExclude", () => {
  it("keeps the current step and rewrites later excluded Raises", () => {
    const steps = buildWarmupView([
      station("pulse_raiser_march"),
      station("ntc_jumping_jacks"),
      station("ankle_rocks"),
    ]);
    const next = rewriteWarmupStepsAfterExclude(steps, 0, ["ntc_jumping_jacks"]);
    const nextIds = next.map((step) => step.exerciseId);
    expect(next[0]!.exerciseId).toBe("pulse_raiser_march");
    expect(nextIds).not.toContain("ntc_jumping_jacks");
    expect(nextIds.some((id) => id === "ntc_toy_soldiers" || id === "ankle_rocks")).toBe(true);
  });

  it("substitutes one multi-segment station once, not once per expanded step", () => {
    const steps = buildWarmupView([
      station("pulse_raiser_march"),
      station("ntc_leg_swings"),
      station("ankle_rocks"),
    ]);
    const swingSteps = steps.filter((step) => step.exerciseId === "ntc_leg_swings");
    expect(swingSteps.length).toBeGreaterThan(1);

    const next = rewriteWarmupStepsAfterExclude(steps, 0, ["ntc_leg_swings"]);
    const tail = next.slice(1);
    const uniqueTail = [...new Set(tail.map((step) => step.exerciseId))];
    expect(uniqueTail).not.toContain("ntc_leg_swings");
    // One substitute station (may expand to a few sides) + ankle_rocks — not one substitute per swing step.
    expect(uniqueTail.length).toBeLessThanOrEqual(3);
    expect(tail.length).toBeLessThanOrEqual(swingSteps.length + 2);
  });
});
