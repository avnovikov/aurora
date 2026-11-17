import { solvePose } from "./rig";
import type { DoodleSpec, Point, Pose, Prop } from "./rig";
import { SIDE_LYING_FLOOR } from "./specsWarmup";

/**
 * Batch O: hips and glutes (side-lying, all fours, bridges). Floor at y = 0, up
 * is negative, facing +x. Side-lying moves use the front view (near = bottom
 * side, far = top side) so the knees open towards the ceiling.
 * Import only from ./rig and other batch files — never from ./specs (that would be circular).
 */

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}

const round = (value: number): number => Math.round(value * 10) / 10;

/** Rotate `p` about `c` by `degrees` (clockwise on screen). */
function rotateAbout(p: Point, c: Point, degrees: number): Point {
  const r = (degrees * Math.PI) / 180;
  const dx = p[0] - c[0];
  const dy = p[1] - c[1];
  return [round(c[0] + dx * Math.cos(r) - dy * Math.sin(r)), round(c[1] + dx * Math.sin(r) + dy * Math.cos(r))];
}

// ---------------------------------------------------------------- banded clamshell (front view, head left)

/*
 * Same geometry as ntc_clamshell (specsBatchD): the bent knees draw as a "^" above
 * the hip-ankle line, so opening the top knee only raises it further. (The
 * side-lying base in specsWarmup draws the knees below that line; with fixed bone
 * lengths a knee can only cross it through a straight leg, which reads as a kick.)
 */
const CLAM_PELVIS: Point = [0, -24];
const CLAM_BOTTOM_KNEE = along([CLAM_PELVIS[0], CLAM_PELVIS[1] + 8], -24, 88);
const CLAM_BOTTOM_FOOT = along(CLAM_BOTTOM_KNEE, 30, 86);

/** Side-lying, head on the straight lower arm, knees bent, feet together; `open` (0..1) lifts the top knee. */
function clamshell(open: number): Pose {
  const topAnkle: Point = [round(CLAM_BOTTOM_FOOT[0] - 22 * open), round(CLAM_BOTTOM_FOOT[1] - 12 - 4 * open)];
  return {
    pelvis: CLAM_PELVIS,
    chest: [-80, CLAM_PELVIS[1]],
    head: [-134, -30],
    spine: { bend: -1 },
    hands: { near: [-223.5, -3], far: [26, -44] },
    elbows: { near: { bend: 1 }, far: { bend: -1 } },
    knees: { near: { at: CLAM_BOTTOM_KNEE }, far: { bend: -1 } },
    feet: { near: CLAM_BOTTOM_FOOT, far: topAnkle },
    toes: { near: 0, far: 0 },
  };
}

// ---------------------------------------------------------------- all fours (side view)

const AF_PELVIS: Point = [-50, -92];

/** Hands and knees: hands under the shoulders, knees under the hips, tops of the feet flat (as specs.ts). */
function allFours(): Pose {
  return {
    pelvis: AF_PELVIS,
    hands: { near: [48, 0], far: [44, 0] },
    feet: { near: [-136, -4], far: [-132, -4] },
    toes: { near: 180, far: 180 },
  };
}

/** Bent-knee kickback: thigh driven back level with the back, knee at 90°, sole to the ceiling. */
function bentKickback(): Pose {
  const knee = along(AF_PELVIS, 182, 88);
  return {
    ...allFours(),
    knees: { near: { at: knee } },
    feet: { near: along(knee, -90, 86), far: [-132, -4] },
    toes: { near: 0, far: 180 },
  };
}

/** Halfway up: thigh swinging back, knee still at 90°. */
function kickbackMid(): Pose {
  const knee = along(AF_PELVIS, 136, 88);
  return { ...allFours(), knees: { near: { at: knee } }, feet: { near: along(knee, 226, 86), far: [-132, -4] }, toes: { near: 136, far: 180 } };
}

/** Straight-leg kickback: the leg pushed back until straight, a little above hip height. */
function straightKickback(): Pose {
  return {
    ...allFours(),
    feet: { near: along(AF_PELVIS, 186, 173), far: [-132, -4] },
    toes: { near: 100, far: 180 },
  };
}

