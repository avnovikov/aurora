import { describe, expect, it } from "vitest";
import { EXERCISE_GRAPH } from "../../src/data/exerciseGraph";
import { declareLevelForDays, levelForMove, memoryAtLevel } from "../../src/plan/levelDeclare";
import { emptyMemory } from "../../src/session/history";
import type { SessionTemplate } from "../../src/domain/program";

function dayWith(
  slots: Array<{ id: string; exerciseId: string; pinned?: boolean }>,
): SessionTemplate {
  return {
    id: "d",
    name: "d",
    focus: "upper",
    targetExerciseIds: [],
    warmupByLevel: { beginner: [], intermediate: [], advanced: [] },
    cooldownStationIds: [],
    slots: slots.map((slot) => ({
      id: slot.id,
      label: slot.id,
      exerciseId: slot.exerciseId,
      pattern: "push",
      dose: { sets: 3, reps: 8, targetRir: 2, addedLoadKg: 0 },
      restSeconds: 60,
      pinned: slot.pinned ?? false,
    })),
    repeat: false,
  };
}

describe("plan level is a dose default (#112 rule 10)", () => {
  const pullup = EXERCISE_GRAPH.pullup!;
  const NOW = new Date("2026-11-17T12:00:00Z");

  it("memoryAtLevel with an explicit now still sets planTier", () => {
    const m = memoryAtLevel(undefined, pullup, "intermediate", NOW);
    expect(m.planTier).toBe(levelForMove(pullup, "intermediate"));
  });

  it("declareLevelForDays stores no empty record for a move already at the level", () => {
    const day = dayWith([{ id: "s1", exerciseId: "pullup" }]);
    const out = declareLevelForDays({}, [day], "beginner", NOW);
    expect(pullup.id in out).toBe(false);
  });

  it("leaves an existing memory at the plan level untouched (#116)", () => {
    const day = dayWith([{ id: "s1", exerciseId: "pullup" }]);
    const existing = {
      ...emptyMemory("pullup"),
      planTier: levelForMove(pullup, "intermediate"),
      skillTier: levelForMove(pullup, "intermediate"),
    };
    const out = declareLevelForDays({ pullup: existing }, [day], "intermediate", NOW);
    expect(out.pullup).toBe(existing);
  });

  it("memoryAtLevel sets planTier, never declaredTier", () => {
    const m = memoryAtLevel(undefined, pullup, "intermediate");
    expect(m.declaredTier).toBeUndefined();
    expect(m.planTier).toBe(levelForMove(pullup, "intermediate"));
  });

  it("declareLevelForDays writes planTier only and does not invent declared evidence (#116)", () => {
    const knee = EXERCISE_GRAPH.hanging_knee_raise!;
    const day = dayWith([
      { id: "s1", exerciseId: "pullup" },
      { id: "s2", exerciseId: "hanging_knee_raise" },
    ]);
    const out = declareLevelForDays({}, [day], "intermediate", NOW);
    expect(out.pullup?.planTier).toBe(levelForMove(pullup, "intermediate"));
    expect(out.hanging_knee_raise?.planTier).toBe(levelForMove(knee, "intermediate"));
    for (const memory of Object.values(out)) {
      expect(memory.declaredTier).toBeUndefined();
      expect(memory.inferred).toBeUndefined();
      expect(memory.loggedTier).toBeUndefined();
    }
  });

  it("skips pinned slots and unknown exercise ids (#116)", () => {
    const day = dayWith([
      { id: "s1", exerciseId: "pullup", pinned: true },
      { id: "s2", exerciseId: "not_a_real_exercise" },
    ]);
    const out = declareLevelForDays({}, [day], "intermediate", NOW);
    expect(out).toEqual({});
  });
});
