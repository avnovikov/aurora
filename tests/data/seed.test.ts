import { describe, expect, it } from "vitest";
import {
  doodleFor,
  SEED_GRAPH,
  STARTER_PROGRAM,
} from "../../src/data/seed";

describe("STARTER_PROGRAM", () => {
  it("defines the morning legs and handstand programme", () => {
    expect(STARTER_PROGRAM.id).toBe("morning_legs_handstand");
    expect(STARTER_PROGRAM.warmupExerciseIds.length).toBeGreaterThan(0);
    expect(STARTER_PROGRAM.slots).toHaveLength(3);
    expect(STARTER_PROGRAM.slots.map((slot) => slot.label)).toEqual([
      "Squat",
      "Hinge",
      "Handstand",
    ]);
  });
});

describe("SEED_GRAPH", () => {
  it("indexes every seed exercise by id", () => {
    expect(SEED_GRAPH.bodyweight_squat?.name).toBe("Bodyweight squat");
    expect(SEED_GRAPH.wall_handstand?.pattern).toBe("skill");
  });
});

describe("doodleFor", () => {
  it("returns the doodle path when one is defined", () => {
    expect(doodleFor("bodyweight_squat")).toBe(
      "/doodles/doodle-bodyweight-squat.jpg",
    );
  });

  it("returns undefined for exercises without a doodle or unknown ids", () => {
    expect(doodleFor("pulse_raiser_march")).toBeUndefined();
    expect(doodleFor("missing_exercise")).toBeUndefined();
  });
});