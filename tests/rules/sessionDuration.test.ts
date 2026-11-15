import { describe, expect, it } from "vitest";
import { SESSION_TEMPLATES, SEED_GRAPH } from "../../src/data/seed";
import { resolveExerciseTiming } from "../../src/domain/timing";
import {
  estimateSessionDuration,
  estimateSlotSeconds,
  formatDurationLabel,
} from "../../src/rules/sessionDuration";

describe("resolveExerciseTiming", () => {
  it("treats isometric seed holds as effort hold", () => {
    const timing = resolveExerciseTiming(SEED_GRAPH.hollow_hold);
    expect(timing.effort).toBe("hold");
    expect(timing.secondsPerRep).toBe(1);
  });

  it("uses ~3.5s tempo for dynamic strength work", () => {
    const timing = resolveExerciseTiming(SEED_GRAPH.pullup);
    expect(timing.effort).toBe("reps");
    expect(timing.secondsPerRep).toBe(3.5);
    expect(timing.defaultRestSeconds).toBe(120);
  });
});

describe("estimateSessionDuration", () => {
  it("keeps every seed template inside the 30–45 min band", () => {
    for (const template of SESSION_TEMPLATES) {
      const estimate = estimateSessionDuration(template);
      expect(estimate.withinTarget).toBe(true);
      expect(estimate.totalMinutesRounded).toBeGreaterThanOrEqual(30);
      expect(estimate.totalMinutesRounded).toBeLessThanOrEqual(45);
    }
  });

  it("counts hold slots as wall-clock seconds in dose.reps", () => {
    const hollow = SESSION_TEMPLATES.find((t) => t.id === "tmpl_abs")!.slots.find(
      (slot) => slot.id === "core_hollow",
    )!;
    // 4 sets × 30s + 3 × 45s rest = 120 + 135 = 255
    expect(estimateSlotSeconds(hollow)).toBe(255);
  });

  it("formats an in-band estimate without the target suffix", () => {
    const legs = SESSION_TEMPLATES.find((t) => t.id === "tmpl_legs")!;
    expect(formatDurationLabel(estimateSessionDuration(legs))).toMatch(
      /^≈ \d+ min$/,
    );
  });
});
