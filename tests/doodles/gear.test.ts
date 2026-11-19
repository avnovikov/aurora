import { describe, expect, it } from "vitest";
import { bellAt, bells, gearPoints, HANDLE_HALF, RING_RADIUS, strapAnchor, strapLine } from "../../src/doodles/gear";
import { dualLayout } from "../../src/doodles/renderDual";
import { figureExtent, fmt, renderDoodleSvg } from "../../src/doodles/renderSvg";
import { KETTLEBELL, kettlebellOnFloor, onStrap, sampleTimeline, solvePose, type DoodleSpec, type Point, type Pose } from "../../src/doodles/rig";
import { dualViewGuards, gearGuards, validateSpec } from "../../src/doodles/validate";

/** Standing, both hands reaching up and forward to the same point. */
const reach = (hand: Point, extra: Partial<Pose> = {}): Pose => ({
  pelvis: [0, -172],
  chest: [0, -252],
  hands: { near: hand, far: hand },
  elbows: { near: { bend: 1 }, far: { bend: 1 } },
  feet: { near: [6, 0], far: [0, 0] },
  toes: { near: 0, far: 0 },
  ...extra,
});

const ANCHOR: Point = [60, -460];
/** Hands on rings hanging 150 from the anchor, swung a little forward and back. */
const RINGS: DoodleSpec = {
  id: "test_rings",
  slug: "test-rings",
  title: "Test rings",
  straps: { anchor: ANCHOR, end: "ring" },
  frames: [
    { pose: reach(onStrap(ANCHOR, 150, -10)), hold: 0.3 },
    { pose: reach(onStrap(ANCHOR, 150, 10)), hold: 0.3 },
  ],
};

const TWO_VIEWS = ["side", "front"] as const;
const RINGS_DUAL: DoodleSpec = {
  ...RINGS,
  views: TWO_VIEWS,
  frames: RINGS.frames.map((frame) => ({ ...frame, sideways: { hands: { near: -40, far: 40 } } })),
};

/** Band pull-apart: hands forward, then out wide to the sides. */
const PULL_APART: DoodleSpec = {
  id: "test_pull_apart",
  slug: "test-pull-apart",
  title: "Test pull-apart",
  views: TWO_VIEWS,
  handBand: true,
  frames: [
    { pose: reach([124, -276]), sideways: { hands: { near: -22, far: 22 } }, hold: 0.3 },
    { pose: reach([16, -276]), sideways: { hands: { near: -144, far: 144 } }, hold: 0.3 },
  ],
};

/** Hands hanging by the thighs holding a bell each, then a curl to the rack. */
const BELLS: DoodleSpec = {
  id: "test_bells",
  slug: "test-bells",
  title: "Test bells",
  kettlebell: { hands: ["near", "far"] },
  frames: [
    { pose: reach([10, -150]), hold: 0.3 },
    { pose: reach([27, -277]), hold: 0.3, bell: "rack" },
  ],
};

