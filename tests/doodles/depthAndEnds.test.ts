import { describe, expect, it } from "vitest";
import { DOODLE_SPECS } from "../../src/doodles/specs";
import { behindOf, dualLayout, isBehind } from "../../src/doodles/renderDual";
import { renderDoodleSvg } from "../../src/doodles/renderSvg";
import { BONES, solvePose, type DoodleSpec, type Pose, type Sideways } from "../../src/doodles/rig";
import { dist3, sampleTimeline3, solveKeyframe3, type Figure3 } from "../../src/doodles/rig3d";
import { endTurnGuards, validateSpec } from "../../src/doodles/validate";

const STAND: Pose = {
  pelvis: [0, -172],
  chest: [0, -252],
  feet: { near: [0, 0], far: [0, 0] },
  toes: { near: 30, far: 0 },
  hands: { near: [60, -211], far: [60, -211] },
  elbows: { near: { at: [3, -211] }, far: { at: [3, -211] } },
  wrists: { near: 0, far: 0 },
};
const solve = (sw: Sideways | undefined, pose: Pose = STAND): Figure3 => solveKeyframe3(solvePose(pose), pose, sw);
const spec = (frames: DoodleSpec["frames"], extra: Partial<DoodleSpec> = {}): DoodleSpec => ({ id: "test_depth", slug: "test-depth", title: "Test depth", views: ["side", "front"], frames, ...extra });

describe("sideways toe and wrist angles", () => {
  it("leaves the foot and hand in the side plane without an angle", () => {
    expect(solve({ toes: { near: 0 }, wrists: { near: 0 } })).toEqual(solve(undefined));
  });

  it("turns the foot out of the side plane, keeping its length and its side-view direction", () => {
    const leg = solve({ toes: { near: 40 } }).legs.near;
    const flat = solve(undefined).legs.near;
    expect(dist3(leg.joint, leg.end)).toBeCloseTo(BONES.foot, 6);
    expect(leg.end[2] - leg.joint[2]).toBeCloseTo(BONES.foot * Math.sin((40 * Math.PI) / 180), 6);
    // Shorter in the side view, same direction there.
    const side = Math.hypot(leg.end[0] - leg.joint[0], leg.end[1] - leg.joint[1]);
    expect(side).toBeCloseTo(BONES.foot * Math.cos((40 * Math.PI) / 180), 6);
    const dir = (l: typeof leg): number => Math.atan2(l.end[1] - l.joint[1], l.end[0] - l.joint[0]);
    expect(dir(leg)).toBeCloseTo(dir(flat), 6);
  });

  it("turns a bent hand sideways (- towards the near side)", () => {
    const arm = solve({ wrists: { near: -50 } }).arms.near;
    expect(dist3(arm.joint, arm.end)).toBeCloseTo(BONES.hand, 6);
    expect(arm.end[2] - arm.joint[2]).toBeCloseTo(-BONES.hand * Math.sin((50 * Math.PI) / 180), 6);
  });

  it("blends the angle over a transition", () => {
    const timeline = sampleTimeline3(spec([
      { hold: 0, pose: STAND, sideways: { toes: { near: -40 } } },
      { hold: 0, pose: STAND, sideways: { toes: { near: 40 } } },
    ]));
    const z = timeline.poses.map((f) => f.legs.near.end[2] - f.legs.near.joint[2]);
    const half = timeline.keyframeIndex[0] + 8;
    expect(z[timeline.keyframeIndex[0]]).toBeLessThan(-10);
    expect(z[timeline.keyframeIndex[1]]).toBeGreaterThan(10);
    expect(Math.abs(z[half])).toBeLessThan(Math.abs(z[timeline.keyframeIndex[1]]));
  });

  it("rejects angles past the limit and a wrist angle on a straight hand", () => {
    const straight: Pose = { ...STAND, wrists: undefined };
    const errors = endTurnGuards([{ pose: straight, sideways: { toes: { far: 70 }, wrists: { near: 10 } } }]);
    expect(errors.some((e) => e.includes("sideways.toes.far 70"))).toBe(true);
    expect(errors.some((e) => e.includes("needs pose.wrists.near"))).toBe(true);
    expect(endTurnGuards([{ pose: STAND, sideways: { toes: { far: 30 }, wrists: { near: 10 } } }])).toEqual([]);
  });
});

describe("fadeBehind (hand-off bell and forearms behind the body)", () => {
  const kb = DOODLE_SPECS.find((s) => s.id === "wger_2668")!;

  it("tells a point behind the torso from one beside it", () => {
    const f = solve(undefined);
    expect(isBehind(f, [-36, -170, 0], "front")).toBe(true);
    expect(isBehind(f, [2, -176, 54], "front")).toBe(false);
    expect(isBehind(f, [-36, -176, -54], "front")).toBe(false);
    // Above the head nothing hides it.
    expect(isBehind(f, [-20, -360, 0], "front")).toBe(false);
    // Side panel: the far side is behind.
    expect(isBehind(f, [2, -176, 54], "side")).toBe(true);
  });

  it("marks the bell and the reaching forearms behind while they pass behind the back", () => {
    const timeline = sampleTimeline3(kb);
    const behind = behindOf(kb, timeline.poses, "front")!;
    const back = timeline.keyframeIndex[2];
    expect(behind.bell![back]).toBe(true);
    expect(behind.forearms!.near[back] && behind.forearms!.far[back]).toBe(true);
    expect(behind.bell![timeline.keyframeIndex[0]]).toBe(false);
    expect(behindOf({ ...kb, fadeBehind: undefined }, timeline.poses, "front")).toBeUndefined();
  });

  it("draws them pale behind the body", () => {
    const svg = renderDoodleSvg(kb);
    expect(svg).toMatch(/<animate attributeName="opacity" values="[^"]*0\.5[^"]*"/);
    expect(validateSpec(kb).ok).toBe(true);
  });

  it("needs two views", () => {
    const one = spec([{ hold: 0, pose: STAND }], { fadeBehind: true, views: undefined });
    expect(validateSpec(one).errors).toContain('fadeBehind needs views: ["side", "front"] or ["side", "top"]');
  });
});

describe("zoom inset on a two-view doodle (focus.panel)", () => {
  it("adds an inset right of both panels", () => {
    const wrists = DOODLE_SPECS.find((s) => s.id === "hf_167")!;
    const layout = dualLayout(wrists);
    expect(layout.inset).toBeDefined();
    expect(layout.inset!.cx).toBeGreaterThan(layout.labels.front);
    expect(renderDoodleSvg(wrists)).toContain('clip-path="url(#focus-wrist-circles)"');
  });

  it("has no inset without focus.panel", () => {
    expect(dualLayout(spec([{ hold: 0, pose: STAND }])).inset).toBeUndefined();
  });
});
