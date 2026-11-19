import { BONES, dist, SHOULDER_SIDE, solvePose } from "./rig";
import type { DoodleSpec, Keyframe, Point, Pose, Prop, Side, Sideways } from "./rig";
import { TWO_VIEWS } from "./sideways";
import { SIDE_LYING_FLOOR } from "./specsWarmup";

/**
 * Batch AF: lying core (crunch variations, toe taps, scissor kicks), plus the
 * bench flutter kick and standing leg lift that share their ids' block.
 * Floor at y = 0, up is negative, the side-view figure faces +x (lying face up
 * has the head at -x, lying face down the head at +x). The side-lying oblique
 * crunch uses the front view (near = bottom side).
 * Import only from ./rig and other batch files — never from ./specs (that would be circular).
 *
 * Left out:
 * - Sit Up Elbow Thrust (wger_1479): the move is the cross-body elbow drive at
 *   the top, a rotation of the torso; a sideways view shows a plain sit-up.
 * - Elbow to Knee (fedb_elbow_to_knee): the curl rotates the opposite elbow
 *   across to the knee, a torso twist no single view shows.
 * - Floor windshield wiper (ntc_floor_windshield_wiper): the raised legs rotate
 *   side to side about the spine; from the side the legs only shorten, from
 *   above they point at the camera.
 */

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}

const round = (value: number): number => Math.round(value * 10) / 10;
const angle = (from: Point, to: Point): number => (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;

/** Where circles around `a` (radius ra) and `b` (radius rb) meet; `pick` chooses between the two points. */
function meet(a: Point, ra: number, b: Point, rb: number, pick: (p: Point, q: Point) => boolean): Point {
  const d = dist(a, b);
  const x = (ra * ra - rb * rb + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, ra * ra - x * x));
  const ux = (b[0] - a[0]) / d;
  const uy = (b[1] - a[1]) / d;
  const base: Point = [a[0] + ux * x, a[1] + uy * x];
  const p: Point = [round(base[0] - uy * h), round(base[1] + ux * h)];
  const q: Point = [round(base[0] + uy * h), round(base[1] - ux * h)];
  return pick(p, q) ? p : q;
}

const upper = (p: Point, q: Point): boolean => p[1] < q[1];

const THIGH = BONES.thigh;
const SHIN = BONES.shin;
const LEG = THIGH + SHIN;
/** Shoulder to fingertip with the elbow (nearly) locked. */
const REACH = 125.85;

/** Shoulder (near side) of a solved pose. */
const shoulderOf = (pose: Pose, view?: "front"): Point => solvePose(pose, { view }).arms.near.root;

/** Straight legs from the pelvis at `near` / `far` degrees, knees pinned on the line so they never kink. */
function straightLegs(pelvis: Point, near: number, far: number, toe = 0): Pick<Pose, "knees" | "feet" | "toes"> {
  return {
    knees: { near: { at: along(pelvis, near, THIGH) }, far: { at: along(pelvis, far, THIGH) } },
    feet: { near: along(pelvis, near, LEG - 0.2), far: along(pelvis, far, LEG - 0.2) },
    toes: { near: round(near + toe), far: round(far + toe) },
  };
}

// ---------------------------------------------------------------- lying face up, head at -x

const SUPINE_PELVIS: Point = [-8, -20];
const SUPINE_CHORD = 77;