describe("straps (rings, handles, anchored bands)", () => {
  it("draws a strap from the anchor to the top of the ring, and a ring round the hand (side view)", () => {
    const svg = renderDoodleSvg(RINGS);
    const hand = sampleTimeline(RINGS).poses[0].arms.near.end;
    expect(svg).toContain(`points="${fmt(ANCHOR[0])},${fmt(ANCHOR[1])} `);
    expect(svg).toContain(`<circle cx="${fmt(hand[0])}" cy="${fmt(hand[1])}" r="${RING_RADIUS}" style="fill:none"`);
    const line = strapLine(RINGS, ANCHOR, sampleTimeline(RINGS).poses[0], "near");
    expect(Math.hypot(line[1][0] - hand[0], line[1][1] - hand[1])).toBeCloseTo(RING_RADIUS, 6);
  });

  it("a handle forks into a bar across the strap at the hand", () => {
    const spec: DoodleSpec = { ...RINGS, straps: { anchor: ANCHOR, end: "handle" } };
    const pose = sampleTimeline(spec).poses[0];
    const [, apex, a, b, back] = strapLine(spec, ANCHOR, pose, "near");
    expect(back).toEqual(apex);
    expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeCloseTo(2 * HANDLE_HALF, 6);
  });

  it("an anchored band runs straight to the knee with to: knees, in the accent colour", () => {
    const spec: DoodleSpec = { ...RINGS, straps: { anchor: [120, -60], end: "band", to: "knees", sides: ["near"] } };
    const pose = sampleTimeline(spec).poses[0];
    expect(strapLine(spec, [120, -60], pose, "near")).toEqual([[120, -60], pose.legs.near.mid]);
    expect(renderDoodleSvg(spec)).toContain(`<g style="stroke:var(--doodle-focus, #c4a574)" stroke-width="5"><polyline points="120,-60 `);
  });

  it("front panel: each strap hangs at the anchor's height straight above its hand's first position", () => {
    const layout = dualLayout(RINGS_DUAL);
    for (const side of ["near", "far"] as const) {
      const anchor = strapAnchor(RINGS_DUAL, layout.front, side, "front");
      expect(anchor).toEqual([layout.front[0].arms[side].end[0], ANCHOR[1]]);
      expect(renderDoodleSvg(RINGS_DUAL)).toContain(`points="${fmt(anchor[0] + layout.frontShift)},${fmt(ANCHOR[1])} `);
    }
    expect(strapAnchor(RINGS_DUAL, layout.front, "near", "front")[0]).toBeCloseTo(-40, 6);
  });

  it("the drawing's bounds take in the anchor and the rings (side and both panels)", () => {
    const poses = sampleTimeline(RINGS).poses;
    const box = figureExtent(poses, [], RINGS);
    expect(box.y).toBeLessThan(ANCHOR[1]);
    const without = figureExtent(poses, [], { ...RINGS, straps: undefined });
    expect(without.y).toBeGreaterThan(ANCHOR[1]);
    const view = dualLayout(RINGS_DUAL).view;
    expect(view.y).toBeLessThan(ANCHOR[1]);
    const ringBottom = Math.max(...gearPoints(RINGS, poses, "side").map((p) => p[1]));
    expect(box.y + box.h).toBeGreaterThan(ringBottom);
  });

  it("the guard allows straps in two views", () => {
    expect(dualViewGuards(RINGS_DUAL)).toEqual([]);
    expect(validateSpec(RINGS_DUAL)).toMatchObject({ ok: true });
    expect(validateSpec(RINGS)).toMatchObject({ ok: true });
  });

  it("rejects a ring anchor below the hands and a strap that stretches", () => {
    const low = validateSpec({ ...RINGS, straps: { anchor: [60, -200], end: "ring" } });
    expect(low.errors).toContain("straps.near: anchor not above the hand (t=0s)");
    const stretch = validateSpec({ ...RINGS, frames: [RINGS.frames[0], { pose: reach(onStrap(ANCHOR, 190, 10)), hold: 0.3 }] });
    expect(stretch.errors).toEqual(expect.arrayContaining([expect.stringMatching(/^straps\.near: strap length changes by/)]));
    // A band may stretch, and anchor anywhere.
    expect(validateSpec({ ...RINGS, straps: { anchor: [60, -200], end: "band" } }).ok).toBe(true);
  });

  it("rejects an empty sides list", () => {
    expect(gearGuards({ ...RINGS, straps: { anchor: ANCHOR, end: "ring", sides: [] } })).toEqual(["straps.sides is empty"]);
  });
});

