import { beforeEach, describe, expect, it } from "vitest";
import type { JointHistoryEntry } from "../../src/domain/program";
import { planSession } from "../../src/rules/planSession";
import { assessExercise } from "../../src/safety/jointCare";
import { chooseSuitableExercise } from "../../src/safety/suitableExercise";
import { movementRisks } from "../../src/safety/movementRisk";
import { loadProfile, saveProfile } from "../../src/settings/profile";
import { describeEntry, toggleJoint, updateEntry } from "../../src/settings/jointHistory";

const SHOULDER: JointHistoryEntry = { joint: "shoulder", side: "left", kind: "dislocation" };
const KNEES: JointHistoryEntry = { joint: "knee", side: "both", kind: "other" };

describe("movementRisks", () => {
  it("tags the named cases", () => {
    expect(movementRisks("Skin the Cat")).toContain("shoulder_end_range");
    expect(movementRisks("Cossack squat")).toContain("knee_lateral");
    expect(movementRisks("Lateral Lunge")).toContain("knee_lateral");
    expect(movementRisks("Plank hip dips").size).toBe(0);
    expect(movementRisks("Push-Up").size).toBe(0);
  });
});

describe("assessExercise", () => {
  it("avoids skin the cat after a shoulder dislocation, only cautions dips", () => {
    expect(assessExercise("Skin the Cat", [SHOULDER]).avoid).toBe(true);
    const dip = assessExercise("Parallel Bar Dip", [SHOULDER]);
    expect(dip.avoid).toBe(false);
    expect(dip.cautions[0]).toMatch(/left shoulder/);
  });

  it("avoids lateral knee moves, cautions deep flexion", () => {
    expect(assessExercise("Cossack squat", [KNEES]).avoid).toBe(true);
    expect(assessExercise("Pistol squat", [KNEES])).toMatchObject({ avoid: false });
    expect(assessExercise("Pistol squat", [KNEES]).cautions).toHaveLength(1);
  });

  it("avoids impact only after structural knee injury", () => {
    expect(assessExercise("Box Jump", [KNEES]).avoid).toBe(false);
    const acl: JointHistoryEntry = { joint: "knee", side: "left", kind: "ligament" };
    expect(assessExercise("Box Jump", [acl]).avoid).toBe(true);
  });

  it("does nothing without history", () => {
    expect(assessExercise("Skin the Cat", [])).toEqual({ avoid: false, cautions: [] });
  });
});

describe("chooseSuitableExercise", () => {
  it("swaps an avoided move for a same-pattern safe one", () => {
    const choice = chooseSuitableExercise(
      { id: "cossack_squat", name: "Cossack squat", pattern: "squat" },
      [KNEES],
    );
    expect(choice.swappedFrom).toBe("Cossack squat");
    expect(assessExercise(choice.name, [KNEES]).avoid).toBe(false);
  });

  it("keeps a safe move", () => {
    const choice = chooseSuitableExercise(
      { id: "bodyweight_squat", name: "Bodyweight squat", pattern: "squat" },
      [KNEES],
    );
    expect(choice.swappedFrom).toBeUndefined();
  });
});

describe("planSession with joint history", () => {
  it("never plans an avoided move and flags cautions", () => {
    const session = planSession({ painJoints: [], sleepQuality: "good" }, undefined, undefined, {
      jointHistory: [SHOULDER, KNEES],
    });
    for (const item of session.work) {
      expect(assessExercise(item.exerciseName, [SHOULDER, KNEES]).avoid).toBe(false);
    }
  });

  it("is unchanged without history", () => {
    const session = planSession({ painJoints: [], sleepQuality: "good" });
    expect(session.work.every((item) => !item.ruleIds.includes("joint_history"))).toBe(true);
  });
});

describe("joint history editing and storage", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    globalThis.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    } as unknown as Storage;
  });

  it("toggles and updates entries", () => {
    let entries = toggleJoint([], "shoulder");
    entries = updateEntry(entries, "shoulder", { side: "left", kind: "dislocation" });
    expect(describeEntry(entries[0]!)).toBe("left shoulder");
    expect(toggleJoint(entries, "shoulder")).toEqual([]);
  });

  it("migrates a profile saved before joint history existed", () => {
    localStorage.setItem(
      "aurora.poc.profile.v1",
      JSON.stringify({ bodyweightKg: 80, equipment: ["body"], voiceMuted: false }),
    );
    const profile = loadProfile();
    expect(profile.jointHistory).toEqual([]);
    expect(profile.setupDone).toBe(false);
  });

  it("round-trips and rejects a malformed history", () => {
    saveProfile({ ...loadProfile(), jointHistory: [SHOULDER], setupDone: true });
    expect(loadProfile().jointHistory).toEqual([SHOULDER]);
    expect(() =>
      saveProfile({ ...loadProfile(), jointHistory: [{ joint: "x" }] as never }),
    ).toThrow(/jointHistory/);
  });
});
