import { solvePose } from "./rig";
import type { DoodleSpec, Keyframe, Point, Pose } from "./rig";
import { BODY, LOCKED, PLANK_FOOT, lockedShoulderY, pushUp, pushUpTop, rep, straightBody } from "./specsBatchC";

/**
 * Batch S: push-up variations. Floor at y = 0, up is negative, the figure faces
 * +x (a plank has the head at +x). Far limbs are pale behind the body, near
 * limbs bright on top.
 *
 * Left out:
 *   hf_3 Wide Push-Up, fedb_push_up_wide, fedb_pushups_close_and_wide_hand_positions
 *     Hand width only shows head-on or from above. Head-on, the torso and legs
 *     point at the camera: their full-length bones (272 from shoulder to ankle)
 *     cannot fit under shoulders 123 above the floor. From above, a locked arm
 *     reaching a hand 35 units outside the shoulder is drawn 126 long, a prone
 *     T-raise, not a push-up. In side view a flared elbow foreshortens to a point,
 *     which a fixed-length upper arm cannot draw: it would show tucked elbows.
 *   hf_16 Maltese Push-Up   the elbows bend out to the sides. From the side the
 *     fixed-length upper arm folds onto the torso line, so the bottom reads as
 *     tucked elbows and the whole rep as the existing pseudo planche push-up (hf_9).
 *   fedb_clock_push_up   the hop is sideways and the body turns round the feet:
 *     both are out of the side-view plane, and the plank cannot be seen from above.
 */

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}

const round = (value: number): number => Math.round(value * 10) / 10;
const angle = (from: Point, to: Point): number => (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;
const dist = (a: Point, b: Point): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Upper (smaller y) intersection of the circles around `a` (radius ra) and `b` (radius rb). */
function apex(a: Point, ra: number, b: Point, rb: number): Point {
  const d = dist(a, b);
  const t = (ra * ra - rb * rb + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, ra * ra - t * t));
  const ux = (b[0] - a[0]) / d;
  const uy = (b[1] - a[1]) / d;
  const mid: Point = [a[0] + ux * t, a[1] + uy * t];
  const p1: Point = [mid[0] - uy * h, mid[1] + ux * h];
  const p2: Point = [mid[0] + uy * h, mid[1] - ux * h];
  const best = p1[1] < p2[1] ? p1 : p2;
  return [round(best[0]), round(best[1])];
}

/** Highest shoulder (straight body on `foot`) from which every point is within `reach`. */
function reachTop(foot: Point, points: Point[], reach: number): number {
  let lo = Math.min(...points.map((p) => p[1])) - reach;
  let hi = Math.max(...points.map((p) => p[1])) - 1;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    const { shoulder } = straightBody(foot, mid);
    if (Math.max(...points.map((p) => dist(shoulder, p))) > reach) lo = mid;
    else hi = mid;
  }
  return Math.ceil(((lo + hi) / 2) * 10) / 10;
}

const BENT = { near: { bend: 1 as const }, far: { bend: 1 as const } };

/** Shoulder heights between `top` and `bottom`, eased, so the hips stay on the ankle-shoulder line. */
const steps = (top: number, bottom: number, n: number): number[] =>
  Array.from({ length: n }, (_, i) => (1 - Math.cos((Math.PI * (i + 1)) / (n + 1))) / 2).map((f) => round(top + (bottom - top) * f));

/** One smooth rep through eased in-between frames. */
function smoothRep(at: (y: number) => Pose, top: number, bottom: number, holdTop: number, holdBottom: number, n = 5): Keyframe[] {
  const way = steps(top, bottom, n);
  return [
    { hold: holdTop, pose: at(top) },
    ...way.map((y) => ({ hold: 0, pose: at(y) })),
    { hold: holdBottom, pose: at(bottom) },
    ...[...way].reverse().map((y) => ({ hold: 0, pose: at(y) })),
  ];
}

// ---------------------------------------------------------------- sphinx push-up / body-up

/**
 * Forearm plank to straight arms with the hands planted: the forearms peel up
 * about the wrists, so at the top the hands sit well ahead of the shoulders.
 */