describe("hand band", () => {
  it("draws a band from hand to hand on both panels, inside the bounds", () => {
    const svg = renderDoodleSvg(PULL_APART);
    const layout = dualLayout(PULL_APART);
    const front = layout.front[0];
    const band = `points="${fmt(front.arms.near.end[0] + layout.frontShift)},${fmt(front.arms.near.end[1])} ${fmt(front.arms.far.end[0] + layout.frontShift)},${fmt(front.arms.far.end[1])}"`;
    expect(svg).toContain(band);
    expect(svg.match(/stroke:var\(--doodle-focus, #c4a574\)" stroke-width="5"/g)).toHaveLength(2);
    expect(dualViewGuards(PULL_APART)).toEqual([]);
    expect(validateSpec(PULL_APART)).toMatchObject({ ok: true });
  });
});

describe("kettlebells", () => {
  const pose = solvePose(reach([60, -200]));
  const r = KETTLEBELL.size;

  it("hangs straight below the grip, swings on along the forearm, racks behind (side) or outside (front) the forearm", () => {
    const grip = pose.arms.near.end;
    expect(bellAt(pose, "near", r, "side", "hang").centre).toEqual([grip[0], grip[1] + r * KETTLEBELL.grip]);
    const swing = bellAt(pose, "near", r, "side", "swing").centre;
    const fore = [grip[0] - pose.arms.near.mid[0], grip[1] - pose.arms.near.mid[1]];
    const out = [swing[0] - grip[0], swing[1] - grip[1]];
    expect(Math.abs(fore[0] * out[1] - fore[1] * out[0])).toBeLessThan(1e-6);
    expect(Math.hypot(out[0], out[1])).toBeCloseTo(r * KETTLEBELL.grip, 6);
    const racked = solvePose(reach([27, -277]));
    expect(bellAt(racked, "near", r, "side", "rack").centre[0]).toBeLessThan(racked.arms.near.joint[0]);
    expect(bellAt(racked, "near", r, "front", "rack").centre[0]).toBeLessThan(racked.arms.near.joint[0]);
    expect(bellAt(racked, "far", r, "front", "rack").centre[0]).toBeGreaterThan(racked.arms.far.joint[0]);
  });

  it("the handle runs from the bell up through the grip", () => {
    const { handle, centre } = bellAt(pose, "near", r, "side", "hang");
    const [a, q, b] = handle;
    const mid = [(a[0] + 2 * q[0] + b[0]) / 4, (a[1] + 2 * q[1] + b[1]) / 4];
    expect(mid[0]).toBeCloseTo(pose.arms.near.end[0], 6);
    expect(mid[1]).toBeCloseTo(pose.arms.near.end[1], 6);
    for (const foot of [a, b]) expect(Math.hypot(foot[0] - centre[0], foot[1] - centre[1])).toBeCloseTo(r, 6);
  });

  it("blends into the rack over the transition", () => {
    const poses = sampleTimeline(BELLS).poses;
    const list = bells(BELLS, poses, "near", "side");
    expect(list[0].centre[1]).toBeCloseTo(poses[0].arms.near.end[1] + r * KETTLEBELL.grip, 6);
    expect(list[15].centre[0]).toBeLessThan(poses[15].arms.near.joint[0]);
  });

  it("draws a solid bell and a handle arc, on both panels, inside the bounds", () => {
    const svg = renderDoodleSvg(BELLS);
    expect(svg.match(/<path d="M[^"]+ Q/g)).toHaveLength(2);
    expect(svg).toContain(`r="${r}" style="fill:var(--doodle-ink, #f4f1ea)"`);
    const poses = sampleTimeline(BELLS).poses;
    const box = figureExtent(poses, [], BELLS);
    const lowest = Math.max(...bells(BELLS, poses, "near", "side").map((b) => b.centre[1] + b.radius));
    expect(box.y + box.h).toBeGreaterThan(lowest);
    const dual: DoodleSpec = { ...BELLS, views: TWO_VIEWS };
    expect(dualViewGuards(dual)).toEqual([]);
    expect(validateSpec(dual)).toMatchObject({ ok: true });
    expect(renderDoodleSvg(dual).match(/<path d="M[^"]+ Q/g)).toHaveLength(4);
  });

  it("rejects a bell through the floor and a bell keyframe without a kettlebell", () => {
    const deep: DoodleSpec = { ...BELLS, frames: [{ pose: reach([50, -30], { pelvis: [-40, -90], chest: [20, -140] }), hold: 0.3 }, BELLS.frames[0]] };
    expect(validateSpec(deep).errors).toEqual(expect.arrayContaining([expect.stringMatching(/^kettlebell\.near below floor/)]));
    const onFloor: DoodleSpec = { ...deep, frames: [{ pose: reach([50, kettlebellOnFloor()], { pelvis: [-40, -90], chest: [20, -140] }), hold: 0.3 }, BELLS.frames[0]] };
    expect(validateSpec(onFloor).errors.filter((e) => e.startsWith("kettlebell"))).toEqual([]);
    expect(gearGuards({ ...BELLS, kettlebell: undefined })).toEqual(["keyframe bell needs a kettlebell"]);
  });
});