/** Upper back and head on the floor, arms long by the sides, palms down. */
function lyingFlat(pelvis: Point = SUPINE_PELVIS): Pose {
  const dy = -18 - pelvis[1];
  const chest: Point = [round(pelvis[0] - Math.sqrt(SUPINE_CHORD ** 2 - dy * dy)), -18];
  const head: Point = [round(chest[0] - 55), -24];
  const base: Pose = { pelvis, chest, head, spine: { bend: -1 } };
  const shoulder = shoulderOf(base);
  const handY = -6;
  const handX = round(shoulder[0] + Math.sqrt(REACH ** 2 - (shoulder[1] - handY) ** 2));
  return {
    ...base,
    hands: { near: [handX, handY], far: [handX, handY - 1] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
  };
}

/** Curled torso: the shoulders lift off the floor, pivoting at the pelvis (`theta` ≈ 183 flat, ≈ 212 curled). */
function curledTorso(theta: number, tuck: number): Pose {
  const pelvis = SUPINE_PELVIS;
  const chest = along(pelvis, theta, 80);
  return { pelvis, chest, head: along(chest, theta + tuck, 56) };
}

/** Feet flat, knees bent (crunch legs). */
const CRUNCH_FEET: Point = [84, -2];
const crunchLegs = (): Pick<Pose, "feet" | "toes"> => ({
  feet: { near: CRUNCH_FEET, far: [CRUNCH_FEET[0] - 3, CRUNCH_FEET[1]] },
  toes: { near: 0, far: 0 },
});

// ---------------------------------------------------------------- reach ups

/** Crunch with both arms straight up: the hands push towards the ceiling as the shoulders curl up. */
function reachUp(theta: number, tuck: number): Pose {
  const torso = curledTorso(theta, tuck);
  const shoulder = shoulderOf(torso);
  return {
    ...torso,
    hands: { near: along(shoulder, -86, REACH), far: along(shoulder, -88, REACH) },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    ...crunchLegs(),
  };
}

// ---------------------------------------------------------------- toe touchers

/** Legs nearly vertical with a soft knee; the hands reach up the legs towards the toes. */
const TT_LEG = -84;
function toeToucher(theta: number, tuck: number): Pose {
  const torso = curledTorso(theta, tuck);
  const shoulder = shoulderOf(torso);
  const pelvis = SUPINE_PELVIS;
  // Soft knee: the knee sits a touch towards the head of the hip→ankle line.
  const ankle = (offset: number): Point => along(pelvis, TT_LEG + offset, LEG - 6);
  const kneeAt = (offset: number): Point => meet(pelvis, THIGH, ankle(offset), SHIN, (p, q) => p[0] < q[0]);
  const toe = along(ankle(0), TT_LEG - 90, 20);
  // Reach towards the toes as far as straight arms go.
  const hand = along(shoulder, angle(shoulder, toe), Math.min(REACH, dist(shoulder, toe)));
  return {
    ...torso,
    hands: { near: hand, far: along(shoulder, angle(shoulder, toe) - 1.5, Math.min(REACH, dist(shoulder, toe))) },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { at: kneeAt(0) }, far: { at: kneeAt(-1.5) } },
    feet: { near: ankle(0), far: ankle(-1.5) },
    toes: { near: TT_LEG - 90, far: TT_LEG - 91.5 },
  };
}

// ---------------------------------------------------------------- tuck crunch

/** Thighs vertical, knees bent to 90° (shins level), ankles crossed; arms crossed on the chest. */
function tuckCrunch(theta: number, tuck: number): Pose {
  const torso = curledTorso(theta, tuck);
  const pelvis = SUPINE_PELVIS;
  const shoulder = along(pelvis, theta, 98);
  // Arms crossed: elbow out over the chest towards the hips, hand at the opposite shoulder.
  const elbow = along(shoulder, theta + 150, 60);
  const hand = along(elbow, theta - 8, 66);
  const elbowFar = along(shoulder, theta + 148, 60);
  const knee = along(pelvis, -90, THIGH);
  const kneeFar = along(pelvis, -92, THIGH);
  return {
    ...torso,
    hands: { near: hand, far: along(elbowFar, theta - 10, 66) },
    elbows: { near: { at: elbow }, far: { at: elbowFar } },
    knees: { near: { at: knee }, far: { at: kneeFar } },
    feet: { near: along(knee, 2, SHIN), far: along(kneeFar, -2, SHIN) },
    toes: { near: -30, far: -30 },
  };
}

