import { describe, expect, it } from "vitest";
import { DOODLE_SPECS } from "../../src/doodles/specs";
import { renderDoodleSvg } from "../../src/doodles/renderSvg";
import type { DoodleSpec, Pose } from "../../src/doodles/rig";
import { dualViewGuards, heldGuards, partnerGuards, validateSpec } from "../../src/doodles/validate";

const STAND: Pose = {
  pelvis: [0, -172],
  chest: [0, -252],
  feet: { near: [0, 0], far: [0, 0] },
  hands: { near: [60, -211], far: [60, -211] },
  wrists: { near: 10, far: 0 },
};
const spec = (extra: Partial<DoodleSpec> = {}): DoodleSpec => ({
  id: "test_review",
  slug: "test-review",
  title: "Test review",
  views: ["side", "front"],
  frames: [{ hold: 0, pose: STAND }],
  ...extra,
});

describe("fadeBehind on side + top", () => {
  const kb = DOODLE_SPECS.find((s) => s.id === "wger_2668")!;
  const top: DoodleSpec = { ...kb, views: ["side", "top"] };

  it("is accepted by the guard", () => {
    expect(dualViewGuards({ ...top, kettlebell: undefined, fadeBehind: true }).some((e) => e.includes("fadeBehind"))).toBe(false);
  });

  it("reaches the side panel (the bell goes pale behind the body)", () => {
    expect(renderDoodleSvg({ ...top, fadeBehind: true })).not.toBe(renderDoodleSvg({ ...top, fadeBehind: undefined }));
  });
});

describe("wrist angles on re-solved arms", () => {
  it("rejects a wrist angle with a stick or towel in two views", () => {
    expect(heldGuards(spec({ stick: {} }))).toContain("frame 0: stick re-solves the arms between keyframes with a straight wrist; drop pose.wrists.near");
    const towel = heldGuards(spec({ towel: {}, frames: [{ hold: 0, pose: STAND, sideways: { wrists: { far: 5 } } }] }));
    expect(towel.some((e) => e.endsWith("drop pose.wrists.far"))).toBe(true);
    expect(towel.some((e) => e.endsWith("drop sideways.wrists.far"))).toBe(true);
  });

  it("allows it in one view, where the 2D rig keeps the wrists", () => {
    expect(heldGuards(spec({ stick: {}, views: undefined }))).toEqual([]);
  });

  it("rejects a wrist angle on a partner's held hand only", () => {
    const partner = (hand: "near" | "far"): DoodleSpec["partner"] => ({ holds: [{ hand, on: "ankle.near" }], frames: [{ pose: { ...STAND, hands: { [hand === "near" ? "far" : "near"]: [60, -211] } } }] });
    expect(partnerGuards(spec({ partner: partner("near") }))).toContain("partner: frame 0: a held hand's arm is re-solved onto its joint with a straight wrist; drop pose.wrists.near");
    expect(partnerGuards(spec({ partner: { ...partner("near"), frames: [{ pose: { ...STAND, wrists: { far: 10 }, hands: { far: [60, -211] } } }] } }))).toEqual([]);
  });
});

describe("focus.panel against views", () => {
  // hf_167 (wrist circles) zooms on the front panel.
  it("rejects a panel the spec doesn't draw", () => {
    expect(dualViewGuards(spec({ id: "hf_167", views: ["side", "top"] }))).toContain('focus.panel "front" isn\'t one of views ["side","top"]: the inset would be dropped');
    expect(dualViewGuards(spec({ id: "hf_167" })).some((e) => e.includes("focus.panel"))).toBe(false);
  });
});

describe("partner end-turn guards", () => {
  it("checks the partner's sideways toe and wrist angles up front", () => {
    const partner = { frames: [{ pose: STAND, sideways: { toes: { far: 70 } } }] };
    expect(dualViewGuards(spec({ partner }))).toContain("partner: frame 0: sideways.toes.far 70° is past 60°");
  });
});

describe("every drawn spec passes the new guards", () => {
  it("validates", () => {
    const failing = DOODLE_SPECS.flatMap((s) => [...dualViewGuards(s), ...heldGuards(s), ...partnerGuards(s)].map((e) => `${s.slug}: ${e}`));
    expect(failing).toEqual([]);
    expect(validateSpec(DOODLE_SPECS.find((s) => s.id === "hf_167")!).ok).toBe(true);
  });
});
