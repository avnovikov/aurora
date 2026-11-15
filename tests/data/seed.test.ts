import { describe, expect, it } from "vitest";
import {
  doodleFor,
  SEED_GRAPH,
  SESSION_TEMPLATES,
  STARTER_PROGRAM,
} from "../../src/data/seed";

describe("SESSION_TEMPLATES", () => {
  it("includes Legs, Abs/Core, Skill, Bars, and Full body", () => {
    const names = SESSION_TEMPLATES.map((template) => template.name);
    expect(names).toEqual(
      expect.arrayContaining(["Legs", "Abs / Core", "Skill", "Bars", "Full body"]),
    );
  });

  it("treats freestanding handstand as a Skill target", () => {
    const skill = SESSION_TEMPLATES.find((template) => template.id === "tmpl_skill_hs");
    expect(skill?.targetExerciseIds).toContain("freestanding_hs");
  });
});

describe("STARTER_PROGRAM", () => {
  it("aliases the Legs template for older callers", () => {
    expect(STARTER_PROGRAM.id).toBe("tmpl_legs");
    expect(STARTER_PROGRAM.warmupExerciseIds.length).toBeGreaterThan(0);
    expect(STARTER_PROGRAM.slots.map((slot) => slot.label)).toEqual([
      "Squat",
      "Hinge",
    ]);
  });
});

describe("SEED_GRAPH", () => {
  it("indexes core and bar exercises", () => {
    expect(SEED_GRAPH.hollow_hold?.regions).toContain("core");
    expect(SEED_GRAPH.pullup?.regions).toContain("pull");
    expect(SEED_GRAPH.wall_handstand?.pattern).toBe("skill");
  });
});

describe("doodleFor", () => {
  it("returns the doodle path when one is defined", () => {
    expect(doodleFor("bodyweight_squat")).toBe(
      "/doodles/doodle-bodyweight-squat.jpg",
    );
  });

  it("returns undefined for unknown ids", () => {
    expect(doodleFor("missing_exercise")).toBeUndefined();
  });

  it("maps warmup doodles for march / hips / ankles", () => {
    expect(doodleFor("pulse_raiser_march")).toBe("/doodles/doodle-lunge.jpg");
    expect(doodleFor("ankle_rocks")).toBe("/doodles/doodle-calf-raise.jpg");
  });
});