const SPHINX_FOOT: Point = [-200, -18];
const SPHINX_LOW = straightBody(SPHINX_FOOT, -64);
const SPHINX_ELBOW: Point = [round(SPHINX_LOW.shoulder[0]), round(SPHINX_LOW.shoulder[1] + 60)];
const SPHINX_WRIST: Point = [SPHINX_ELBOW[0] + 58, SPHINX_ELBOW[1]];

/** `lift` is the forearm angle off the floor (0 = flat, forearm plank); "top" locks the arms. */
function sphinx(lift: number | "top"): Pose {
  const far = (p: Point): Point => [p[0] - 2, p[1]];
  if (lift === "top") {
    const shoulder = apex(SPHINX_FOOT, BODY, SPHINX_WRIST, 117.8);
    const { pelvis, chest } = straightBody(SPHINX_FOOT, shoulder[1]);
    return {
      pelvis,
      chest,
      hands: { near: SPHINX_WRIST, far: far(SPHINX_WRIST) },
      wrists: { near: 0, far: 0 },
      elbows: BENT,
      feet: { near: SPHINX_FOOT, far: SPHINX_FOOT },
      toes: { near: 62, far: 62 },
    };
  }
  // The forearm peels up about the wrist; the shoulder follows, an upper arm from the elbow.
  const elbow = along(SPHINX_WRIST, 180 + lift, 58);
  const shoulder = lift === 0 ? SPHINX_LOW.shoulder : apex(SPHINX_FOOT, BODY, elbow, 60);
  const { pelvis, chest } = straightBody(SPHINX_FOOT, shoulder[1]);
  return {
    pelvis,
    chest,
    hands: { near: SPHINX_WRIST, far: far(SPHINX_WRIST) },
    wrists: { near: 0, far: 0 },
    elbows: lift === 0 ? { near: { at: SPHINX_ELBOW }, far: { at: far(SPHINX_ELBOW) } } : BENT,
    feet: { near: SPHINX_FOOT, far: SPHINX_FOOT },
    toes: { near: 62, far: 62 },
  };
}

const sphinxFrames = (): Keyframe[] => [
  { hold: 0.5, pose: sphinx(0) },
  { hold: 0, pose: sphinx(20) },
  { hold: 0, pose: sphinx(42) },
  { hold: 0.4, pose: sphinx("top") },
  { hold: 0, pose: sphinx(42) },
  { hold: 0, pose: sphinx(20) },
];

// ---------------------------------------------------------------- dive bomber

const DIVE_FOOT: Point = [-158, -19];
const DIVE_HAND: Point = [62, 0];
/** Hands to hips along straight arms and spine (126 + 98), a hair short. */
const ARM_SPINE = 223.6;
const LEG = 173.6;

/**
 * Chest for `pose` (pelvis pinned) at `chord` from the pelvis, turned between
 * `lo` and `hi` degrees until the near shoulder is a locked arm from `hand`.
 */
function lockChest(pose: Pose, chord: number, hand: Point, lo: number, hi: number): Point {
  const pelvis = pose.pelvis as Point;
  const at = (deg: number): Point => {
    const r = (deg * Math.PI) / 180;
    return [pelvis[0] + Math.cos(r) * chord, pelvis[1] + Math.sin(r) * chord];
  };
  const gap = (deg: number): number => dist(solvePose({ ...pose, chest: at(deg) }).arms.near.root, hand) - LOCKED;
  const rising = gap(hi) > gap(lo);
  let a = lo;
  let b = hi;
  for (let i = 0; i < 50; i += 1) {
    const mid = (a + b) / 2;
    if (gap(mid) > 0 === rising) b = mid;
    else a = mid;
  }
  const [x, y] = at((a + b) / 2);
  return [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000];
}

const diveHands = { near: DIVE_HAND, far: [DIVE_HAND[0] - 2, 0] as Point };
const pelvisOnLegX = (x: number): Point => [x, round(DIVE_FOOT[1] - Math.sqrt(LEG ** 2 - (DIVE_FOOT[0] - x) ** 2))];