// ---------------------------------------------------------------- toe taps

/** Tabletop knee for the thigh at `thigh` degrees; the knee bend stays at 90°. */
function tabletop(thigh: number): { knee: Point; foot: Point; toe: number } {
  const knee = along(SUPINE_PELVIS, thigh, THIGH);
  // Toes pointed along the shin in tabletop, the heel tapping with the toes up at the floor.
  return { knee, foot: along(knee, thigh + 90, SHIN), toe: Math.min(thigh + 70, -20) };
}

/** Thigh angle that brings the foot down to the floor with the knee still at 90°. */
const TAP_THIGH = (() => {
  let thigh = -90;
  while (tabletop(thigh).foot[1] < -6 && thigh < 0) thigh += 0.25;
  return thigh;
})();

/** Arms by the sides, legs in tabletop; `near` / `far` (0..1) lower that foot towards the floor. */
function toeTap(nearDown: number, farDown: number): Pose {
  const near = tabletop(-90 + (TAP_THIGH + 90) * nearDown);
  const far = tabletop(-92 + (TAP_THIGH + 92) * farDown);
  return {
    ...lyingFlat(),
    knees: { near: { at: near.knee }, far: { at: far.knee } },
    feet: { near: near.foot, far: far.foot },
    toes: { near: near.toe, far: far.toe },
  };
}

// ---------------------------------------------------------------- scissor kick

/** Low back down, palms on the floor, straight legs at `near` and `far` degrees off the floor. */
function scissor(near: number, far: number): Pose {
  return { ...lyingFlat(), ...straightLegs(SUPINE_PELVIS, -near, -far, 6) };
}

// ---------------------------------------------------------------- bench flutter kicks (face down, head at +x)

/** Flat bench; the hips sit on its back edge, the legs reach off the end. */
const FK_TOP = -84;
const FK_PELVIS: Point = [-40, FK_TOP - 14];
const FK_CHEST: Point = [FK_PELVIS[0] + 80, FK_PELVIS[1] - 4];
/** Head up and neutral, so the long arms reach forward under it. */
const FK_BASE: Pose = { pelvis: FK_PELVIS, chest: FK_CHEST, head: along(FK_CHEST, -26, 56) };
const FK_SHOULDER = shoulderOf(FK_BASE);
/** Straight arms angle down to the front edge; the fingertips curl just over it. */
const FK_HAND = along(FK_SHOULDER, 7, REACH);
const FK_FRONT = round(FK_HAND[0] - 3);
const FK_BENCH: Prop = { kind: "box", x: -46, y: FK_TOP, w: FK_FRONT + 46, h: -FK_TOP };

/** Lying face down along the bench, hands holding its front edge; straight legs at `near`/`far` degrees above level. */
function flutter(near: number, far: number): Pose {
  return {
    ...FK_BASE,
    hands: { near: FK_HAND, far: FK_HAND },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    ...straightLegs(FK_PELVIS, 180 + near, 180 + far, 8),
  };
}

// ---------------------------------------------------------------- standing leg lift (chair for balance)

const LL_PELVIS: Point = [0, -LEG];
/** Chair back in front of the figure. */
const LL_CHAIR: Prop = { kind: "box", x: 96, y: -186, w: 12, h: 186 };

/** Standing tall, hands on the chair back; the near leg lifts behind with the knee bent (`lift` 0..1). */
function legLift(lift: number): Pose {
  const pelvis = LL_PELVIS;
  const chest = along(pelvis, -84, 80);
  const thigh = 90 + 32 * lift;
  const knee = along(pelvis, thigh, THIGH);
  const shin = thigh + 4 + 34 * lift;
  return {
    pelvis,
    chest,
    head: along(chest, -82, 56),
    hands: { near: [100, -190], far: [96, -190] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { at: knee }, far: { at: along(pelvis, 90, THIGH) } },
    feet: { near: along(knee, shin, SHIN), far: [0, 0] },
    toes: { near: shin - 94, far: 0 },
  };
}

