import { describe, expect, it } from "vitest";
import { bellAt, bellHolders, bellInFront, bells, ELBOW_LOOP, gearPoints, HANDLE_HALF, RING_RADIUS, strapAnchor, strapAttach, strapLine } from "../../src/doodles/gear";
import { dualLayout } from "../../src/doodles/renderDual";
import { sampleTimeline3 } from "../../src/doodles/rig3d";
import { figureExtent, fmt, renderDoodleSvg } from "../../src/doodles/renderSvg";
import { BONES, KETTLEBELL, kettlebellOnFloor, onStrap, sampleTimeline, solvePose, type DoodleSpec, type Point, type Pose } from "../../src/doodles/rig";
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

describe("per-hand bell modes", () => {
  const r = KETTLEBELL.size;
  /** One bell racked while the other hangs, then the other way round. */
  const ALTERNATING: DoodleSpec = {
    ...BELLS,
    frames: [
      { pose: reach([10, -150], { hands: { near: [27, -277], far: [10, -150] } }), hold: 0.3, bell: { near: "rack" } },
      { pose: reach([10, -150], { hands: { near: [10, -150], far: [27, -277] } }), hold: 0.3, bell: { far: "rack", near: "hang" } },
    ],
  };

  it("racks one bell while the other hangs (a hand left out hangs)", () => {
    const pose = sampleTimeline(ALTERNATING).poses[0];
    const [near] = bells(ALTERNATING, [pose], "near", "side");
    const [far] = bells(ALTERNATING, [pose], "far", "side");
    expect(near.centre[0]).toBeLessThan(pose.arms.near.joint[0]);
    expect(far.centre).toEqual([pose.arms.far.end[0], pose.arms.far.end[1] + r * KETTLEBELL.grip]);
    const second = sampleTimeline(ALTERNATING);
    const k1 = second.poses[second.keyframeIndex[1]];
    expect(bells(ALTERNATING, second.poses, "far", "side")[second.keyframeIndex[1]].centre[0]).toBeLessThan(k1.arms.far.joint[0]);
    expect(validateSpec(ALTERNATING)).toMatchObject({ ok: true });
  });

  it("the string form still sets every bell", () => {
    const spec: DoodleSpec = { ...BELLS, frames: [{ ...BELLS.frames[1], bell: "rack" }] };
    const pose = sampleTimeline(spec).poses[0];
    for (const side of ["near", "far"] as const) {
      expect(bells(spec, [pose], side, "side")[0].centre[0]).toBeLessThan(pose.arms[side].joint[0]);
    }
  });

  it("rejects a per-hand mode for a hand with no bell", () => {
    const spec: DoodleSpec = { ...BELLS, kettlebell: { hands: ["near"] }, frames: [{ ...BELLS.frames[0], bell: { far: "rack" } }] };
    expect(gearGuards(spec)).toEqual(["frame 0: bell.far but no kettlebell in that hand"]);
  });
});

describe("strap anchor in a single front view", () => {
  it("uses the spec's anchor directly", () => {
    const spec: DoodleSpec = { ...RINGS, view: "front" };
    expect(strapAnchor(spec, sampleTimeline(spec).poses, "near", "front")).toEqual(ANCHOR);
  });
});

describe("rack with mirror", () => {
  it("rejects a racked bell (either hand) on a spec that turns round", () => {
    const turn = (bell: DoodleSpec["frames"][number]["bell"]): DoodleSpec => ({ ...BELLS, frames: [{ ...BELLS.frames[0], bell }, { ...BELLS.frames[1], bell, mirror: 0 }] });
    const error = "bell rack can't be combined with mirror (the rack flips sides)";
    expect(gearGuards(turn("rack"))).toEqual([error]);
    expect(gearGuards(turn({ far: "rack" }))).toEqual([error]);
    expect(gearGuards(turn("swing"))).toEqual([]);
  });
});

