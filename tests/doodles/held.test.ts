import { describe, expect, it } from "vitest";
import { heldLines, STICK_OVERHANG, stickLine, TOWEL_WRAP, towelLine } from "../../src/doodles/gear";
import { dualLayout } from "../../src/doodles/renderDual";
import { figureExtent, renderDoodleSvg, specViewBox } from "../../src/doodles/renderSvg";
import { topLayout } from "../../src/doodles/renderTop";
import { BONES, dist, sampleTimeline, solvePose, type DoodleSpec, type Point, type Pose } from "../../src/doodles/rig";
import { dist3, sampleTimeline3 } from "../../src/doodles/rig3d";
import { heldGuards, validateSpec } from "../../src/doodles/validate";

const SHOULDER: Point = [0, -270];
const GRIP = 70;
/** Straight arms at `deg` round the shoulder with the hands GRIP either side (the 3D reach foreshortened in the side view). */
const FLAT = Math.sqrt((BONES.upperArm + BONES.forearm + BONES.hand - 0.5) ** 2 - (GRIP - 22) ** 2);
const stickPose = (deg: number): Pose => {
  const r = (deg * Math.PI) / 180;
  const hand: Point = [SHOULDER[0] + Math.cos(r) * FLAT, SHOULDER[1] + Math.sin(r) * FLAT];
  return { pelvis: [0, -172], chest: [0, -252], hands: { near: hand, far: hand }, feet: { near: [6, 0], far: [0, 0] }, toes: { near: 0, far: 0 } };
};
const grip = { hands: { near: -GRIP, far: GRIP } };

/** A shoulder dislocate in 90° steps: front of the hips, overhead, behind, overhead. */
const DISLOCATE: DoodleSpec = {
  id: "test_dislocate",
  slug: "test-dislocate",
  title: "Test dislocate",
  views: ["side", "front"],
  stick: {},
  frames: [
    { pose: stickPose(70), hold: 0.3, sideways: grip },
    { pose: stickPose(-90), hold: 0.3, sideways: grip },
    { pose: stickPose(-160), hold: 0, sideways: grip },
    { pose: stickPose(118), hold: 0.3, sideways: grip },
    { pose: stickPose(-160), hold: 0, sideways: grip },
    { pose: stickPose(-90), hold: 0.3, sideways: grip },
  ],
};

/** Lying face up, the near leg raised, a towel round its foot held in both hands. */
const towelPose = (hand: Point, ankle: Point): Pose => ({
  pelvis: [0, -22],
  chest: [-78, -18],
  head: [-133, -24],
  spine: { bend: -1 },
  hands: { near: hand, far: hand },
  elbows: { near: { bend: 1 }, far: { bend: 1 } },
  feet: { near: ankle, far: [173, -8] },
  toes: { far: -80 },
});
const TOWEL: DoodleSpec = {
  id: "test_towel",
  slug: "test-towel",
  title: "Test towel",
  towel: { around: "near-foot" },
  frames: [
    { pose: towelPose([-20, -110], [54, -187]), hold: 0.3 },
    { pose: towelPose([-40, -100], [-10, -194]), hold: 0.3 },
  ],
};

