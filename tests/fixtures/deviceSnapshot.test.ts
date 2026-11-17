import { describe, expect, it } from "vitest";
import { getPlanDay, listPlanDays } from "../../src/plan/planDays";
import { loadPlanLevel } from "../../src/plan/planLevel";
import { loadPlanQueue } from "../../src/plan/queue";
import { resetTemplateOverridesForTests, resolveTemplate } from "../../src/plan/templates";
import { loadHistory, loadMemories } from "../../src/session/history";
import { loadProfile } from "../../src/settings/profile";
import { deviceStorage, loadDeviceSnapshot } from "../helpers/deviceSnapshot";
import { useMemoryStorage } from "../helpers/storage";

const SNAPSHOT = "2026-11-17-pixel10";

describe(`device snapshot ${SNAPSHOT}`, () => {
  useMemoryStorage(() => {
    resetTemplateOverridesForTests();
    return deviceStorage(SNAPSHOT);
  });

  it("records where it came from", () => {
    const snapshot = loadDeviceSnapshot(SNAPSHOT);
    expect(snapshot.device).toBe("Pixel 10");
    expect(snapshot.app.package).toBe("com.aurora.rassvet");
  });

  it("holds the one real session: Lower body · A, rated difficult", () => {
    const history = loadHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      templateName: "Lower body · A",
      evaluation: "failed",
      setCount: 15,
      exerciseIds: ["hf_71", "hf_84", "hf_87", "calf_raise", "wger_1605"],
    });
  });

  it("loads per-exercise memory with no session counters set", () => {
    const memories = loadMemories();
    expect(Object.keys(memories)).toHaveLength(100);
    const counted = Object.values(memories).filter(
      (m) => m.sessionsAtStandard > 0 || m.sessionsBelowFloor > 0,
    );
    expect(counted).toEqual([]);
    expect(memories.calf_raise).toMatchObject({ bestReps: 60, skillTier: "elite" });
    // Skipped in the session: no best reps, tier from the athlete's own pick.
    expect(memories.hf_84.bestReps).toBeUndefined();
    expect(memories.hf_84.declaredTier).toBe("intermediate");
  });

  it("loads the profile", () => {
    expect(loadProfile()).toMatchObject({
      setupDone: true,
      bodyweightKg: 85,
      addWeightKg: 12,
    });
  });

  it("loads the plan: level, queue and the queued days", () => {
    expect(loadPlanLevel()).toBe("intermediate");
    const queue = loadPlanQueue().items;
    expect(queue).toEqual(["day_a5192cfe6fb", "day_a5192cfe6fc"]);
    expect(listPlanDays().map((d) => d.id)).toEqual(queue);
    for (const id of queue) {
      expect(getPlanDay(id)?.name).toBeTruthy();
    }
  });

  it("applies the stored template overrides", () => {
    const legs = resolveTemplate("tmpl_legs");
    const split = legs.slots.find((s) => s.id === "legs_split");
    expect(split?.exerciseId).toBe("wger_1208");
  });
});
