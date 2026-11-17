import { beforeEach, describe, expect, it } from "vitest";
import { getPlanDay, listPlanDays } from "../../src/plan/planDays";
import { loadPlanLevel } from "../../src/plan/planLevel";
import { loadPlanQueue } from "../../src/plan/queue";
import { resetTemplateOverridesForTests, resolveTemplate } from "../../src/plan/templates";
import { ensureMemoryMigrated, loadLevelsToConfirm } from "../../src/session/ensureMemoryMigrated";
import { templateToStarter } from "../../src/data/seed";
import { planSession } from "../../src/rules/planSession";
import { loadExcluded } from "../../src/plan/exclusions";
import { loadDeloadActive } from "../../src/settings/deload";
import { loadHistory, loadMemories } from "../../src/session/history";
import { loadProfile } from "../../src/settings/profile";
import { deviceStorage, loadDeviceSnapshot } from "../helpers/deviceSnapshot";
import { useMemoryStorage } from "../helpers/storage";

const SNAPSHOT = "2026-11-17-pixel10";
const NOW = new Date("2026-11-17T12:00:00Z");

describe(`device snapshot ${SNAPSHOT}`, () => {
  useMemoryStorage(() => {
    resetTemplateOverridesForTests();
    return deviceStorage(SNAPSHOT);
  });

  // The snapshot holds memory under the v1 key; boot migrates it to v2 first.
  beforeEach(() => {
    ensureMemoryMigrated(NOW);
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
      evaluation: "difficult", // stored as legacy "failed"; #110 reads it as difficult
      setCount: 15,
      exerciseIds: ["hf_71", "hf_84", "hf_87", "calf_raise", "wger_1605"],
    });
  });

  it("loads per-exercise memory with no session counters set", () => {
    const memories = loadMemories(NOW);
    const v1Ids = Object.keys(
      loadDeviceSnapshot(SNAPSHOT).localStorage["aurora.poc.memory.v1"] as object,
    );
    expect(v1Ids).toHaveLength(100);
    for (const id of v1Ids) {
      expect(memories[id]).toBeDefined();
    }
    // Still 100: the snapshot already holds a row for every id the migration or inference touches, so no inferred-only rows are added.
    expect(Object.keys(memories)).toHaveLength(100);
    const counted = Object.values(memories).filter(
      (m) => m.sessionsAtStandard > 0 || m.sessionsBelowFloor > 0,
    );
    expect(counted).toEqual([]);
    // Migration derives loggedTier from bestReps 60.
    expect(memories.calf_raise.skillTier).toBe("elite");
    expect(memories.calf_raise.bestReps).toBe(60);
    // Skipped in the session: no best reps. Its "intermediate" equals the plan level,
    // so migration cannot tell a pick from a plan write: it becomes planTier and is listed to confirm.
    expect(memories.hf_84.bestReps).toBeUndefined();
    expect(memories.hf_84.declaredTier).toBeUndefined();
    expect(memories.hf_84.planTier).toBe("intermediate");
    expect(loadLevelsToConfirm()).toContain("hf_84");
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

  it("Lower body · C no longer resolves its single-leg slot to Bulgarian split squat 4x18 (#112)", () => {
    const template = getPlanDay("day_a5192cfe6fc")!;
    const profile = loadProfile();
    const planned = planSession({ painJoints: [] }, templateToStarter(template), loadMemories(NOW), {
      history: loadHistory(),
      focus: template.focus,
      deloadActive: loadDeloadActive(),
      jointHistory: profile.jointHistory,
      equipment: profile.equipment,
      excluded: loadExcluded(),
    });
    const slot = planned.work.find((w) => w.slotId.endsWith("_single_leg"))!;
    const isBulgarian18 = slot.exerciseId === "bulgarian_split" && slot.dose.reps === 18;
    expect(isBulgarian18).toBe(false);
    // Today it resolves to Step-up 4x7 (beginner dose, rules skill_dose + hold).
    expect(slot.exerciseId).toBe("step_up");
  });
});
