import { describe, expect, it } from "vitest";
import { SESSION_TEMPLATES, SEED_GRAPH } from "../../src/data/seed";
import { resolveExerciseTiming } from "../../src/domain/timing";
import { templateToStarter } from "../../src/data/seed";
import { planSession } from "../../src/rules/planSession";
import {
  DEFAULT_SESSION_TARGET,
  estimatePlannedSessionSeconds,
  estimateSessionDuration,
  estimateSlotSeconds,
  formatDurationLabel,
} from "../../src/rules/sessionDuration";
import type { Readiness } from "../../src/domain/types";

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
  it("keeps every seed template inside its own target band", () => {
    for (const template of SESSION_TEMPLATES) {
      const estimate = estimateSessionDuration(template);
      const band = template.targetMinutes ?? DEFAULT_SESSION_TARGET;
      expect(estimate.withinTarget).toBe(true);
      expect(estimate.totalMinutesRounded).toBeGreaterThanOrEqual(band.minMinutes);
      expect(estimate.totalMinutesRounded).toBeLessThanOrEqual(band.maxMinutes);
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

  it("estimates a positive wall-clock total for a planned session", () => {
    const readiness: Readiness = {
      sleepQuality: "good",
      restingHrBpm: 58,
      painJoints: [],
    };
    const legs = SESSION_TEMPLATES.find((t) => t.id === "tmpl_legs")!;
    const planned = planSession(readiness, templateToStarter(legs), {});
    const seconds = estimatePlannedSessionSeconds(planned);
    expect(seconds).toBeGreaterThan(60);
  });
});