// ---------------------------------------------------------------- frog sit-up (side + front)

/** Soles pressed together: each foot this far from the body line (z). */
export const FROG_SOLE_Z = 4;
/** Degrees the knees roll out from the forward plane: they drop wide, low over the floor. */
export const FROG_KNEE_OUT = 72;
/** Frog legs in two views: soles together on the body line, knees dropped wide (the diamond). */
export const FROG_SIDEWAYS: Sideways = {
  feet: { near: -FROG_SOLE_Z, far: FROG_SOLE_Z },
  knees: { near: { out: FROG_KNEE_OUT }, far: { out: FROG_KNEE_OUT } },
};
/** Feet drawn in, flat on their outer edges a short way ahead of the hips. */
const FROG_FEET: Record<Side, Point> = { near: [66, -4], far: [64, -4] };
/** Crossed arms: each hand reaches across to the other side of the chest. */
const CROSS_Z = 12;

/** Sit-up with arms crossed on the chest; the torso pivots from lying (183) up towards the feet. */
function frogSitUp(theta: number, tuck: number): Keyframe {
  const torso = curledTorso(theta, tuck);
  const shoulder = along(SUPINE_PELVIS, theta, 98);
  const elbow = along(shoulder, theta + 150, 60);
  const elbowFar = along(shoulder, theta + 148, 60);
  // The forearm crosses SHOULDER_SIDE + CROSS_Z sideways, so it is shorter in the side view.
  const forearm = Math.sqrt(66 ** 2 - (SHOULDER_SIDE + CROSS_Z) ** 2);
  return {
    hold: 0,
    pose: {
      ...torso,
      hands: { near: along(elbow, theta - 8, forearm), far: along(elbowFar, theta - 10, forearm) },
      elbows: { near: { at: elbow }, far: { at: elbowFar } },
      knees: { near: { bend: -1 }, far: { bend: -1 } },
      feet: FROG_FEET,
      toes: { near: 10, far: 10 },
    },
    sideways: { ...FROG_SIDEWAYS, hands: { near: CROSS_Z, far: -CROSS_Z } },
  };
}

// ---------------------------------------------------------------- oblique crunch (front view, side-lying, head at -x)

const OC_PELVIS: Point = [0, -24];

/**
 * Lying on the bottom (near) side, legs stacked and long, bottom arm along the
 * floor overhead, top hand behind the head. `curl` (degrees) side-bends the
 * torso up so the top elbow drives towards the hip.
 */
function obliqueCrunch(curl: number): Pose {
  const pelvis = OC_PELVIS;
  const chest = along(pelvis, 180 + curl, curl === 0 ? 80 : 77);
  // The head rests on the bottom arm, so it sits a little above the spine line.
  const head = along(chest, 188 + curl * 1.2, 56);
  const base: Pose = { pelvis, chest, head, spine: { bend: 1 } };
  const solved = solvePose(base, { view: "front" });
  const spine = angle(solved.chest, solved.head);
  const shoulderFar = solved.arms.far.root;
  const shoulderNear = solved.arms.near.root;
  // Top hand behind the head, the elbow pointing up towards the hip.
  const hand = along(head, spine + 100, 28);
  const elbow = meet(shoulderFar, 60, hand, 66, upper);
  const nearHand: Point = [round(shoulderNear[0] - Math.sqrt(124 ** 2 - (shoulderNear[1] + 3) ** 2)), -3];
  const hipNear = solved.legs.near.root;
  const hipFar = solved.legs.far.root;
  return {
    ...base,
    hands: { near: nearHand, far: hand },
    elbows: { near: { bend: 1 }, far: { at: elbow } },
    // Legs stacked: the top ankle rests on the bottom one.
    knees: { near: { at: along(hipNear, 3.3, THIGH) }, far: { at: along(hipFar, 5.9, THIGH) } },
    feet: { near: along(hipNear, 3.3, LEG - 0.2), far: along(hipFar, 5.9, LEG - 0.2) },
    toes: { near: 10, far: 10 },
  };
}