describe("bell hand-offs (bellIn)", () => {
  const r = KETTLEBELL.size;
  const together: Point = [40, -200];
  /** Near hand at the thigh, both hands together in front (the hand-off), far hand at the thigh, together again. */
  const PASS: DoodleSpec = {
    id: "test_pass",
    slug: "test-pass",
    title: "Test pass",
    kettlebell: { hands: ["near"] },
    frames: [
      { pose: reach([10, -150], { hands: { near: [10, -150], far: [-6, -150] } }), hold: 0.3, bellIn: "near" },
      { pose: reach(together), hold: 0.1, bellIn: "far" },
      { pose: reach([10, -150], { hands: { near: [-6, -150], far: [10, -150] } }), hold: 0.3 },
      { pose: reach(together), hold: 0.1, bellIn: "near" },
    ],
  };

  it("holds until the next bellIn, round the loop", () => {
    expect(bellHolders(PASS, "near")).toEqual(["near", "far", "far", "near"]);
    expect(bellHolders({ ...PASS, frames: PASS.frames.map(({ bellIn, ...frame }) => (bellIn === "near" ? frame : { ...frame, bellIn })) }, "near")).toEqual([
      "far",
      "far",
      "far",
      "far",
    ]);
    expect(bellHolders(BELLS, "far")).toEqual(["far", "far"]);
  });

  it("the bell rides in the old hand up to the hand-off keyframe, then in the new one", () => {
    const timeline = sampleTimeline(PASS);
    const list = bells(PASS, timeline.poses, "near", "side");
    const below = (i: number, side: "near" | "far"): Point => [timeline.poses[i].arms[side].end[0], timeline.poses[i].arms[side].end[1] + r * KETTLEBELL.grip];
    const [k0, k1, k2] = timeline.keyframeIndex;
    expect(list[k0].centre).toEqual(below(k0, "near"));
    expect(list[k1 - 1].centre).toEqual(below(k1 - 1, "near"));
    expect(list[k1].centre).toEqual(below(k1, "far"));
    expect(list[k2].centre).toEqual(below(k2, "far"));
  });

  it("draws one bell over the figure, and passes the validator with the hands together at the hand-off", () => {
    expect(renderDoodleSvg(PASS).match(/<path d="M[^"]+ Q/g)).toHaveLength(1);
    expect(validateSpec(PASS)).toMatchObject({ ok: true });
    // Two views judge the hand-off in 3D: the hands must meet sideways too.
    const dual: DoodleSpec = { ...PASS, views: TWO_VIEWS };
    expect(validateSpec(dual).errors).toContain("frame 1: bell hand-off needs both hands on the bell (hand tips 44 apart > 21)");
    dual.frames = PASS.frames.map((frame) => (frame.pose.hands?.near === together ? { ...frame, sideways: { hands: { near: 0, far: 0 } } } : frame));
    expect(validateSpec(dual)).toMatchObject({ ok: true });
    expect(renderDoodleSvg(dual).match(/<path d="M[^"]+ Q/g)).toHaveLength(2);
  });

  it("rejects a hand-off with the hands apart, and bellIn with two bells", () => {
    const apart: DoodleSpec = { ...PASS, frames: PASS.frames.map((frame, k) => (k === 1 ? { ...frame, pose: reach(together, { hands: { near: together, far: [10, -150] } }) } : frame)) };
    expect(validateSpec(apart).errors).toEqual(expect.arrayContaining([expect.stringMatching(/^frame 1: bell hand-off needs both hands on the bell \(hand tips [\d.]+ apart > 21\)$/)]));
    expect(gearGuards({ ...PASS, kettlebell: { hands: ["near", "far"] } })).toEqual(["keyframe bellIn needs one kettlebell (one hand in kettlebell.hands)"]);
  });
});

describe("bell by the horns", () => {
  const r = KETTLEBELL.size;
  /** Round the head: in front of the chest, past the near ear, behind the head, past the far ear. */
  const round = (hand: Point, z: number, out: number): DoodleSpec["frames"][number] => ({
    pose: reach(hand),
    hold: 0.1,
    bell: "horns",
    sideways: { hands: { near: z, far: z }, elbows: { near: { out }, far: { out } } },
  });
  const HALO: DoodleSpec = {
    id: "test_halo",
    slug: "test-halo",
    title: "Test halo",
    views: TWO_VIEWS,
    kettlebell: { hands: ["near"] },
    transition: 0.4,
    frames: [
      round([62, -250], 0, 0),
      round([44, -256], -42, 90),
      round([2, -270], -60, 90),
      round([-33, -284], -33, 120),
      round([-48, -290], 0, 120),
      round([-33, -284], 33, 120),
      round([2, -270], 60, 90),
      round([44, -256], 42, 90),
    ],
  };

  it("sits beyond the joined hands along the mean forearm", () => {
    const pose = solvePose(reach([40, -250], { hands: { near: [40, -250], far: [36, -254] } }));
    const bell = bellAt(pose, "near", r, "side", "horns");
    const { near, far } = pose.arms;
    const grip: Point = [(near.end[0] + far.end[0]) / 2, (near.end[1] + far.end[1]) / 2];
    const k = (r * KETTLEBELL.grip) / (BONES.forearm + BONES.hand) / 2;
    expect(bell.centre[0]).toBeCloseTo(grip[0] + (near.end[0] - near.mid[0] + far.end[0] - far.mid[0]) * k, 6);
    expect(bell.centre[1]).toBeCloseTo(grip[1] + (near.end[1] - near.mid[1] + far.end[1] - far.mid[1]) * k, 6);
    const [a, q, b] = bell.handle;
    expect((a[0] + 2 * q[0] + b[0]) / 4).toBeCloseTo(grip[0], 6);
  });

  it("two views: a copy behind the torso and one over the figure that shows only while in front of the head", () => {
    expect(validateSpec(HALO)).toMatchObject({ ok: true });
    const svg = renderDoodleSvg(HALO);
    // Each panel: back copy plus front copy.
    expect(svg.match(/<path d="M[^"]+ Q/g)).toHaveLength(4);
    const shown = [...svg.matchAll(/<animate attributeName="opacity" values="([01;]+)"/g)].map((m) => m[1].split(";"));
    expect(shown).toHaveLength(2);
    // Front panel: in front of the face at the start, hidden behind the head halfway round.
    const front = shown[1];
    expect(front[0]).toBe("1");
    expect(front[sampleTimeline(HALO).keyframeIndex[4]]).toBe("0");
    // One view: drawn once, over the figure.
    expect(renderDoodleSvg({ ...HALO, views: undefined, frames: HALO.frames.map(({ sideways: _sideways, ...frame }) => frame) }).match(/<path d="M[^"]+ Q/g)).toHaveLength(1);
  });

  it("is in front of the head in the side panel when it is on the near side (z below the head's)", () => {
    const timeline = sampleTimeline3(HALO);
    const side = bellInFront(HALO, timeline.poses, "side");
    const front = bellInFront(HALO, timeline.poses, "front");
    // Round the near ear (keyframe 2, z -60) the bell is nearer the side camera; round the far ear (keyframe 6) it is behind the head.
    expect(side[timeline.keyframeIndex[2]]).toBe(true);
    expect(side[timeline.keyframeIndex[6]]).toBe(false);
    // The two panels disagree about where the bell is in front: behind the head (keyframe 4) only the front panel hides it.
    expect(front[timeline.keyframeIndex[4]]).toBe(false);
  });

  it("rejects horns with the hands apart, and with two bells", () => {
    const apart: DoodleSpec = { ...HALO, frames: [{ ...HALO.frames[0], sideways: { hands: { near: -40, far: 40 } } }, ...HALO.frames.slice(1)] };
    expect(validateSpec(apart).errors).toEqual(expect.arrayContaining([expect.stringMatching(/^frame 0: bell horns needs both hands on the bell/)]));
    expect(gearGuards({ ...HALO, kettlebell: { hands: ["near", "far"] } })).toEqual(["bell horns needs one kettlebell (one hand in kettlebell.hands)"]);
  });
});

