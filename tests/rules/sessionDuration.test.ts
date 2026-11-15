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
  estimateTemplateCooldownSeconds,
  SESSION_HARD_CAP_MINUTES,
  warmupCooldownLabel,
  cooldownOfferLabel,
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
  it("keeps every seed template (warm-up + work) under the 60 min hard cap", () => {
    expect(SESSION_HARD_CAP_MINUTES).toBe(60);
    for (const template of SESSION_TEMPLATES) {
      const estimate = estimateSessionDuration(template);
      expect(estimate.withinHardCap, template.id).toBe(true);
      expect(estimate.totalMinutesRounded, template.id).toBeLessThanOrEqual(60);
      expect(estimate.warmupSeconds, template.id).toBeGreaterThanOrEqual(7 * 60);
    }
  });

  it("treats the template band as a soft target shown in the label", () => {
    const legs = SESSION_TEMPLATES.find((t) => t.id === "tmpl_legs")!;
    const band = legs.targetMinutes ?? DEFAULT_SESSION_TARGET;
    // Stretch the warm-up so the estimate leaves the band but stays under the cap.
    const { workSeconds } = estimateSessionDuration(legs);
    const long = estimateSessionDuration(legs, (band.maxMinutes + 5) * 60 - workSeconds);
    expect(long.withinTarget).toBe(false);
    expect(long.withinHardCap).toBe(true);
    expect(formatDurationLabel(long)).toMatch(/\(target \d+–\d+ min\)$/);
    expect(estimateSessionDuration(legs, 70 * 60).withinHardCap).toBe(false);
  });

  it("keeps the optional cool-down out of the session estimate", () => {
    const legs = SESSION_TEMPLATES.find((t) => t.id === "tmpl_legs")!;
    const estimate = estimateSessionDuration(legs);
    expect(estimate.totalSeconds).toBe(estimate.warmupSeconds + estimate.workSeconds);
    expect(estimateTemplateCooldownSeconds(legs)).toBeGreaterThan(0);
  });

  it("labels warm-up and cool-down for the Today / Plan preview", () => {
    const legs = SESSION_TEMPLATES.find((t) => t.id === "tmpl_legs")!;
    expect(warmupCooldownLabel(legs)).toBe("Warm-up 9 min · +4 min cool-down");
    const mobility = SESSION_TEMPLATES.find((t) => t.id === "tmpl_mobility")!;
    expect(warmupCooldownLabel(mobility)).toBe("Warm-up 7 min");
    expect(cooldownOfferLabel(255)).toBe("Cool-down · ~4 min");
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