// ---------------------------------------------------------------- specs

export const BATCH_AF_SPECS: DoodleSpec[] = [
  {
    id: "fedb_oblique_crunches_on_the_floor",
    slug: "oblique-crunches-on-the-floor",
    title: "Oblique Crunches - On The Floor",
    view: "front",
    props: [SIDE_LYING_FLOOR],
    transition: 0.8,
    frames: [
      { hold: 0.4, pose: obliqueCrunch(0) },
      { hold: 0.5, pose: obliqueCrunch(22) },
    ],
  },
  {
    id: "wger_1287",
    slug: "reach-ups",
    title: "Reach ups",
    transition: 0.7,
    frames: [
      { hold: 0.4, pose: reachUp(183, 2) },
      { hold: 0.5, pose: reachUp(212, 12) },
    ],
  },
  {
    id: "wger_1425",
    slug: "toe-taps",
    title: "Toe Taps",
    // In-between keyframes keep the knee at 90° all the way down and up.
    transition: 0.4,
    frames: [
      { hold: 0.3, pose: toeTap(0, 0) },
      { hold: 0, pose: toeTap(0.5, 0) },
      { hold: 0.3, pose: toeTap(1, 0) },
      { hold: 0, pose: toeTap(0.5, 0) },
      { hold: 0.3, pose: toeTap(0, 0) },
      { hold: 0, pose: toeTap(0, 0.5) },
      { hold: 0.3, pose: toeTap(0, 1) },
      { hold: 0, pose: toeTap(0, 0.5) },
    ],
  },
  {
    id: "fedb_toe_touchers",
    slug: "toe-touchers",
    title: "Toe Touchers",
    transition: 0.7,
    frames: [
      { hold: 0.4, pose: toeToucher(183, 2) },
      { hold: 0.5, pose: toeToucher(214, 14) },
    ],
  },
  {
    id: "fedb_tuck_crunch",
    slug: "tuck-crunch",
    title: "Tuck Crunch",
    transition: 0.7,
    frames: [
      { hold: 0.4, pose: tuckCrunch(183, 2) },
      { hold: 0.5, pose: tuckCrunch(214, 14) },
    ],
  },
  {
    id: "fedb_scissor_kick",
    slug: "scissor-kick",
    title: "Scissor Kick",
    transition: 0.45,
    frames: [
      { hold: 0.1, pose: scissor(36, 8) },
      { hold: 0.1, pose: scissor(8, 36) },
    ],
  },
  {
    id: "fedb_flutter_kicks",
    slug: "flutter-kicks",
    title: "Flutter Kicks",
    props: [FK_BENCH],
    transition: 0.45,
    frames: [
      { hold: 0.1, pose: flutter(12, -8) },
      { hold: 0.1, pose: flutter(-8, 12) },
    ],
  },
  {
    id: "fedb_leg_lift",
    slug: "leg-lift",
    title: "Leg Lift",
    props: [LL_CHAIR],
    transition: 0.9,
    frames: [
      { hold: 0.4, pose: legLift(0) },
      { hold: 0.5, pose: legLift(1) },
    ],
  },
  {
    id: "fedb_frog_sit_ups",
    slug: "frog-sit-ups",
    title: "Frog Sit-Ups",
    views: TWO_VIEWS,
    transition: 0.8,
    frames: [
      { ...frogSitUp(183, 2), hold: 0.4 },
      { ...frogSitUp(215, 10), hold: 0.05 },
      { ...frogSitUp(-100, 8), hold: 0.5 },
      { ...frogSitUp(215, 10), hold: 0.05 },
    ],
  },
];