describe("band above the elbow (to: elbows)", () => {
  it("runs from the anchor to the upper arm just above the elbow", () => {
    const spec: DoodleSpec = { ...RINGS, straps: { anchor: [190, -230], end: "band", to: "elbows", sides: ["near"] } };
    const pose = sampleTimeline(spec).poses[0];
    const { root, mid } = pose.arms.near;
    const loop: Point = [root[0] + (mid[0] - root[0]) * ELBOW_LOOP, root[1] + (mid[1] - root[1]) * ELBOW_LOOP];
    expect(strapAttach(spec, pose, "near")).toEqual(loop);
    expect(strapLine(spec, [190, -230], pose, "near")).toEqual([[190, -230], loop]);
    expect(validateSpec(spec)).toMatchObject({ ok: true });
    expect(validateSpec({ ...spec, views: TWO_VIEWS })).toMatchObject({ ok: true });
  });
});

describe("strap width (front panel)", () => {
  it("anchors each strap width either side of the centre line, fixed over the loop", () => {
    const spec: DoodleSpec = { ...RINGS_DUAL, straps: { anchor: ANCHOR, end: "ring", width: 40 } };
    const layout = dualLayout(spec);
    expect(strapAnchor(spec, layout.front, "near", "front")).toEqual([-40, ANCHOR[1]]);
    expect(strapAnchor(spec, layout.front, "far", "front")).toEqual([40, ANCHOR[1]]);
    expect(strapAnchor(spec, layout.front.slice(5), "far", "front")).toEqual([40, ANCHOR[1]]);
    expect(strapAnchor(spec, layout.side, "far", "side")).toEqual(ANCHOR);
    expect(renderDoodleSvg(spec)).toContain(`points="${fmt(40 + layout.frontShift)},${fmt(ANCHOR[1])} `);
    expect(validateSpec(spec)).toMatchObject({ ok: true });
    // 0: one shared anchor (a single suspension anchor).
    expect(strapAnchor({ ...spec, straps: { ...spec.straps!, width: 0 } }, layout.front, "near", "front")[0]).toBeCloseTo(0, 9);
  });

  it("the 3D strap check measures from the width anchor", () => {
    const wide: DoodleSpec = { ...RINGS_DUAL, straps: { anchor: ANCHOR, end: "ring", width: 120 } };
    expect(validateSpec(wide).ok).toBe(true);
    // Hands that open from 40 to 120 out keep their length only to an anchor out wide.
    const opening: DoodleSpec = {
      ...RINGS_DUAL,
      frames: [RINGS_DUAL.frames[0], { ...RINGS_DUAL.frames[1], sideways: { hands: { near: -120, far: 120 } } }],
    };
    expect(validateSpec(opening).errors).toEqual(expect.arrayContaining([expect.stringMatching(/^straps\.near: strap length changes by/)]));
    expect(gearGuards({ ...RINGS, straps: { anchor: ANCHOR, end: "ring", width: -1 } })).toEqual(["straps.width is negative"]);
  });
});