// ---------------------------------------------------------------- standing side leg raise (front view)

/** Chair back / wall post the near hand holds. */
const SLR_POST: Prop = { kind: "box", x: -112, y: -176, w: 14, h: 176 };
const SLR_PELVIS: Point = [0, -171];
/** Far (swinging) hip in the front view. */
const SLR_HIP: Point = [8, -171];

/** `deg` = leg angle from straight down, positive out to the side, negative across the standing leg. */
function sideLegRaise(deg: number): Pose {
  const foot = along(SLR_HIP, 90 - deg, 173.6);
  return {
    pelvis: SLR_PELVIS,
    chest: [0, -251],
    hands: { near: [-105, -178], far: [30, -184] },
    elbows: { near: { bend: -1 }, far: { bend: -1 } },
    knees: { far: { at: along(SLR_HIP, 90 - deg, 88) } },
    feet: { near: [-10, 0], far: foot },
    toes: { near: 180, far: round(-deg) },
  };
}

// ---------------------------------------------------------------- lying face up (side view, head left)

const SUPINE_CHORD = 77;

/** Upper back and head on the floor, arms long by the sides, hips at `pelvis` (copied from specs.ts). */
function lyingFaceUp(pelvis: Point): Pose {
  const dy = -18 - pelvis[1];
  const chest: Point = [round(pelvis[0] - Math.sqrt(SUPINE_CHORD ** 2 - dy * dy)), -18];
  const head: Point = [round(chest[0] - 55), -24];
  const base: Pose = { pelvis, chest, head, spine: { bend: -1 } };
  const shoulder = solvePose(base).arms.near.root;
  const reach = 125.4;
  const handY = -6;
  const handX = round(shoulder[0] + Math.sqrt(reach ** 2 - (shoulder[1] - handY) ** 2));
  return {
    ...base,
    hands: { near: [handX, handY], far: [handX, handY - 1] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
  };
}

/** Bridge (or lying) with the feet at `near`/`far` (ankles; a lifted foot is mid-step). */
function bridgeAt(pelvisY: number, near: Point, far: Point): Pose {
  return {
    ...lyingFaceUp([-12, pelvisY]),
    knees: { near: { bend: -1 }, far: { bend: -1 } },
    feet: { near, far },
    toes: { near: near[1] < -4 ? 10 : 0, far: far[1] < -4 ? 10 : 0 },
  };
}

/** Bridge height for feet `x` out: the hips sink a little as the feet walk away. */
const walkHips = (x: number): number => round(-78 + (x - 82) * 0.2);
const STEP = 22;
const LIFT = -26;

/** Walking bridge keyframes: two steps out per foot, then two back in, hips high throughout. */
function walkingBridgeFrames(): { hold: number; pose: Pose }[] {
  const frames: { hold: number; pose: Pose }[] = [];
  const add = (hold: number, near: Point, far: Point) => {
    const x = Math.max(near[1] < -4 ? 0 : near[0], far[1] < -4 ? 0 : far[0]);
    frames.push({ hold, pose: bridgeAt(walkHips(x), near, far) });
  };
  frames.push({ hold: 0.3, pose: bridgeAt(-24, [82, 0], [78, 0]) });
  let n = 82;
  let f = 78;
  add(0.3, [n, 0], [f, 0]);
  for (const dir of [1, 1, -1, -1]) {
    add(0, [n + (dir * STEP) / 2, LIFT], [f, 0]);
    n += dir * STEP;
    add(0.05, [n, 0], [f, 0]);
    add(0, [n, 0], [f + (dir * STEP) / 2, LIFT]);
    f += dir * STEP;
    add(dir === 1 && n === 82 + 2 * STEP ? 0.4 : 0.05, [n, 0], [f, 0]);
  }
  return frames;
}

// ---------------------------------------------------------------- pelvic tilt into bridge

const PT_FEET = { near: [58, 0] as Point, far: [55, 0] as Point };

function pelvicTilt(pelvisY: number): Pose {
  return {
    ...lyingFaceUp([-12, pelvisY]),
    knees: { near: { bend: -1 }, far: { bend: -1 } },
    feet: PT_FEET,
    toes: { near: 0, far: 0 },
  };
}

// ---------------------------------------------------------------- back extension off a flat bench

/** Flat bench; the hips hang just past its right end, a partner (not drawn) holds the legs. */
const HB_BENCH: Prop = { kind: "box", x: -140, y: -108, w: 140, h: 108 };
const HB_PELVIS: Point = [10, -120];

/**
 * Face down along the bench, torso `deg` below level (0 = straight body), arms
 * crossed over the chest (elbows under the chest, hands at the opposite shoulder).
 */
function benchExtension(deg: number): Pose {
  const chest = along(HB_PELVIS, deg, 80);
  const shoulder = along(HB_PELVIS, deg, 98);
  // Arms crossed, authored for a level torso and turned with it.
  const elbow = rotateAbout([shoulder[0] - 36, shoulder[1] + 48], shoulder, deg);
  const hand = rotateAbout(along([shoulder[0] - 36, shoulder[1] + 48], -12, 66), shoulder, deg);
  return {
    pelvis: HB_PELVIS,
    chest,
    head: along(chest, deg + 6, 56),
    hands: { near: hand, far: hand },
    elbows: { near: { at: elbow }, far: { at: elbow } },
    feet: { near: along(HB_PELVIS, 180, 173.6), far: along(HB_PELVIS, 180, 173.6) },
    toes: { near: 175, far: 175 },
  };
}

// ---------------------------------------------------------------- specs

export const BATCH_O_SPECS: DoodleSpec[] = [
  {
    id: "wger_1842",
    slug: "banded-clamshell",
    title: "Banded Clamshell",
    view: "front",
    props: [SIDE_LYING_FLOOR],
    transition: 1,
    frames: [
      { hold: 0.4, pose: clamshell(0) },
      { hold: 0.6, pose: clamshell(1) },
    ],
  },
  {
    id: "fedb_glute_kickback",
    slug: "glute-kickback",
    title: "Glute Kickback",
    transition: 0.9,
    frames: [
      { hold: 0.4, pose: allFours() },
      { hold: 0, pose: kickbackMid() },
      { hold: 0.6, pose: bentKickback() },
      { hold: 0, pose: kickbackMid() },
    ],
  },
  {
    id: "wger_990",
    slug: "kneeling-kickbacks",
    title: "Kneeling kickbacks",
    transition: 0.9,
    frames: [
      { hold: 0.4, pose: allFours() },
      { hold: 0.6, pose: straightKickback() },
    ],
  },
  {
    id: "fedb_side_leg_raises",
    slug: "side-leg-raises",
    title: "Side Leg Raises",
    view: "front",
    props: [SLR_POST],
    transition: 0.8,
    frames: [
      { hold: 0.1, pose: sideLegRaise(4) },
      { hold: 0.3, pose: sideLegRaise(42) },
      { hold: 0.1, pose: sideLegRaise(4) },
      { hold: 0.3, pose: sideLegRaise(-24) },
    ],
  },
  {
    id: "wger_1103",
    slug: "walking-bridge",
    title: "Walking bridge",
    transition: 0.45,
    frames: walkingBridgeFrames(),
  },
  {
    id: "fedb_pelvic_tilt_into_bridge",
    slug: "pelvic-tilt-into-bridge",
    title: "Pelvic Tilt Into Bridge",
    transition: 0.9,
    frames: [
      { hold: 0.4, pose: pelvicTilt(-24) },
      { hold: 0.4, pose: pelvicTilt(-42) },
      { hold: 1.2, pose: pelvicTilt(-74) },
      { hold: 0.3, pose: pelvicTilt(-42) },
    ],
  },
  {
    id: "fedb_hyperextensions_with_no_hyperextension_bench",
    slug: "hyperextensions-with-no-hyperextension-bench",
    title: "Hyperextensions With No Hyperextension Bench",
    props: [HB_BENCH],
    transition: 1.2,
    frames: [
      { hold: 0.4, pose: benchExtension(0) },
      { hold: 0.4, pose: benchExtension(42) },
    ],
  },
];
