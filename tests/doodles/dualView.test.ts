import { describe, expect, it } from "vitest";
import { project } from "../../src/doodles/project";
import { dualLayout, frontProps } from "../../src/doodles/renderDual";
import { figurePoints, FLOOR_MARGIN, propSegments, renderDoodleSvg, resolveFloors } from "../../src/doodles/renderSvg";
import { BONES, solvePose, type DoodleSpec, type Pose, type Prop, type Side } from "../../src/doodles/rig";
import { dist3, sampleTimeline3, solveKeyframe3, type Figure3 } from "../../src/doodles/rig3d";
import { dualViewGuards, validateSpec } from "../../src/doodles/validate";

/** Standing, arms reaching forward, feet planted. */
const STAND: Pose = {
  pelvis: [0, -172],
  hands: { near: [100, -230], far: [100, -230] },
  feet: { near: [0, 0], far: [0, 0] },
};
/** Shoulder height of STAND (pelvis → chest 80, chest → shoulder 18). */
const SHOULDER_Y = -172 - 98;
const REACH = BONES.upperArm + BONES.forearm + BONES.hand;

/** Lateral raise with the far arm: hands down, then far arm straight out to the side. */
const RAISE: DoodleSpec = {
  id: "test_raise",
  slug: "test-raise",
  title: "Test raise",
  views: ["side", "front"],
  frames: [
    { pose: { pelvis: [0, -172], feet: { near: [0, 0], far: [0, 0] }, toes: { near: 0, far: 0 } }, hold: 0.4 },
    {
      // Chest pinned: the 2D spine lean would otherwise reach for the hand as if it were in front.
      pose: { pelvis: [0, -172], chest: [0, -252], hands: { far: [0, SHOULDER_Y] }, feet: { near: [0, 0], far: [0, 0] }, toes: { near: 0, far: 0 } },
      sideways: { hands: { far: 22 + REACH - 1 } },
      hold: 0.4,
    },
  ],
};

const bones = (f: Figure3) =>
  (["near", "far"] as Side[]).flatMap((s) => [
    [dist3(f.arms[s].root, f.arms[s].mid), BONES.upperArm],
    [dist3(f.arms[s].mid, f.arms[s].joint), BONES.forearm],
    [dist3(f.arms[s].joint, f.arms[s].end), BONES.hand],
    [dist3(f.legs[s].root, f.legs[s].mid), BONES.thigh],
    [dist3(f.legs[s].mid, f.legs[s].joint), BONES.shin],
    [dist3(f.legs[s].joint, f.legs[s].end), BONES.foot],
  ]);

describe("dual-view guards", () => {
  it("accept a plain dual spec", () => {
    expect(dualViewGuards(RAISE)).toEqual([]);
  });

  it("reject views with mirror, front view, unsupported props, and sideways without views", () => {
    expect(dualViewGuards({ ...RAISE, frames: [{ ...RAISE.frames[0], mirror: 0 }, RAISE.frames[1]] })).toHaveLength(1);
    expect(dualViewGuards({ ...RAISE, view: "front" })).toHaveLength(1);
    expect(dualViewGuards({ ...RAISE, props: [{ kind: "parallettes", y: -20, xs: [0] }] })).toHaveLength(1);
    expect(dualViewGuards({ ...RAISE, views: undefined })).toHaveLength(1);
    expect(validateSpec({ ...RAISE, view: "front" }).ok).toBe(false);
  });

  it("reject an ab wheel in two views (no front drawing of it yet)", () => {
    expect(dualViewGuards({ ...RAISE, wheel: 30 })).toEqual([expect.stringContaining("wheel")]);
    expect(validateSpec({ ...RAISE, wheel: 30 }).ok).toBe(false);
  });
});

describe("3D solve", () => {
  it("keeps every limb bone at its true length", () => {
    const f = solveKeyframe3(solvePose(RAISE.frames[1].pose), RAISE.frames[1].pose as Pose, RAISE.frames[1].sideways);
    for (const [actual, expected] of bones(f)) expect(actual).toBeCloseTo(expected, 6);
  });

  it("matches the 2D rig's side view when nothing goes sideways", () => {
    const flat = solvePose(STAND);
    const side = project(solveKeyframe3(flat, STAND, undefined), "side");
    for (const s of ["near", "far"] as Side[]) {
      for (const key of ["mid", "joint", "end"] as const) {
        expect(Math.hypot(side.arms[s][key][0] - flat.arms[s][key][0], side.arms[s][key][1] - flat.arms[s][key][1])).toBeLessThan(0.5);
        expect(Math.hypot(side.legs[s][key][0] - flat.legs[s][key][0], side.legs[s][key][1] - flat.legs[s][key][1])).toBeLessThan(0.5);
      }
    }
  });

  it("draws an arm reaching sideways shorter in the side view, full width in the front view", () => {
    const f = solveKeyframe3(solvePose(RAISE.frames[1].pose), RAISE.frames[1].pose as Pose, RAISE.frames[1].sideways);
    const side = project(f, "side").arms.far;
    const front = project(f, "front").arms.far;
    expect(Math.hypot(side.end[0] - side.root[0], side.end[1] - side.root[1])).toBeLessThan(20);
    expect(front.end[0] - front.root[0]).toBeGreaterThan(REACH - 5);
  });

  it("puts the far side on the viewer's right in the front view", () => {
    const f = solveKeyframe3(solvePose(RAISE.frames[1].pose), RAISE.frames[1].pose as Pose, RAISE.frames[1].sideways);
    const front = project(f, "front");
    expect(front.arms.far.end[0]).toBeGreaterThan(front.head[0]);
    expect(front.arms.near.root[0]).toBeLessThan(front.head[0]);
  });

  it("rolls a bent elbow outward with `out`", () => {
    const pose: Pose = { ...STAND, chest: [0, -252], hands: { near: [30, -250], far: [30, -250] }, elbows: { near: { bend: -1 } } };
    const f = solveKeyframe3(solvePose(pose), pose, { elbows: { near: { out: 90 } } });
    expect(f.arms.near.mid[2]).toBeLessThan(f.arms.near.root[2] - 20);
  });
});

