import { HIP_SIDE, other, SHOULDER_SIDE, solvePose, zOut } from "./rig";
import type { DoodleSpec, Keyframe, Point, Pose, Side } from "./rig";
import { TWO_VIEWS } from "./sideways";
import { FROG_SIDEWAYS } from "./specsBatchAF";
import { SIDE_LYING_FLOOR } from "./specsWarmup";

/**
 * Batch AG: all fours, face down and hip moves. Floor at y = 0, up is negative,
 * the side-view figure faces +x (lying face up has the head at -x, lying face
 * down the head at +x). Side-lying moves use the front view (near = bottom side,
 * far = top side). The skydiver, frog pumps and hip circles are drawn in two
 * views (side + front, keyframe `sideways`).
 * Import only from ./rig and other batch files — never from ./specs (that would be circular).
 *
 * Left out:
 * - Scorpion Kick (wger_1207): the hips rotate to swing the foot across the
 *   body; the rig has no torso rotation.
 * (Fire hydrant, Fire Hydrant Circles, Butterfly Superman and Seated Hip
 * Abduction need two views and are drawn in specsBatchAK.)
 */

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}

const round = (value: number): number => Math.round(value * 10) / 10;
const angle = (from: Point, to: Point): number => (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;

// ---------------------------------------------------------------- clamshell to reverse clamshell (front view, head left)

/* Same geometry as the clamshell in specsBatchD / specsBatchO: knees forward and up, feet together. */
const CLAM_PELVIS: Point = [0, -24];
const CLAM_BOTTOM_KNEE = along([CLAM_PELVIS[0], CLAM_PELVIS[1] + 8], -24, 88);
const CLAM_BOTTOM_FOOT = along(CLAM_BOTTOM_KNEE, 30, 86);

/** Side-lying, head on the straight lower arm, knees bent, feet together; `open` (0..1) lifts the top knee. */
function clamshell(open: number): Pose {
  const topAnkle: Point = [round(CLAM_BOTTOM_FOOT[0] + 6 - 40 * open), round(CLAM_BOTTOM_FOOT[1] - 12 - 10 * open)];
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

/** Closed clamshell with the top knee kept on the bottom knee and the top shin turned up by `lift` degrees. */
function reverseClam(lift: number): Pose {
  const closed = clamshell(0);
  const top = solvePose(closed, { view: "front" }).legs.far;
  const shin = angle(top.mid, top.joint);
  return {
    ...closed,
    knees: { near: { at: CLAM_BOTTOM_KNEE }, far: { at: [round(top.mid[0]), round(top.mid[1])] } },
    feet: { near: CLAM_BOTTOM_FOOT, far: along(top.mid, shin - lift, 86) },
    toes: { near: 0, far: round(-lift / 2) },
  };
}

// ---------------------------------------------------------------- all fours (side view)

export const AF_PELVIS: Point = [-50, -92];
const AF_HANDS = { near: [48, 0] as Point, far: [44, 0] as Point };
const AF_FEET = { near: [-136, -4] as Point, far: [-132, -4] as Point };

/** Hands under the shoulders, knees under the hips, tops of the feet flat. */
export function allFours(): Pose {
  return { pelvis: AF_PELVIS, hands: AF_HANDS, feet: AF_FEET, toes: { near: 180, far: 180 } };
}

/** Chest where the straight support arm left it, pinned once a hand leaves the floor. */
const AF_CHEST = along(AF_PELVIS, -20.5, 80);
const AF_SHOULDER = along(AF_PELVIS, -20.5, 98);

/** Bird dog: `arm` reaches forward a little below level, the opposite leg pushes straight back at hip height. */
function birdDog(arm: Side): Pose {
  const leg = other(arm);
  return {
    pelvis: AF_PELVIS,
    chest: AF_CHEST,
    hands: { [arm]: along(AF_SHOULDER, 20, 125), [leg]: AF_HANDS[leg] },
    feet: { [arm]: AF_FEET[arm], [leg]: along(AF_PELVIS, 182, 173.6) },
    toes: { [arm]: 180, [leg]: 95 },
  };
}

/** Rear leg raise: the near leg pushed straight back and up, a little above hip height. */
function rearLegRaise(): Pose {
  return {
    ...allFours(),
    knees: { near: { at: along(AF_PELVIS, 189, 88) } },
    feet: { near: along(AF_PELVIS, 189, 173.6), far: AF_FEET.far },
    toes: { near: 100, far: 180 },
  };
}

/** A direction in 3D: forward (+x), down (+y), out to the working leg's side (+). */
export type Dir3 = readonly [forward: number, down: number, out: number];

/** A direction in the side view's plane at `degrees` (0 = forward, 90 = down). */
export const inPlane = (degrees: number): Dir3 => [Math.cos((degrees * Math.PI) / 180), Math.sin((degrees * Math.PI) / 180), 0];

const unit3 = (v: Dir3): Dir3 => {
  const n = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / n, v[1] / n, v[2] / n];
};

/**
 * All fours with the `side` knee off the floor: the thigh along `thigh` from the
 * hip, the shin along `shin` from the knee, both in 3D (out = away from the
 * body on that side), so the knee can swing out to the side (fire hydrant).
 */
export function liftedKnee(side: Side, thigh: Dir3, shin: Dir3): Keyframe {
  const sign = zOut(side);
  const hipZ = sign * HIP_SIDE;
  const [t, s] = [unit3(thigh), unit3(shin)];
  const knee: Point = [round(AF_PELVIS[0] + t[0] * 88), round(AF_PELVIS[1] + t[1] * 88)];
  const kneeZ = hipZ + sign * t[2] * 88;
  const foot: Point = [round(knee[0] + s[0] * 86), round(knee[1] + s[1] * 86)];
  const footZ = kneeZ + sign * s[2] * 86;
  const shinDeg = angle(knee, foot);
  return {
    hold: 0,
    pose: {
      ...allFours(),
      knees: { [side]: { at: knee } },
      feet: { [side]: foot, [other(side)]: AF_FEET[other(side)] },
      toes: { [side]: round(shinDeg + 90), [other(side)]: 180 },
    },
    sideways: { knees: { [side]: { at: round(kneeZ) } }, feet: { [side]: round(footZ) } },
  };
}

/** All fours, both knees down (for a dual-view spec). */
export const allFoursKey = (): Keyframe => ({ hold: 0, pose: allFours(), sideways: {} });

/** Fire-hydrant height: the thigh straight out to the side, a little below level; the shin points back. */
export const HYDRANT_THIGH: Dir3 = [0, Math.sin((12 * Math.PI) / 180), Math.cos((12 * Math.PI) / 180)];
export const HYDRANT_SHIN: Dir3 = [-1, 0.12, 0];

/**
 * Knee circle on all fours, near knee: forward under the chest, out to the side
 * at fire-hydrant height, back and up behind the hip, then back in under the hip.
 */
export const KNEE_CIRCLE: Keyframe[] = [
  { ...liftedKnee("near", inPlane(55), inPlane(185)), hold: 0.1 },
  { ...liftedKnee("near", HYDRANT_THIGH, HYDRANT_SHIN), hold: 0.1 },
  { ...liftedKnee("near", inPlane(178), inPlane(270)), hold: 0.1 },
  { ...liftedKnee("near", inPlane(140), inPlane(235)), hold: 0 },
];

// ---------------------------------------------------------------- lying face up (side view, head left)

const SUPINE_CHORD = 77;

/** Upper back and head on the floor, arms long by the sides, hips at `pelvis` (as specsBatchD). */
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

/** Frog pump: heels pulled in close to the seat, soles together, knees wide; `pelvisY` lifts the hips. */
function frogPump(pelvisY: number): Keyframe {
  return {
    hold: 0,
    pose: {
      ...lyingFaceUp([-12, pelvisY]),
      knees: { near: { bend: -1 }, far: { bend: -1 } },
      feet: { near: [62, -6], far: [58, -6] },
      toes: { near: 0, far: 0 },
    },
    sideways: FROG_SIDEWAYS,
  };
}

// ---------------------------------------------------------------- skydiver (side + front, face down, head at +x)

const SKY_PELVIS: Point = [-20, -14];
/** Shoulder to fingertip, a hair short of the full reach so the arm draws straight. */
const SKY_REACH = 125.9;
/** Hip to ankle, straight. */
const SKY_LEG = 173.9;
/** The T-arms angle this far forward of straight out to the side, so the side view sees them. */
const SKY_ARM_FORWARD = 18;

/**
 * Face down, arms out in a T. `lift` 0 lies flat (hands and feet on the floor),
 * 1 holds chest, arms and legs off the floor; `spread` opens each leg that many
 * degrees out to the side.
 */
function skydiver(lift: number, spread: number): Keyframe {
  const pelvis = SKY_PELVIS;
  const spine = -8 - 8 * lift;
  const chest = along(pelvis, spine, 80);
  const shoulder = along(pelvis, spine, 98);
  // Neck long, gaze at the floor (lying flat, the forehead rests just off it).
  const head = along(along(chest, spine, 20), spine + 8 + 22 * lift, 36);
  // Hands on the floor, or lifted to a little above shoulder height.
  const handY = lift === 0 ? -3 : round(shoulder[1] - 6);
  const drop = handY - shoulder[1];
  const flat = Math.sqrt(SKY_REACH ** 2 - drop ** 2);
  const forward = (SKY_ARM_FORWARD * Math.PI) / 180;
  const hand: Point = [round(shoulder[0] + flat * Math.sin(forward)), handY];
  const handZ = round(SHOULDER_SIDE + flat * Math.cos(forward));
  // Straight legs, raised `leg` degrees in the side view and opened `spread` degrees sideways.
  const leg = 184 + 10 * lift;
  const open = (spread * Math.PI) / 180;
  const at = (length: number): { at: Point; z: number } => ({
    at: along(pelvis, leg, length * Math.cos(open)),
    z: round(HIP_SIDE + length * Math.sin(open)),
  });
  const [knee, foot] = [at(88), at(SKY_LEG)];
  return {
    hold: 0,
    pose: {
      pelvis,
      chest,
      head,
      hands: { near: hand, far: hand },
      knees: { near: { at: knee.at }, far: { at: knee.at } },
      feet: { near: foot.at, far: foot.at },
      toes: { near: leg, far: leg },
    },
    sideways: {
      hands: { near: -handZ, far: handZ },
      knees: { near: { at: -knee.z }, far: { at: knee.z } },
      feet: { near: -foot.z, far: foot.z },
    },
  };
}

// ---------------------------------------------------------------- hamstring kicks (standing, side view)

/** A full straight leg above the floor, so the standing legs are drawn dead straight. */
const HK_PELVIS: Point = [0, -173.9];

/** Standing tall, or kicking the straight `kick` leg up to the opposite hand held out at shoulder height. */
function hamstringKick(kick: Side | null): Pose {
  if (!kick) {
    return {
      pelvis: HK_PELVIS,
      chest: [0, -253.9],
      hands: { near: [4, -146.1], far: [-4, -146.1] },
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
      // Straight legs: knees pinned halfway down, so the kick swings up straight.
      knees: { near: { at: [0, -85.9] }, far: { at: [0, -85.9] } },
      feet: { near: [0, 0], far: [0, 0] },
      toes: { near: 0, far: 0 },
    };
  }
  const chest = along(HK_PELVIS, -88, 80);
  const shoulder = along(HK_PELVIS, -88, 98);
  return {
    pelvis: HK_PELVIS,
    chest,
    hands: { [other(kick)]: along(shoulder, 2, 125.9), [kick]: along(shoulder, 120, 120) },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { [kick]: { at: along(HK_PELVIS, -30, 88) } },
    feet: { [kick]: along(HK_PELVIS, -30, 173.9), [other(kick)]: [0, 0] },
    toes: { [kick]: -80, [other(kick)]: 0 },
  };
}

// ---------------------------------------------------------------- specs

export const BATCH_AG_SPECS: DoodleSpec[] = [
  {
    id: "wger_2449",
    slug: "clamshell-to-reverse-clamshell",
    title: "Clamshell to Reverse Clamshell",
    view: "front",
    props: [SIDE_LYING_FLOOR],
    transition: 0.9,
    frames: [
      { hold: 0.3, pose: clamshell(0) },
      // Feet together, the top knee opens towards the ceiling...
      { hold: 0.5, pose: clamshell(1) },
      { hold: 0.3, pose: clamshell(0) },
      // ...then knees together, the top foot lifts.
      { hold: 0.5, pose: reverseClam(95) },
    ],
  },
  {
    id: "ntc_frog_pumps",
    slug: "frog-pumps",
    title: "Frog pumps",
    views: TWO_VIEWS,
    transition: 0.4,
    frames: [
      { ...frogPump(-24), hold: 0.15 },
      { ...frogPump(-66), hold: 0.25 },
    ],
  },
  {
    id: "wger_1910",
    slug: "kneeling-superman",
    title: "Kneeling Superman",
    transition: 1,
    frames: [
      { hold: 0.3, pose: allFours() },
      { hold: 0.7, pose: birdDog("near") },
      { hold: 0.3, pose: allFours() },
      { hold: 0.7, pose: birdDog("far") },
    ],
  },
  {
    id: "wger_1210",
    slug: "skydiver-arms-t",
    title: "Skydiver with arms in T-position",
    views: TWO_VIEWS,
    transition: 0.6,
    frames: [
      // Lying flat, legs apart and arms in a T; lift chest, arms and legs off the floor...
      { ...skydiver(0, 22), hold: 0.3 },
      { ...skydiver(1, 22), hold: 0.2 },
      // ...bring the legs together and apart while holding the lift, then lower.
      { ...skydiver(1, 2), hold: 0.1 },
      { ...skydiver(1, 22), hold: 0.1 },
      { ...skydiver(1, 2), hold: 0.1 },
      { ...skydiver(1, 22), hold: 0.2 },
    ],
  },
  {
    id: "wger_1387",
    slug: "hamstring-kicks",
    title: "Hamstring Kicks",
    transition: 0.6,
    frames: [
      { hold: 0.2, pose: hamstringKick(null) },
      { hold: 0.3, pose: hamstringKick("near") },
      { hold: 0.2, pose: hamstringKick(null) },
      { hold: 0.3, pose: hamstringKick("far") },
    ],
  },
  {
    id: "fedb_rear_leg_raises",
    slug: "rear-leg-raises",
    title: "Rear Leg Raises",
    transition: 0.9,
    frames: [
      { hold: 0.4, pose: allFours() },
      { hold: 0.6, pose: rearLegRaise() },
    ],
  },
  {
    id: "fedb_hip_circles_prone",
    slug: "hip-circles-prone",
    title: "Hip Circles (prone)",
    views: TWO_VIEWS,
    transition: 0.6,
    // Side view: the knee sweeps forward under the chest and back and up behind;
    // front view: it swings out to the side at hip height in between.
    frames: KNEE_CIRCLE,
  },
];
