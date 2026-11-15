import { describe, expect, it } from "vitest";
import { SESSION_TEMPLATES } from "../../src/data/seed";
import {
  lastConsecutiveSameZone,
  pickSlotExerciseForVariety,
} from "../../src/rules/consecutiveVariety";
import { planSession } from "../../src/rules/planSession";
import { templateToStarter } from "../../src/data/seed";
import type { HistoryEntry } from "../../src/domain/program";

describe("lastConsecutiveSameZone", () => {
  it("returns the latest history entry when focus matches", () => {
    const history: HistoryEntry[] = [
      {
        id: "1",
        completedAt: "2026-11-15T08:00:00.000Z",
        templateId: "tmpl_legs",
        templateName: "Legs",
        evaluation: "on_target",
        setCount: 10,
        exerciseIds: ["bodyweight_squat", "bulgarian_split", "hip_hinge"],
      },
    ];
    expect(lastConsecutiveSameZone(history, "legs")?.templateId).toBe(
      "tmpl_legs",
    );
  });

  it("ignores a latest session from a different zone", () => {
    const history: HistoryEntry[] = [
      {
        id: "1",
        completedAt: "2026-11-15T08:00:00.000Z",
        templateId: "tmpl_abs",
        templateName: "Abs / Core",
        evaluation: "on_target",
        setCount: 8,
        exerciseIds: ["hollow_hold"],
      },
    ];
    expect(lastConsecutiveSameZone(history, "legs")).toBeNull();
  });
});

describe("pickSlotExerciseForVariety", () => {
  const legs = SESSION_TEMPLATES.find((t) => t.id === "tmpl_legs")!;

  it("keeps the squat slot even when it was used yesterday", () => {
    const squat = legs.slots.find((slot) => slot.id === "legs_squat")!;
    const pick = pickSlotExerciseForVariety(
      squat,
      ["bodyweight_squat", "bulgarian_split"],
      new Set(),
    );
    expect(pick.exerciseId).toBe("bodyweight_squat");
    expect(pick.swapped).toBe(false);
  });

  it("swaps split squat away from yesterday's bulgarian", () => {
    const split = legs.slots.find((slot) => slot.id === "legs_split")!;
    const pick = pickSlotExerciseForVariety(
      split,
      ["bodyweight_squat", "bulgarian_split", "hip_hinge", "nordic_curl", "calf_raise"],
      new Set(["bodyweight_squat"]),
    );
    expect(pick.exerciseId).not.toBe("bulgarian_split");
    expect(pick.swapped).toBe(true);
  });
});

describe("planSession consecutive Legs", () => {
  it("repeats only squat across two Legs days", () => {
    const legs = SESSION_TEMPLATES.find((t) => t.id === "tmpl_legs")!;
    const day1 = planSession(
      { painJoints: [] },
      templateToStarter(legs),
      {},
      { focus: "legs", history: [] },
    );
    const history: HistoryEntry[] = [
      {
        id: "1",
        completedAt: "2026-11-15T08:00:00.000Z",
        templateId: "tmpl_legs",
        templateName: "Legs",
        evaluation: "on_target",
        setCount: day1.work.length,
        exerciseIds: day1.work.map((item) => item.exerciseId),
      },
    ];
    const day2 = planSession(
      { painJoints: [] },
      templateToStarter(legs),
      {},
      { focus: "legs", history },
    );

    const day1Ids = new Set(day1.work.map((item) => item.exerciseId));
    const squatDay1 = day1.work.find((item) => item.slotId === "legs_squat");
    const squatDay2 = day2.work.find((item) => item.slotId === "legs_squat");
    expect(squatDay2?.exerciseId).toBe(squatDay1?.exerciseId);

    for (const item of day2.work) {
      if (item.slotId === "legs_squat") {
        continue;
      }
      expect(day1Ids.has(item.exerciseId)).toBe(false);
    }
  });
});
