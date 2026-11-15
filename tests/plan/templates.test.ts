import { beforeEach, describe, expect, it } from "vitest";
import {
  applyOverride,
  clearTemplateOverride,
  resetTemplateOverridesForTests,
  resolveTemplate,
  setSlotExercise,
  setTemplateTarget,
} from "../../src/plan/templates";
import { SESSION_TEMPLATES } from "../../src/data/seed";

describe("template procedure overrides", () => {
  beforeEach(() => {
    resetTemplateOverridesForTests();
  });

  it("defaults Bars to pull-up work and muscle-up target", () => {
    const bars = resolveTemplate("tmpl_bars");
    expect(bars.targetExerciseIds).toEqual(["muscle_up"]);
    expect(bars.slots.map((slot) => slot.exerciseId)).toEqual([
      "pullup_dead_hang",
      "scapular_pull",
      "pullup",
      "hollow_hold",
    ]);
  });

  it("lets the user change Bars target and a slot exercise", () => {
    setTemplateTarget("tmpl_bars", "pullup");
    setSlotExercise("tmpl_bars", "bars_pull", "muscle_up");
    const bars = resolveTemplate("tmpl_bars");
    expect(bars.targetExerciseIds).toEqual(["pullup"]);
    expect(bars.slots.find((slot) => slot.id === "bars_pull")?.exerciseId).toBe(
      "muscle_up",
    );
  });

  it("resets overrides back to seed", () => {
    setTemplateTarget("tmpl_bars", "pullup");
    clearTemplateOverride("tmpl_bars");
    expect(resolveTemplate("tmpl_bars").targetExerciseIds).toEqual(["muscle_up"]);
  });

  it("applyOverride keeps untouched slots", () => {
    const base = SESSION_TEMPLATES.find((item) => item.id === "tmpl_legs")!;
    const next = applyOverride(base, {
      slotExerciseIds: { legs_squat: "pistol_squat" },
    });
    expect(next.slots[0].exerciseId).toBe("pistol_squat");
    expect(next.slots[1].exerciseId).toBe("bulgarian_split");
    expect(next.slots[2].exerciseId).toBe("hip_hinge");
  });
});