/** Pike: hips high, arms, spine and legs straight. */
function divePike(): Pose {
  const pelvis = apex(DIVE_HAND, ARM_SPINE, DIVE_FOOT, LEG);
  const deg = angle(pelvis, DIVE_HAND);
  const base: Pose = {
    pelvis,
    hands: diveHands,
    feet: { near: DIVE_FOOT, far: DIVE_FOOT },
    toes: { near: 40, far: 40 },
  };
  const chest = lockChest(base, 80, DIVE_HAND, deg - 10, deg + 10);
  return { ...base, chest, head: along(chest, deg - 28, 56) };
}

/** Chest diving down towards the hands, hips still high, elbows bent. */
function diveDown(): Pose {
  const pelvis = pelvisOnLegX(-40);
  const chest = along(pelvis, 30, 78);
  return {
    pelvis,
    chest,
    head: along(chest, 40, 56),
    hands: diveHands,
    elbows: BENT,
    feet: { near: DIVE_FOOT, far: DIVE_FOOT },
    toes: { near: 55, far: 55 },
  };
}

/** Chest skimming forward low between the hands. */
function diveSkim(): Pose {
  const pelvis = pelvisOnLegX(-8);
  const chest = along(pelvis, 20, 78);
  return {
    pelvis,
    chest,
    head: along(chest, 5, 56),
    hands: diveHands,
    elbows: BENT,
    feet: { near: DIVE_FOOT, far: DIVE_FOOT },
    toes: { near: 62, far: 62 },
  };
}

/** Upward-facing arch: arms straight, hips low, chest up. */
function diveArch(): Pose {
  const pelvisY = -46;
  const pelvis: Point = [round(DIVE_FOOT[0] + Math.sqrt(LEG ** 2 - (pelvisY - DIVE_FOOT[1]) ** 2)), pelvisY];
  const base: Pose = {
    pelvis,
    spine: { bend: 1 },
    hands: diveHands,
    feet: { near: DIVE_FOOT, far: DIVE_FOOT },
    toes: { near: 62, far: 62 },
  };
  const chest = lockChest(base, 77.5, DIVE_HAND, -80, -30);
  return { ...base, chest, head: along(chest, -70, 56) };
}

// ---------------------------------------------------------------- staggered push-up

const STAGGER = 30;
const STAGGER_TOP_X = straightBody(PLANK_FOOT, pushUpTop(62)).shoulder[0];
const STAGGER_FRONT = round(STAGGER_TOP_X + STAGGER);
const STAGGER_BACK = round(STAGGER_TOP_X - STAGGER);
const STAGGER_TOP = reachTop(PLANK_FOOT, [[STAGGER_FRONT, 0], [STAGGER_BACK, 0]], LOCKED);
const STAGGER_BOTTOM = -50;

type Side = "near" | "far";
const other = (side: Side): Side => (side === "near" ? "far" : "near");
/** Hands with `side` at `a` and the other side at `b`. */
const pair = (side: Side, a: Point, b: Point): Record<Side, Point> => (side === "near" ? { near: a, far: b } : { near: b, far: a });

/** `front` is the side whose hand is forward; `moving` lifts that hand halfway to its new place. */
function staggered(shoulderY: number, front: Side, moving?: Side): Pose {
  const base = pushUp(shoulderY, 62);
  const hands = pair(front, [STAGGER_FRONT, 0], [STAGGER_BACK, 0]);
  if (moving) hands[moving] = [round(STAGGER_TOP_X), -24];
  return { ...base, hands };
}

function staggeredRep(front: Side): Keyframe[] {
  return smoothRep((y) => staggered(y, front), STAGGER_TOP, STAGGER_BOTTOM, 0.3, 0.2, 3);
}

/** Switch: one hand at a time steps to its new place. */
function staggeredSwitch(from: Side): Keyframe[] {
  const to = other(from);
  const half = staggered(STAGGER_TOP, from);
  return [
    { hold: 0, pose: staggered(STAGGER_TOP, from, from) },
    { hold: 0, pose: { ...half, hands: pair(from, [STAGGER_BACK, 0], [STAGGER_BACK, 0]) } },
    { hold: 0, pose: { ...half, hands: pair(to, [round(STAGGER_TOP_X), -24], [STAGGER_BACK, 0]) } },
  ];
}