describe("3D timeline", () => {
  it("keeps bone lengths at every sample and the 2D timing", () => {
    const timeline = sampleTimeline3(RAISE);
    for (const pose of timeline.poses) {
      for (const [actual, expected] of bones(pose)) expect(Math.abs(actual - expected)).toBeLessThan(0.5);
    }
    expect(timeline.poses).toHaveLength(timeline.keyTimes.length);
  });
});

describe("dual-view rendering and validation", () => {
  it("validates a sound dual spec", () => {
    expect(validateSpec(RAISE).errors).toEqual([]);
  });

  it("reports a sideways hand out of reach", () => {
    const far = { ...RAISE.frames[1], sideways: { hands: { far: 400 } } };
    const report = validateSpec({ ...RAISE, frames: [RAISE.frames[0], far] });
    expect(report.errors.some((e) => e.includes("hands.far unreachable"))).toBe(true);
  });

  it("draws two labelled panels, no inset, everything in frame", () => {
    const svg = renderDoodleSvg(RAISE);
    expect(svg).toContain(">side</text>");
    expect(svg).toContain(">front</text>");
    expect(svg).not.toContain("clipPath");
    const layout = dualLayout(RAISE);
    const { x, y, w, h } = layout.view;
    const inside = ([px, py]: readonly [number, number]) => px >= x && px <= x + w && py >= y && py <= y + h;
    for (const pose of layout.side) expect(figurePoints(pose).every((p) => inside(p.point))).toBe(true);
    for (const pose of layout.front) {
      expect(figurePoints(pose).every((p) => inside([p.point[0] + layout.frontShift, p.point[1]]))).toBe(true);
    }
  });
});

describe("board prop", () => {
  const board: Prop = { kind: "board", from: [-100, -50], to: [100, -150] };

  it("draws the plank and a post 16 in from each end down to the floor", () => {
    expect(propSegments(board)).toEqual([
      [[-100, -50], [100, -150]],
      [[-84, -58], [-84, 0]],
      [[84, -142], [84, 0]],
    ]);
    expect(propSegments({ ...board, posts: false })).toEqual([[[-100, -50], [100, -150]]]);
  });

  it("is seen end-on from the front: its outline plus a leg at each edge", () => {
    expect(frontProps([board], 100)).toEqual([
      { kind: "box", x: 64, y: -150, w: 72, h: 100 },
      { kind: "box", x: 64, y: -50, w: 0, h: 50 },
      { kind: "box", x: 136, y: -50, w: 0, h: 50 },
    ]);
  });

  it("is allowed in two views and checked as one obstacle", () => {
    const spec: DoodleSpec = { ...RAISE, props: [{ kind: "board", from: [-150, -60], to: [-60, -60], posts: false }] };
    expect(dualViewGuards(spec)).toEqual([]);
  });
});

describe("floor prop", () => {
  const stand = solvePose(STAND);

  it("becomes a line at y = 0 spanning the figure plus the margin", () => {
    const xs = figurePoints(stand).map((p) => p.point[0]);
    const [floor] = resolveFloors([{ kind: "floor" }], [stand]);
    expect(floor).toEqual({
      kind: "bar",
      y: 0,
      x1: Math.floor(Math.min(...xs) - FLOOR_MARGIN),
      x2: Math.ceil(Math.max(...xs) + FLOOR_MARGIN),
    });
  });

  it("reaches under props that stand on the floor", () => {
    const [, floor] = resolveFloors([{ kind: "box", x: 200, y: -40, w: 60, h: 40 }, { kind: "floor" }], [stand]);
    expect(floor).toMatchObject({ kind: "bar", y: 0, x2: 260 + FLOOR_MARGIN });
  });

  it("leaves other props alone and draws nothing without a floor", () => {
    const bar: Prop = { kind: "bar", y: -200, x1: -50, x2: 50 };
    expect(resolveFloors([bar], [stand])).toEqual([bar]);
  });

  it("sizes each panel's floor to that panel in two views", () => {
    const spec: DoodleSpec = { ...RAISE, props: [{ kind: "floor" }] };
    expect(dualViewGuards(spec)).toEqual([]);
    expect(validateSpec(spec).errors).toEqual([]);
    const svg = renderDoodleSvg(spec);
    expect(svg.match(/<line x1="[^"]+" y1="0"/g)).toHaveLength(2);
  });
});
