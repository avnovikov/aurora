import { describe, expect, it } from "vitest";
import { SESSION_TEMPLATES } from "../../src/data/seed";
import { collectTemplateTargetIds, isTemplateTarget } from "../../src/library/targets";

describe("collectTemplateTargetIds", () => {
  it("includes pistol, pull-up, and handstand targets from seed templates", () => {
    const ids = collectTemplateTargetIds(SESSION_TEMPLATES);
    expect(ids.has("pistol_squat")).toBe(true);
    expect(ids.has("pullup")).toBe(true);
    expect(ids.has("freestanding_hs")).toBe(true);
    expect(ids.has("hanging_knee_raise")).toBe(true);
  });
});

describe("isTemplateTarget", () => {
  it("marks only template target exercises", () => {
    const ids = collectTemplateTargetIds(SESSION_TEMPLATES);
    expect(isTemplateTarget("pullup", ids)).toBe(true);
    expect(isTemplateTarget("bodyweight_squat", ids)).toBe(false);
  });
});