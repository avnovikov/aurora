import { describe, expect, it } from "vitest";
import { project } from "../../src/doodles/project";
import { dualLayout, frontProps, propDepth } from "../../src/doodles/renderDual";
import { topLayout, topProps } from "../../src/doodles/renderTop";
import { figurePoints, FLOOR_MARGIN, propSegments, renderDoodleSvg, resolveFloors } from "../../src/doodles/renderSvg";
import { BONES, resolveSideways, solvePose, type AuthoredPose, type DoodleSpec, type Pose, type Prop, type Side } from "../../src/doodles/rig";
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
    const f = solveKeyframe3(solvePose(resolveSideways(RAISE.frames[1].pose as AuthoredPose, RAISE.frames[1].sideways)), RAISE.frames[1].pose as Pose, RAISE.frames[1].sideways);
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
    const f = solveKeyframe3(solvePose(resolveSideways(RAISE.frames[1].pose as AuthoredPose, RAISE.frames[1].sideways)), RAISE.frames[1].pose as Pose, RAISE.frames[1].sideways);
    const side = project(f, "side").arms.far;
    const front = project(f, "front").arms.far;
    expect(Math.hypot(side.end[0] - side.root[0], side.end[1] - side.root[1])).toBeLessThan(20);
    expect(front.end[0] - front.root[0]).toBeGreaterThan(REACH - 5);
  });

  it("puts the far side on the viewer's right in the front view", () => {
    const f = solveKeyframe3(solvePose(resolveSideways(RAISE.frames[1].pose as AuthoredPose, RAISE.frames[1].sideways)), RAISE.frames[1].pose as Pose, RAISE.frames[1].sideways);
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
      { kind: "box", x: 64, y: -50, w: 1, h: 50 },
      { kind: "box", x: 136, y: -50, w: 1, h: 50 },
    ]);
  });

  it("is allowed in two views (no dual-view guard fires)", () => {
    const spec: DoodleSpec = { ...RAISE, props: [{ kind: "board", from: [-150, -60], to: [-60, -60], posts: false }] };
    expect(dualViewGuards(spec)).toEqual([]);
  });

  it("reports a limb crossing it as exactly one crossing", () => {
    const spec: DoodleSpec = {
      id: "test_board_cross",
      slug: "test-board-cross",
      title: "Test board cross",
      props: [{ kind: "board", from: [30, -300], to: [32, -100], posts: false }],
      frames: [
        { pose: { pelvis: [0, -172], hands: { near: [60, -170] }, feet: { near: [0, 0], far: [0, 0] }, toes: { near: 0, far: 0 } }, hold: 0.4 },
      ],
    };
    const crossings = validateSpec(spec).errors.filter((e) => e.startsWith("frame 0:") && e.includes("crosses prop 0"));
    expect(crossings).toEqual(["frame 0: forearm.near crosses prop 0"]);
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

  it("shifts the floor with the figure by dx", () => {
    const [plain] = resolveFloors([{ kind: "floor" }], [stand]) as Extract<Prop, { kind: "bar" }>[];
    const [moved] = resolveFloors([{ kind: "floor" }], [stand], 100) as Extract<Prop, { kind: "bar" }>[];
    expect(moved.x1).toBe(plain.x1 + 100);
    expect(moved.x2).toBe(plain.x2 + 100);
  });

  it("sizes each panel's floor to that panel in two views", () => {
    const spec: DoodleSpec = { ...RAISE, props: [{ kind: "floor" }] };
    expect(dualViewGuards(spec)).toEqual([]);
    expect(validateSpec(spec).errors).toEqual([]);
    const svg = renderDoodleSvg(spec);
    expect(svg.match(/<line x1="[^"]+" y1="0"/g)).toHaveLength(2);
  });
});

/** Every bone of a 3D figure with its true length, spine included. */
const allBones = (f: Figure3) => [
  [dist3(f.pelvis, f.waist), BONES.pelvisWaist],
  [dist3(f.waist, f.chest), BONES.waistChest],
  [dist3(f.chest, f.neck), BONES.chestNeck],
  [dist3(f.neck, f.head), BONES.neckHead],
  ...bones(f),
];

describe("sideways torso lean (sideways.chest, pivot)", () => {
  const upright: Pose = { pelvis: [0, -172], chest: [0, -252], feet: { near: [0, 0], far: [0, 0] }, toes: { near: 0, far: 0 } };
  const solve = (sw: Parameters<typeof solveKeyframe3>[2]) => solveKeyframe3(solvePose(upright), upright, sw);

  it("keeps every bone at its true length with a leaning spine", () => {
    for (const sw of [{ chest: -50 }, { pelvis: 20, chest: -30 }, { pelvis: 30, chest: 0, pivot: "chest" as const }]) {
      for (const [actual, expected] of allBones(solve(sw))) expect(actual).toBeCloseTo(expected, 6);
    }
  });

  it("tilts the spine in the front view and shortens it in the side view (pelvis pivot)", () => {
    const f = solve({ chest: -50 });
    expect(f.chest[2]).toBeCloseTo(-50, 6);
    expect(f.pelvis).toEqual([0, -172, 0]);
    const side = project(f, "side");
    expect(Math.hypot(side.chest[0] - side.pelvis[0], side.chest[1] - side.pelvis[1])).toBeCloseTo(Math.sqrt(80 ** 2 - 50 ** 2), 6);
    // The shoulders tilt with the spine: the near (lean) side drops; the hips stay level.
    expect(f.arms.near.root[1]).toBeGreaterThan(f.arms.far.root[1] + 20);
    expect(f.legs.near.root[1]).toBeCloseTo(f.legs.far.root[1], 9);
  });

  it("moves the hips under still shoulders with pivot: chest", () => {
    const still = solve(undefined);
    const f = solve({ pelvis: 30, chest: 0, pivot: "chest" });
    expect(f.pelvis[2]).toBeCloseTo(30, 6);
    for (const s of ["near", "far"] as Side[]) {
      for (let i = 0; i < 3; i += 1) expect(f.arms[s].root[i]).toBeCloseTo(still.arms[s].root[i], 9);
    }
  });

  it("rejects leaning keyframes that name different pivots", () => {
    const lean = (...pivots: (("pelvis" | "chest") | undefined)[]): DoodleSpec => ({
      id: "test_pivots",
      slug: "test-pivots",
      title: "Test pivots",
      views: ["side", "front"],
      frames: pivots.map((pivot) => ({ pose: upright, sideways: { chest: -30, ...(pivot ? { pivot } : {}) }, hold: 0.3 })),
    });
    expect(dualViewGuards(lean("chest", "chest"))).toEqual([]);
    expect(dualViewGuards(lean(undefined, "pelvis"))).toEqual([]);
    expect(dualViewGuards(lean("chest", "pelvis"))).toEqual([expect.stringContaining("sideways.pivot differs between frame 0")]);
    expect(dualViewGuards(lean("chest", undefined))).toHaveLength(1);
    // A keyframe that does not lean says nothing about the pivot.
    const flat = { ...lean("chest", "chest"), frames: [lean("chest").frames[0], { pose: upright, hold: 0.3 }] };
    expect(dualViewGuards(flat)).toEqual([]);
  });

  it("reports a lean wider than the spine is long (the solver clamps it)", () => {
    const wide = (chest: number): DoodleSpec => ({
      id: "test_wide",
      slug: "test-wide",
      title: "Test wide",
      views: ["side", "front"],
      frames: [{ pose: upright, hold: 0.3 }, { pose: upright, sideways: { chest }, hold: 0.3 }],
    });
    expect(validateSpec(wide(-60)).errors).toEqual([]);
    expect(validateSpec(wide(-95)).errors).toEqual([expect.stringMatching(/^frame 1: sideways\.chest is 95 from the pelvis, more than the 80 spine/)]);
  });

  it("validates a leaning dual spec, blending the lean between keyframes with true bone lengths", () => {
    const spec: DoodleSpec = {
      id: "test_lean",
      slug: "test-lean",
      title: "Test lean",
      views: ["side", "front"],
      frames: [
        { pose: upright, hold: 0.3 },
        { pose: upright, sideways: { chest: -45 }, hold: 0.3 },
      ],
    };
    expect(validateSpec(spec).errors).toEqual([]);
    const timeline = sampleTimeline3(spec);
    for (const pose of timeline.poses) for (const [actual, expected] of allBones(pose)) expect(Math.abs(actual - expected)).toBeLessThan(1e-6);
    const mid = timeline.poses[timeline.keyframeIndex[1] - 7];
    expect(mid.chest[2]).toBeLessThan(-5);
    expect(mid.chest[2]).toBeGreaterThan(-45);
  });
});

describe("parallel bars and parallettes in two views", () => {
  it("are allowed in two views", () => {
    expect(dualViewGuards({ ...RAISE, props: [{ kind: "parallettes", y: -20, xs: [0] }] })).toEqual([]);
    expect(dualViewGuards({ ...RAISE, props: [{ kind: "parallelBars", y: -216, x1: -190, x2: 190 }] })).toEqual([]);
  });

  it("draw parallel bars end-on: a rail at ±frontHalf on an upright to the floor", () => {
    const front = frontProps([{ kind: "parallelBars", y: -216, x1: -190, x2: 190 }], 100);
    expect(front).toEqual([
      { kind: "box", x: 66, y: -220, w: 8, h: 8 },
      { kind: "board", from: [70, -212], to: [70, 0], posts: false },
      { kind: "box", x: 126, y: -220, w: 8, h: 8 },
      { kind: "board", from: [130, -212], to: [130, 0], posts: false },
    ]);
    const narrow = frontProps([{ kind: "parallelBars", y: -216, x1: -190, x2: 190, frontHalf: 26 }]);
    expect(narrow[0]).toMatchObject({ x: -30 });
  });

  it("draw parallettes end-on at each hand's z, with a foot on the floor", () => {
    const front = frontProps([{ kind: "parallettes", y: -40, xs: [0] }], 0, { near: -34, far: 34 });
    expect(front).toEqual([
      { kind: "box", x: -38, y: -44, w: 8, h: 8 },
      { kind: "board", from: [-34, -36], to: [-34, 0], posts: false },
      { kind: "bar", y: 0, x1: -46, x2: -22 },
      { kind: "box", x: 30, y: -44, w: 8, h: 8 },
      { kind: "board", from: [34, -36], to: [34, 0], posts: false },
      { kind: "bar", y: 0, x1: 22, x2: 46 },
    ]);
  });

  it("render on the front panel of a dip in two views", () => {
    const dip: DoodleSpec = {
      ...RAISE,
      props: [{ kind: "parallelBars", y: -150, x1: -190, x2: 190 }],
      frames: [{ ...RAISE.frames[0], sideways: { hands: { near: -30, far: 30 } } }],
    };
    const svg = renderDoodleSvg(dip);
    expect(svg.match(/<rect [^>]*width="8" height="8"/g)).toHaveLength(2);
  });
});

describe("depth-aware prop crossings (two views)", () => {
  /** Lying on a bench near its near edge (pelvis z -22), the near leg hanging down at z `footZ`. */
  const bench = (footZ: number, views?: DoodleSpec["views"]): DoodleSpec => ({
    id: "test_bench_leg",
    slug: "test-bench-leg",
    title: "Test bench leg",
    ...(views ? { views } : {}),
    props: [{ kind: "box", x: -190, y: -90, w: 260, h: 90, frontHalf: 30 }],
    frames: [
      {
        pose: {
          pelvis: [0, -100],
          chest: [-80, -100],
          head: [-133.4, -117],
          hands: { near: [-30, -124], far: [-30, -124] },
          elbows: { near: { bend: -1 }, far: { bend: -1 } },
          knees: { near: { at: [40, -40] }, far: { at: [62, -163] } },
          feet: { near: [40, -4], far: [110, -92] },
          toes: { far: 0 },
        },
        ...(views ? { sideways: { pelvis: -22, knees: { near: { at: footZ } }, feet: { near: footZ } } } : {}),
        hold: 0.5,
      },
    ],
  });
  const crossings = (spec: DoodleSpec) => validateSpec(spec).errors.filter((e) => e.includes("crosses prop 0"));

  it("passes a limb beside a box (outside its frontHalf)", () => {
    expect(crossings(bench(-46, ["side", "front"]))).toEqual([]);
  });

  it("fails a limb through the box (inside its frontHalf)", () => {
    expect(crossings(bench(-12, ["side", "front"]))).not.toEqual([]);
  });

  it("judges the top view by the same depth: beside the box passes, through it fails", () => {
    expect(crossings(bench(-46, ["side", "top"]))).toEqual([]);
    expect(crossings(bench(-12, ["side", "top"]))).not.toEqual([]);
  });

  it("keeps the one-view check: every prop is solid in the drawing plane", () => {
    expect(crossings(bench(0))).not.toEqual([]);
  });

  it("gives each prop its front extent", () => {
    const hands = { near: -40, far: 40 };
    expect(propDepth({ kind: "box", x: 0, y: -40, w: 10, h: 40 }, hands)).toEqual([[-60, 60]]);
    expect(propDepth({ kind: "box", x: 0, y: -40, w: 10, h: 40, frontHalf: 30 }, hands)).toEqual([[-30, 30]]);
    expect(propDepth({ kind: "bar", y: -200, x1: 0, x2: 10 }, hands)).toEqual([[-90, 90]]);
    expect(propDepth({ kind: "board", from: [0, -40], to: [100, -40] }, hands)).toEqual([[-36, 36]]);
    expect(propDepth({ kind: "parallelBars", y: -200, x1: 0, x2: 100 }, hands)).toEqual([[-34, -26], [26, 34]]);
    expect(propDepth({ kind: "parallettes", y: -40, xs: [0] }, hands)).toEqual([[-52, -28], [28, 52]]);
    expect(propDepth({ kind: "floor" }, hands)).toEqual([]);
  });
});

describe("top view (views: [\"side\", \"top\"])", () => {
  const TOP: DoodleSpec = { ...RAISE, id: "test_top", slug: "test-top", views: ["side", "top"] };

  it("projects (x, -z): x as in the side view, the near side (z < 0) at the bottom", () => {
    const f = solveKeyframe3(solvePose(resolveSideways(RAISE.frames[1].pose as AuthoredPose, RAISE.frames[1].sideways)), RAISE.frames[1].pose as Pose, RAISE.frames[1].sideways);
    const top = project(f, "top");
    const side = project(f, "side");
    expect(top.arms.far.end).toEqual([f.arms.far.end[0], -f.arms.far.end[2]]);
    expect(top.head[0]).toBe(side.head[0]);
    // The far hand (z > 0) is above the near shoulder (z < 0) on the panel.
    expect(top.arms.far.end[1]).toBeLessThan(top.arms.near.root[1]);
  });

  it("stacks the top panel under the side panel with the same x, everything in frame", () => {
    const layout = topLayout(TOP);
    const { x, y, w, h } = layout.view;
    const inside = ([px, py]: readonly [number, number]) => px >= x && px <= x + w && py >= y && py <= y + h;
    const sideBottom = Math.max(...layout.side.flatMap((pose) => figurePoints(pose).map((p) => p.point[1])));
    const topTop = Math.min(...layout.top.flatMap((pose) => figurePoints(pose).map((p) => p.point[1] + layout.topShift)));
    expect(topTop).toBeGreaterThan(sideBottom);
    expect(layout.labels.top[1]).toBeGreaterThan(layout.labels.side[1]);
    for (const pose of layout.side) expect(figurePoints(pose).every((p) => inside(p.point))).toBe(true);
    for (const pose of layout.top) expect(figurePoints(pose).every((p) => inside([p.point[0], p.point[1] + layout.topShift]))).toBe(true);
    const svg = renderDoodleSvg(TOP);
    expect(svg).toContain(">side</text>");
    expect(svg).toContain(">top</text>");
    expect(svg).not.toContain(">front</text>");
  });

  it("validates the same 3D checks as the front view", () => {
    expect(validateSpec(TOP).errors).toEqual([]);
    const far = { ...TOP.frames[1], sideways: { hands: { far: 400 } } };
    expect(validateSpec({ ...TOP, frames: [TOP.frames[0], far] }).errors.some((e) => e.includes("hands.far unreachable"))).toBe(true);
  });

  it("draws props from above: footprints for box, board and bar, rails and handles along x, no floor", () => {
    expect(
      topProps([
        { kind: "floor" },
        { kind: "box", x: -100, y: -60, w: 200, h: 60, frontHalf: 30 },
        { kind: "board", from: [100, -40], to: [-50, -80] },
        { kind: "bar", y: -400, x1: -10, x2: 10 },
        { kind: "parallelBars", y: -216, x1: -190, x2: 190 },
        { kind: "parallettes", y: -40, xs: [60] },
      ], { near: -34, far: 34 }),
    ).toEqual([
      { kind: "box", x: -100, y: -30, w: 200, h: 60 },
      { kind: "box", x: -50, y: -36, w: 150, h: 72 },
      { kind: "box", x: -10, y: -90, w: 20, h: 180 },
      { kind: "bar", y: 30, x1: -190, x2: 190 },
      { kind: "bar", y: -30, x1: -190, x2: 190 },
      { kind: "bar", y: 34, x1: 38, x2: 82 },
      { kind: "bar", y: -34, x1: 38, x2: 82 },
    ]);
  });

  it("guards: props allowed, hand-held gear and the ab wheel not (no top drawing yet)", () => {
    expect(dualViewGuards({ ...TOP, props: [{ kind: "floor" }, { kind: "box", x: 0, y: -40, w: 40, h: 40 }, { kind: "parallelBars", y: -200, x1: 0, x2: 100 }] })).toEqual([]);
    expect(dualViewGuards({ ...TOP, straps: { anchor: [0, -400], end: "ring" } })).toEqual([expect.stringContaining("straps")]);
    expect(dualViewGuards({ ...TOP, kettlebell: { hands: ["near"] } })).toEqual([expect.stringContaining("kettlebell")]);
    expect(dualViewGuards({ ...TOP, handBand: true })).toEqual([expect.stringContaining("handBand")]);
    expect(dualViewGuards({ ...TOP, wheel: 30 })).toEqual([expect.stringContaining("wheel")]);
    expect(dualViewGuards({ ...TOP, frames: [{ ...TOP.frames[0], mirror: 0 }, TOP.frames[1]] })).toHaveLength(1);
    expect(validateSpec({ ...TOP, handBand: true }).ok).toBe(false);
  });
});
