import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EXERCISE_GRAPH } from "../../src/data/exerciseGraph";
import { levelForMove } from "../../src/plan/levelDeclare";
import { migrateMemoriesV1 } from "../../src/session/memoryMigration";
import { loadDeviceSnapshot } from "../helpers/deviceSnapshot";

const NOW = new Date("2026-11-17T13:00:00Z");

describe("level inference on the 2026-11-17 Pixel 10 snapshot (#112)", () => {
  const snap = loadDeviceSnapshot("2026-11-17-pixel10");
  const v1 = snap.localStorage["aurora.poc.memory.v1"] as never;
  const { memories, levelsToConfirm } = migrateMemoriesV1(v1, {
    now: NOW,
    planLevelFor: (id) => (EXERCISE_GRAPH[id] ? levelForMove(EXERCISE_GRAPH[id]!, "intermediate") : undefined),
    standardsOf: (id) => EXERCISE_GRAPH[id]?.standards ?? null,
  });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("nothing is elite unless picked or logged", () => {
    const elite = Object.values(memories).filter((m) => m.skillTier === "elite");
    for (const m of elite) {
      expect(m.declaredTier === "elite" || m.loggedTier === "elite", m.exerciseId).toBe(true);
    }
    expect(memories.calf_raise?.skillTier).toBe("elite");
  });

  it("the Bulgarian split squat pick alone does not make the lunge family elite", () => {
    for (const id of ["step_up", "reverse_lunge", "wger_2557"]) {
      expect(memories[id], id).toBeDefined();
      expect(memories[id]!.skillTier, id).not.toBe("elite");
    }
  });

  it("plan-level writes are listed to confirm", () => {
    expect(levelsToConfirm).toEqual(expect.arrayContaining(["hf_84", "hf_87"]));
  });
});