describe("held stick", () => {
  const pose = solvePose({ pelvis: [0, -172], chest: [0, -252], hands: { near: [60, -200], far: [60, -150] } });

  it("runs through both hand tips, the overhang past each", () => {
    const [a, b] = stickLine(DISLOCATE, pose);
    expect(dist(a, pose.arms.near.end)).toBeCloseTo(STICK_OVERHANG, 9);
    expect(dist(b, pose.arms.far.end)).toBeCloseTo(STICK_OVERHANG, 9);
    expect(dist(a, b)).toBeCloseTo(dist(pose.arms.near.end, pose.arms.far.end) + 2 * STICK_OVERHANG, 9);
    // The true (3D) hand distance foreshortens the overhang with the stick.
    const [c] = stickLine({ ...DISLOCATE, stick: { overhang: 30 } }, pose, 100);
    expect(dist(c, pose.arms.near.end)).toBeCloseTo((30 * dist(pose.arms.near.end, pose.arms.far.end)) / 100, 6);
    // Hands together (seen end-on): a dot on the hands.
    const together = solvePose({ pelvis: [0, -172], chest: [0, -252], hands: { near: [60, -200], far: [60, -200] } });
    const [d, e] = stickLine(DISLOCATE, together);
    expect(d).toEqual(e);
  });

  it("two views: keeps its grip width between keyframes (hands in planes of constant z), across the front panel", () => {
    const timeline = sampleTimeline3(DISLOCATE);
    const gaps = timeline.poses.map((f) => dist3(f.arms.near.end, f.arms.far.end));
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(1);
    expect(validateSpec(DISLOCATE)).toMatchObject({ ok: true });
    const layout = dualLayout(DISLOCATE);
    const [a, b] = layout.extras.front.held![0];
    expect(dist(a, b)).toBeCloseTo(2 * GRIP + 2 * STICK_OVERHANG, 0);
    expect(a[1]).toBeCloseTo(b[1], 6);
  });

  it("front panel: drawn behind the torso and again over the figure while in front of it", () => {
    const layout = dualLayout(DISLOCATE);
    const shown = layout.extras.front.heldInFront!;
    const { keyframeIndex } = sampleTimeline3(DISLOCATE);
    expect(shown[keyframeIndex[0]]).toBe(true);
    expect(shown[keyframeIndex[3]]).toBe(false);
    const svg = renderDoodleSvg(DISLOCATE);
    // Side panel once, front panel twice (behind the torso, and over the figure while in front).
    expect(svg.match(/<polyline [^>]*stroke-width="5"/g)).toHaveLength(3);
    expect(svg).toMatch(/stroke-width="5" opacity="1"><animate attributeName="points"[^>]*\/><animate attributeName="opacity"/);
  });

  it("the bounds take in the stick's ends (both panels)", () => {
    const layout = dualLayout(DISLOCATE);
    const ends = layout.extras.front.held!.flat().map(([x, y]): Point => [x + layout.frontShift, y]);
    for (const [x, y] of ends) {
      expect(x).toBeLessThan(layout.view.x + layout.view.w);
      expect(x).toBeGreaterThan(layout.view.x);
      expect(y).toBeGreaterThan(layout.view.y);
    }
    const top = topLayout({ ...DISLOCATE, views: ["side", "top"] });
    expect(top.extras.top.held).toHaveLength(top.top.length);
  });

  it("rejects a stick whose grip width changes, hands together in two views, and a stick through the head", () => {
    const wider: DoodleSpec = { ...DISLOCATE, frames: DISLOCATE.frames.map((frame, k) => (k === 1 ? { ...frame, sideways: { hands: { near: -100, far: 100 } } } : frame)) };
    expect(validateSpec(wider).errors).toEqual(expect.arrayContaining([expect.stringMatching(/^stick: grip width changes by/)]));
    const together: DoodleSpec = { ...DISLOCATE, frames: DISLOCATE.frames.map((frame) => ({ ...frame, sideways: { hands: { near: 0, far: 0 } } })) };
    expect(validateSpec(together).errors).toEqual(expect.arrayContaining([expect.stringMatching(/^frame 0: stick needs the hands at least 20 apart/)]));
    // One view: hands either side of the face at eye level, so the stick crosses the head.
    const face: DoodleSpec = {
      id: "t",
      slug: "t",
      title: "t",
      stick: {},
      frames: [{ pose: { pelvis: [0, -172], chest: [0, -252], hands: { near: [-20, -320], far: [40, -300] } }, hold: 0.3 }],
    };
    expect(validateSpec(face).errors).toContain("stick passes through the head (t=0s)");
  });
});

describe("towel", () => {
  it("taut from hand to hand, or hand to the sole of a foot and back", () => {
    const pose = sampleTimeline(TOWEL).poses[0];
    const [a, wrap, b] = towelLine(TOWEL, pose);
    const leg = pose.legs.near;
    expect(a).toEqual(pose.arms.near.end);
    expect(b).toEqual(pose.arms.far.end);
    expect(wrap[0]).toBeCloseTo(leg.joint[0] + (leg.end[0] - leg.joint[0]) * TOWEL_WRAP, 9);
    expect(towelLine({ ...TOWEL, towel: {} }, pose)).toEqual([pose.arms.near.end, pose.arms.far.end]);
    expect(towelLine({ ...TOWEL, towel: { around: "far-foot" } }, pose)[1][0]).toBeGreaterThan(150);
  });

  it("draws in the accent colour, inside the bounds, and passes the validator", () => {
    expect(validateSpec(TOWEL)).toMatchObject({ ok: true });
    const svg = renderDoodleSvg(TOWEL);
    expect(svg).toMatch(/<polyline points="[^"]+" style="stroke:var\(--doodle-focus, #c4a574\)" stroke-width="5">/);
    const poses = sampleTimeline(TOWEL).poses;
    const lines = heldLines(TOWEL, poses)!;
    const box = specViewBox(TOWEL);
    for (const [x, y] of lines.flat()) {
      expect(x).toBeGreaterThan(box.x);
      expect(y).toBeGreaterThan(box.y);
    }
    expect(figureExtent(poses, [], TOWEL, "side", lines.flat()).y).toBeLessThanOrEqual(Math.min(...lines.flat().map((p) => p[1])));
  });

  it("rejects a towel that goes slack or stretches", () => {
    const slack: DoodleSpec = { ...TOWEL, frames: [TOWEL.frames[0], { ...TOWEL.frames[1], pose: towelPose([-10, -150], [-10, -194]) }] };
    expect(validateSpec(slack).errors).toEqual(expect.arrayContaining([expect.stringMatching(/^towel: length changes by .*keep it taut$/)]));
  });

  it("guards: one thing between the hands, no negative overhang", () => {
    expect(heldGuards({ ...TOWEL, stick: {} })).toEqual(["only one of stick, towel and handBand (got stick, towel)"]);
    expect(heldGuards({ ...TOWEL, towel: undefined, stick: { overhang: -1 } })).toEqual(["stick.overhang is negative"]);
    expect(heldGuards(TOWEL)).toEqual([]);
  });
});
