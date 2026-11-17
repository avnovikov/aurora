import { describe, expect, it } from "vitest";
import { EXERCISE_GRAPH } from "../../src/data/exerciseGraph";
import { declareLevelForDays, levelForMove, memoryAtLevel } from "../../src/plan/levelDeclare";

describe("plan level is a dose default (#112 rule 10)", () => {
  const pullup = EXERCISE_GRAPH.pullup!;

  it("memoryAtLevel sets planTier, never declaredTier", () => {
    const m = memoryAtLevel(undefined, pullup, "intermediate");
    expect(m.declaredTier).toBeUndefined();
    expect(m.planTier).toBe(levelForMove(pullup, "intermediate"));
  });

  it("declareLevelForDays writes planTier only and infers nothing", () => {
    const day = { id: "d", slots: [{ id: "s1", exerciseId: "pullup" }, { id: "s2", exerciseId: "hanging_knee_raise" }] } as never;
    const out = declareLevelForDays({}, [day], "intermediate");
    for (const memory of Object.values(out)) {
      expect(memory.declaredTier).toBeUndefined();
      expect(memory.inferred).toBeUndefined();
    }
    expect(out.pullup?.planTier).toBe(levelForMove(pullup, "intermediate"));
  });
});
