import { describe, expect, it } from "vitest";
import type { ExerciseMemory } from "../../src/domain/types";
import { migrateMemoriesV1 } from "../../src/session/memoryMigration";
import { emptyMemory } from "../../src/session/history";

const NOW = new Date("2026-11-17T12:00:00Z");
const ctx = {
  now: NOW,
  planLevelFor: (id: string) => (id === "hf_84" ? ("intermediate" as const) : undefined),
  standardsOf: (id: string) => (id === "calf_raise" ? { novice: 5, beginner: 10, intermediate: 20, advanced: 35, elite: 50 } : null),
};

describe("migrateMemoriesV1 (#112)", () => {
  it("keeps real picks, moves plan-level writes to planTier, derives loggedTier, drops cascaded tiers", () => {
    const v1: Record<string, ExerciseMemory> = {
      bulgarian_split: { ...emptyMemory("bulgarian_split"), declaredTier: "advanced", skillTier: "advanced" },
      hf_84: { ...emptyMemory("hf_84"), declaredTier: "intermediate", skillTier: "intermediate" },
      calf_raise: { ...emptyMemory("calf_raise"), bestReps: 60, skillTier: "elite" },
      step_up: { ...emptyMemory("step_up"), skillTier: "elite" },
    };
    const { memories, levelsToConfirm } = migrateMemoriesV1(v1, ctx);
    expect(memories.bulgarian_split).toMatchObject({ declaredTier: "advanced", declaredAt: NOW.toISOString(), skillTier: "advanced" });
    expect(memories.hf_84).toMatchObject({ planTier: "intermediate", skillTier: "intermediate" });
    expect(memories.hf_84?.declaredTier).toBeUndefined();
    expect(memories.hf_84?.declaredAt).toBeUndefined();
    expect(memories.calf_raise).toMatchObject({ loggedTier: "elite", skillTier: "elite" });
    expect(memories.step_up?.skillTier).not.toBe("elite");
    expect(levelsToConfirm).toEqual(["hf_84"]);
  });

  it("keeps a real declare and derives loggedTier from bestReps on the same row (#116)", () => {
    const v1: Record<string, ExerciseMemory> = {
      pullup: {
        ...emptyMemory("pullup"),
        declaredTier: "advanced",
        bestReps: 12,
        skillTier: "elite",
      },
    };
    const standards = { novice: 1, beginner: 5, intermediate: 10, advanced: 15, elite: 20 };
    const { memories } = migrateMemoriesV1(v1, {
      ...ctx,
      planLevelFor: () => undefined,
      standardsOf: (id) => (id === "pullup" ? standards : null),
    });
    expect(memories.pullup).toMatchObject({
      declaredTier: "advanced",
      declaredAt: NOW.toISOString(),
      loggedTier: "intermediate",
      bestReps: 12,
    });
    expect(memories.pullup?.skillTier).not.toBe("elite");
  });
});