// ---------------------------------------------------------------- plyo push-up

const PLYO_HAND_X = 62;

/** In the air: arms locked and hanging just ahead of the shoulders, hands off the floor. */
function plyoFly(shoulderY: number): Pose {
  const { shoulder } = straightBody(PLANK_FOOT, shoulderY);
  const hand = along(shoulder, 86, LOCKED);
  return { ...pushUp(shoulderY, PLYO_HAND_X), hands: { near: hand, far: [hand[0] - 2, hand[1]] } };
}

// ---------------------------------------------------------------- push-up to side plank

/**
 * Top of the push-up, then one hand reaches straight up to the ceiling. The arm
 * really sweeps up across the camera (foreshortened), which a fixed-length arm
 * cannot draw; it travels "row" (elbow up, hand by the chest), "open" (forearm
 * unfolding over the back), "up" (locked, hand to the ceiling).
 */
type Reach = "row" | "open" | "up";

function sidePlank(reach: Side, stage: Reach): Pose {
  const base = pushUp("top", 62);
  const { shoulder } = straightBody(PLANK_FOOT, pushUpTop(62));
  const support = { [other(reach)]: [62, 0] as Point };
  if (stage === "up") {
    return { ...base, hands: { ...support, [reach]: [round(shoulder[0] + 4), round(shoulder[1] - LOCKED)] } };
  }
  const elbow = stage === "row" ? along(shoulder, -115, 60) : along(shoulder, -100, 60);
  const hand = stage === "row" ? along(elbow, 95, 66) : along(elbow, 172, 66);
  return {
    ...base,
    hands: { ...support, [reach]: hand },
    elbows: { [other(reach)]: { bend: 1 }, [reach]: { at: elbow } },
  };
}

const sidePlankFrames = (reach: Side): Keyframe[] => [
  { hold: 0, pose: sidePlank(reach, "row") },
  { hold: 0, pose: sidePlank(reach, "open") },
  { hold: 0.8, pose: sidePlank(reach, "up") },
  { hold: 0, pose: sidePlank(reach, "open") },
  { hold: 0, pose: sidePlank(reach, "row") },
];

const PUSH_TOP = pushUpTop(62);
const PUSH_BOTTOM = -48;

// ---------------------------------------------------------------- close-grip push-up

/** Hands under the chest, elbows brushing the ribs on the way down. */
const CLOSE_HAND_X = 48;

function closeGrip(shoulderY: number): Pose {
  return pushUp(shoulderY, CLOSE_HAND_X);
}

// ---------------------------------------------------------------- deficit push-up

/** Push-up handles (low parallettes): the chest sinks below the hands. */
const DEFICIT_Y = -36;
const DEFICIT_X = 56;
const DEFICIT_FOOT: Point = [-190, -18];
const DEFICIT_PROPS = [{ kind: "parallettes" as const, y: DEFICIT_Y, xs: [DEFICIT_X] }];
const DEFICIT_TOP = lockedShoulderY(DEFICIT_FOOT, [DEFICIT_X, DEFICIT_Y]);
const DEFICIT_BOTTOM = -28;

function deficit(shoulderY: number): Pose {
  const base = pushUp(shoulderY, DEFICIT_X, DEFICIT_FOOT);
  return { ...base, hands: { near: [DEFICIT_X + 2, DEFICIT_Y], far: [DEFICIT_X - 2, DEFICIT_Y] } };
}

// ---------------------------------------------------------------- fingertip push-up

/** Palms off the floor: the wrists ride high, the hands arch down onto the fingertips. */
const FINGER_ANGLE = 55;
const FINGER_WRIST: Point = along([62, 0], FINGER_ANGLE + 180, 8);

function finger(shoulderY: number): Pose {
  const base = pushUp(shoulderY, 62);
  return {
    ...base,
    hands: { near: FINGER_WRIST, far: [FINGER_WRIST[0] - 2, FINGER_WRIST[1]] },
    wrists: { near: FINGER_ANGLE, far: FINGER_ANGLE },
  };
}

