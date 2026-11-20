import { describe, expect, it } from "vitest";
import { faceMarks3 } from "../../src/doodles/face";
import { project } from "../../src/doodles/project";
import { BONES, solvePose, type DoodleSpec, type Pose, type Side, type Sideways } from "../../src/doodles/rig";
import { blendTurn, dist3, sampleTimeline3, solveKeyframe3, turnOf, type Figure3, type Point3 } from "../../src/doodles/rig3d";
import { dualViewGuards, turnGuards, validateSpec } from "../../src/doodles/validate";

const SIDES: Side[] = ["near", "far"];
const STAND: Pose = { pelvis: [0, -172], chest: [0, -252], feet: { near: [0, 0], far: [0, 0] }, toes: { near: 0, far: 0 } };
/** Shoulder centre of STAND: 18 above the chest. */
const CENTRE: Point3 = [0, -270, 0];
const solve = (sw: Sideways | undefined, pose: Pose = STAND): Figure3 => solveKeyframe3(solvePose(pose), pose, sw);
const rad = (d: number): number => (d * Math.PI) / 180;

const allBones = (f: Figure3): [number, number][] => [
  [dist3(f.pelvis, f.waist), BONES.pelvisWaist],
  [dist3(f.waist, f.chest), BONES.waistChest],
  [dist3(f.chest, f.neck), BONES.chestNeck],
  [dist3(f.neck, f.head), BONES.neckHead],
  ...SIDES.flatMap((s): [number, number][] => [
    [dist3(f.arms[s].root, f.arms[s].mid), BONES.upperArm],
    [dist3(f.arms[s].mid, f.arms[s].joint), BONES.forearm],
    [dist3(f.arms[s].joint, f.arms[s].end), BONES.hand],
    [dist3(f.legs[s].root, f.legs[s].mid), BONES.thigh],
    [dist3(f.legs[s].mid, f.legs[s].joint), BONES.shin],
    [dist3(f.legs[s].joint, f.legs[s].end), BONES.foot],
  ]),
];

const spec = (frames: DoodleSpec["frames"], views: DoodleSpec["views"] = ["side", "front"]): DoodleSpec => ({ id: "test_turn", slug: "test-turn", title: "Test turn", views, frames });

describe("spine roll (sideways.twist, hipTwist)", () => {
  it("leaves a figure without a turn exactly as before", () => {
    const plain = solve(undefined);
    const zero = solve({ twist: 0, hipTwist: 0, shoulders: { near: { up: 0 } } });
    expect(zero).toEqual(plain);
    expect(plain.across).toBeUndefined();
    expect(plain.arms.far.root).toEqual([0, -270, 22]);
  });

  it("turns the shoulder line about the spine, + bringing the far shoulder forward", () => {
    const f = solve({ twist: 40 });
    const t = rad(40);
    for (let i = 0; i < 3; i += 1) {
      expect(f.arms.far.root[i]).toBeCloseTo([CENTRE[0] + 22 * Math.sin(t), CENTRE[1], 22 * Math.cos(t)][i], 9);
      expect(f.arms.near.root[i]).toBeCloseTo([CENTRE[0] - 22 * Math.sin(t), CENTRE[1], -22 * Math.cos(t)][i], 9);
    }
    // The spine and hips stay put.
    expect(f.chest).toEqual(solve(undefined).chest);
    expect(f.legs.near.root).toEqual(solve(undefined).legs.near.root);
  });

  it("separates the shoulders fore and aft in the side view, narrows them in the front view, turns the line in the top view", () => {
    const f = solve({ twist: 60 });
    const [side, front, top] = (["side", "front", "top"] as const).map((v) => project(f, v));
    expect(side.arms.far.root[0] - side.arms.near.root[0]).toBeCloseTo(44 * Math.sin(rad(60)), 9);
    expect(front.arms.far.root[0] - front.arms.near.root[0]).toBeCloseTo(44 * Math.cos(rad(60)), 9);
    const line = [top.arms.far.root[0] - top.arms.near.root[0], top.arms.far.root[1] - top.arms.near.root[1]];
    // From above the far shoulder sits forward (+x) and up the panel (-z down): the line turned 60° off the z axis.
    expect((Math.atan2(line[0], -line[1]) * 180) / Math.PI).toBeCloseTo(60, 6);
  });

  it("keeps true bone lengths with the arms pinned from the turned shoulders", () => {
    const sw: Sideways = { twist: 50, hands: { near: -60, far: 60 } };
    const pose: Pose = { ...STAND, hands: { near: [-100, -270], far: [100, -270] } };
    for (const [actual, expected] of allBones(solve(sw, pose))) expect(actual).toBeCloseTo(expected, 6);
  });

  it("stacks the shoulders and hips vertically on a side-lying figure (roll 90 on a horizontal spine)", () => {
    const lying: Pose = { pelvis: [0, -24], chest: [-80, -24], feet: { near: [170, -20], far: [170, -10] } };
    const f = solve({ twist: -90, hipTwist: -90 }, lying);
    expect(f.arms.near.root[1]).toBeCloseTo(-24 - 22, 9);
    expect(f.arms.far.root[1]).toBeCloseTo(-24 + 22, 9);
    expect(f.arms.near.root[2]).toBeCloseTo(0, 9);
    expect(f.legs.near.root[1]).toBeCloseTo(-24 - 8, 9);
    expect(f.legs.far.root[1]).toBeCloseTo(-24 + 8, 9);
    // The front view sees the shoulder line upright; the top view sees it end-on.
    const top = project(f, "top");
    expect(Math.abs(top.arms.near.root[1] - top.arms.far.root[1])).toBeLessThan(1e-9);
  });

  it("turns the face with the chest", () => {
    const frames = (twist: number): DoodleSpec["frames"] => [{ pose: STAND, hold: 0.3, sideways: { twist }, face: { turn: 0 } }];
    const tick = (twist: number) => {
      const s = spec(frames(twist), ["side", "top"]);
      const mark = faceMarks3(s, sampleTimeline3(s).poses, "top")![0];
      return Math.atan2(-(mark.to[1] - mark.from[1]), mark.to[0] - mark.from[0]);
    };
    expect(tick(0)).toBeCloseTo(0, 9);
    // + twist: the chest (and face) turns towards the near side (-z).
    expect((tick(45) * 180) / Math.PI).toBeCloseTo(-45, 6);
  });

  it("blends the roll over a transition with true bone lengths", () => {
    const s = spec([
      { pose: STAND, hold: 0.3 },
      { pose: STAND, hold: 0.3, sideways: { twist: 80, hipTwist: 20 } },
    ]);
    expect(validateSpec(s).errors).toEqual([]);
    const timeline = sampleTimeline3(s);
    for (const pose of timeline.poses) for (const [actual, expected] of allBones(pose)) expect(Math.abs(actual - expected)).toBeLessThan(1e-6);
    const mid = timeline.poses[timeline.keyframeIndex[1] - 7];
    const angle = (Math.atan2(mid.arms.far.root[0], mid.arms.far.root[2]) * 180) / Math.PI;
    expect(angle).toBeGreaterThan(5);
    expect(angle).toBeLessThan(75);
    expect(blendTurn(turnOf({ twist: 90 }), turnOf({ twist: 270 }), 0.5).twist).toBe(180);
  });
});