// ---------------------------------------------------------------- specs

export const BATCH_S_SPECS: DoodleSpec[] = [
  {
    id: "hf_11",
    slug: "sphinx-push-up",
    title: "Sphinx Push-Up",
    transition: 0.4,
    frames: sphinxFrames(),
  },
  {
    id: "fedb_body_up",
    slug: "body-up",
    title: "Body-Up",
    transition: 0.4,
    frames: sphinxFrames(),
  },
  {
    id: "hf_14",
    slug: "dive-bomber-push-up",
    title: "Dive Bomber Push-Up",
    transition: 0.6,
    frames: [
      { hold: 0.4, pose: divePike() },
      { hold: 0, pose: diveDown() },
      { hold: 0, pose: diveSkim() },
      { hold: 0.4, pose: diveArch() },
      // Reverse the same swoop back to the pike.
      { hold: 0, pose: diveSkim() },
      { hold: 0, pose: diveDown() },
    ],
  },
  {
    id: "ntc_staggered_push_up",
    slug: "staggered-push-up",
    title: "Staggered push-up",
    transition: 0.35,
    frames: [...staggeredRep("near"), ...staggeredSwitch("near"), ...staggeredRep("far"), ...staggeredSwitch("far")],
  },
  {
    id: "fedb_plyo_push_up",
    slug: "plyo-push-up",
    title: "Plyo Push-up",
    transition: 0.35,
    frames: [
      // Land on soft elbows and flow straight into the next lowering.
      { hold: 0, pose: pushUp(-100, PLYO_HAND_X) },
      { hold: 0, pose: pushUp(-74, PLYO_HAND_X) },
      { hold: 0.15, pose: pushUp(-50, PLYO_HAND_X) },
      // Explode: fast up through locked arms until the hands leave the floor.
      { hold: 0, pose: pushUp(-80, PLYO_HAND_X) },
      { hold: 0, pose: pushUp(-112, PLYO_HAND_X) },
      { hold: 0, pose: plyoFly(-142) },
      { hold: 0.15, pose: plyoFly(-172) },
      { hold: 0, pose: plyoFly(-138) },
    ],
  },
  {
    id: "fedb_push_up_to_side_plank",
    slug: "push-up-to-side-plank",
    title: "Push Up to Side Plank",
    transition: 0.4,
    frames: [
      ...smoothRep((y) => pushUp(y, 62), PUSH_TOP, PUSH_BOTTOM, 0.2, 0.2, 3),
      ...sidePlankFrames("near"),
      ...smoothRep((y) => pushUp(y, 62), PUSH_TOP, PUSH_BOTTOM, 0.2, 0.2, 3),
      ...sidePlankFrames("far"),
    ],
  },
  {
    id: "fedb_push_ups_close_triceps_position",
    slug: "close-triceps-push-up",
    title: "Push-Ups - Close Triceps Position",
    transition: 0.45,
    frames: rep(closeGrip, pushUpTop(CLOSE_HAND_X), -50, 0.4, 0.3),
  },
  {
    id: "wger_1086",
    slug: "close-grip-press-up",
    title: "Close-grip Press-ups",
    transition: 0.45,
    frames: rep(closeGrip, pushUpTop(CLOSE_HAND_X), -50, 0.4, 0.3),
  },
  {
    id: "wger_1777",
    slug: "deficit-push-up",
    title: "Deficit Push ups",
    props: DEFICIT_PROPS,
    transition: 0.12,
    frames: smoothRep(deficit, DEFICIT_TOP, DEFICIT_BOTTOM, 0.4, 0.3, 8),
  },
  {
    id: "wger_1217",
    slug: "finger-push-up",
    title: "Finger Pushup",
    transition: 0.5,
    frames: rep(finger, reachTop(PLANK_FOOT, [FINGER_WRIST, [FINGER_WRIST[0] - 2, FINGER_WRIST[1]]], 117.9), -50, 0.4, 0.3),
  },
];