describe("shoulder girdle (sideways.shoulders)", () => {
  it("moves a shoulder up the spine and forward of the chest, the collar line with it", () => {
    const f = solve({ shoulders: { far: { up: 12, forward: 8 } } });
    expect(f.arms.far.root[0]).toBeCloseTo(8, 9);
    expect(f.arms.far.root[1]).toBeCloseTo(-282, 9);
    expect(f.arms.far.root[2]).toBeCloseTo(22, 9);
    expect(f.arms.near.root).toEqual(solve(undefined).arms.near.root);
    // A shrug doesn't turn the face: the chest's own sideways direction stays square.
    expect(f.across).toEqual([0, 0, 1]);
    const front = project(f, "front");
    expect(front.arms.far.root[1] - front.chest[1]).toBeCloseTo(-30, 9);
    for (const [actual, expected] of allBones(f)) expect(actual).toBeCloseTo(expected, 6);
  });

  it("works in the chest's frame: forward follows a twist", () => {
    const f = solve({ twist: 90, shoulders: { near: { forward: 10 } } });
    // Twisted 90°, the chest faces -z, so a protracted near shoulder moves to -z.
    expect(f.arms.near.root[0]).toBeCloseTo(-22, 9);
    expect(f.arms.near.root[2]).toBeCloseTo(-10, 9);
  });

  it("blends the offsets over a transition (a shoulder circle traces its keyframes)", () => {
    const g = (up: number, forward: number): Sideways => ({ shoulders: { near: { up, forward }, far: { up, forward } } });
    const s = spec([
      { pose: STAND, hold: 0, sideways: g(12, 0) },
      { pose: STAND, hold: 0, sideways: g(0, 10) },
      { pose: STAND, hold: 0, sideways: g(-12, 0) },
      { pose: STAND, hold: 0, sideways: g(0, -10) },
    ]);
    expect(validateSpec(s).errors).toEqual([]);
    const timeline = sampleTimeline3(s);
    const roots = timeline.keyframeIndex.map((i) => timeline.poses[i].arms.far.root);
    expect(roots.map((r) => [Math.round(r[0]), Math.round(r[1])])).toEqual([[0, -282], [10, -270], [0, -258], [-10, -270]]);
    const mid = blendTurn(turnOf(g(12, 0)), turnOf(g(0, 10)), 0.5).shoulders.far;
    expect(mid).toEqual({ up: 6, forward: 5 });
    for (const pose of timeline.poses) for (const [actual, expected] of allBones(pose)) expect(Math.abs(actual - expected)).toBeLessThan(1e-6);
  });
});

describe("turn guards", () => {
  it("limit the girdle offsets and the roll", () => {
    expect(turnGuards([{ sideways: { twist: 90, hipTwist: 90, shoulders: { near: { up: 14, forward: -12 } } } }])).toEqual([]);
    expect(turnGuards([{ sideways: { shoulders: { near: { up: 15 } } } }])).toEqual([expect.stringContaining("shoulders.near.up 15 is past 14")]);
    expect(turnGuards([{ sideways: { shoulders: { far: { forward: -13 } } } }])).toEqual([expect.stringContaining("shoulders.far.forward -13 is past 12")]);
    expect(turnGuards([{ sideways: { twist: 100 } }])).toEqual([expect.stringContaining("the spine twists 100°")]);
    expect(turnGuards([{ sideways: { twist: 190, hipTwist: 180 } }])).toEqual([expect.stringContaining("twist 190° is past 180°")]);
  });

  it("run on a spec and make validation fail", () => {
    const bad = spec([{ pose: STAND, hold: 0.3, sideways: { shoulders: { near: { up: 20 } } } }]);
    expect(dualViewGuards(bad)).toHaveLength(1);
    expect(validateSpec(bad).ok).toBe(false);
    const flat: DoodleSpec = { ...bad, views: undefined };
    expect(dualViewGuards(flat)).toEqual([expect.stringContaining("sideways needs views")]);
  });
});
