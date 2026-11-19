import { onStrap, SHOULDER_SIDE, type DoodleSpec, type Keyframe, type Point, type Pose, type Sideways } from "./rig";
import { TWO_VIEWS } from "./sideways";

/**
 * Batch AQ (#212): suspension-trainer (TRX) moves. Straps hang from one anchor
 * (`straps`), hands or feet are pinned on the strap circle with `onStrap` so a
 * strap keeps its length. Floor at y = 0, up is negative, the side-view figure
 * faces +x.
 *
 * Facing the anchor (rows, curl, face pull, Y raise) the figure leans back: head
 * at -x, hands up and forward to the handles. Facing away (push-up, fallout,
 * fly, reverse crunch, split squat) the anchor is behind.
 */

const round = (value: number): number => Math.round(value * 10) / 10;

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}

const angle = (from: Point, to: Point): number => (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;

/** Pelvis to shoulder, pelvis to the ankle of a straight leg, ankle to shoulder along a straight body. */
const SHOULDER_REACH = 98;
const LEG_REACH = 173.9;
const BODY_REACH = LEG_REACH + SHOULDER_REACH;
/** Shoulder to fingertip, arm straight (a hair short of locked). */
const ARM_REACH = 125.6;
const UPPER_ARM = 60;
/** Elbow to fingertip. */
const FOREARM_HAND = 66;

/** Where circles round `a` (radius ra) and `b` (radius rb) meet; `side` 1 or -1 picks the point left/right of a to b. */
function meet(a: Point, ra: number, b: Point, rb: number, side: 1 | -1): Point {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const x = (ra * ra - rb * rb + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, ra * ra - x * x));
  const ux = (b[0] - a[0]) / d;
  const uy = (b[1] - a[1]) / d;
  return [round(a[0] + ux * x - side * uy * h), round(a[1] + uy * x + side * ux * h)];
}

/** A straight body from the ankle: pelvis and chest at `deg`. */
function straightBody(ankle: Point, deg: number): Pick<Pose, "pelvis" | "chest"> {
  return { pelvis: along(ankle, deg, LEG_REACH), chest: along(ankle, deg, LEG_REACH + 80) };
}

/** Shoulder of a straight body from the ankle that sits `reach` from the hand (the hand fixes the lean). */
const shoulderFrom = (ankle: Point, hand: Point, reach: number, side: 1 | -1): Point => meet(ankle, BODY_REACH, hand, reach, side);

// ---------------------------------------------------------------- leaning rows (facing the anchor)

const LEAN_ANKLE: Point = [0, -10];
const ELBOW_SIDE = 1;

interface RowShape {
  anchor: Point;
  length: number;
  /** Strap angle from straight down at the bottom (arms straight) and at the top (negative: hands behind the anchor). */
  bottom: number;
  top: number;
  /** Shoulder to hand at the top. */
  topReach: number;
}

/** Heels down, body straight, hands on the strap; the shoulder follows the hand at `reach`. */
function leanRow(shape: RowShape, top: boolean, extra: Partial<Pose> = {}): Pose {
  const hand = onStrap(shape.anchor, shape.length, top ? shape.top : shape.bottom);
  const shoulder = shoulderFrom(LEAN_ANKLE, hand, top ? shape.topReach : ARM_REACH, -1);
  const deg = angle(LEAN_ANKLE, shoulder);
  return {
    ...straightBody(LEAN_ANKLE, deg),
    hands: { near: hand, far: hand },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: LEAN_ANKLE, far: [LEAN_ANKLE[0] - 3, LEAN_ANKLE[1]] },
    toes: { near: -110, far: -110 },
    ...extra,
  };
}

const ROW_A: RowShape = { anchor: [-10, -300], length: 125, bottom: -24, top: -28, topReach: 62 };
const ROW_B: RowShape = { anchor: [10, -290], length: 115, bottom: -22, top: -26, topReach: 66 };
const ROW_C: RowShape = { anchor: [-20, -310], length: 135, bottom: -20, top: -26, topReach: 72 };


function rowFrames(shape: RowShape, hold: [number, number]): Keyframe[] {
  const mid: RowShape = { ...shape };
  return [
    { hold: hold[0], pose: leanRow(shape, false) },
    { hold: 0, pose: leanRow({ ...mid, topReach: 92 }, true) },
    { hold: hold[1], pose: leanRow(shape, true) },
    { hold: 0, pose: leanRow({ ...mid, topReach: 92 }, true) },
  ];
}

// ---------------------------------------------------------------- suspended push-up (facing away)

const PUSH_HAND_Y = -48;
const PUSH_ANKLE: Point = [-170, -19];
const PUSH_ANCHOR: Point = [54, -215];

/** Plank on the handles: toes on the floor, hands under the anchor; the shoulder follows at `reach` from the hand. */
function suspendedPush(reach: number): Pose {
  const hand = onStrap(PUSH_ANCHOR, PUSH_HAND_Y - PUSH_ANCHOR[1], 0);
  const shoulder = shoulderFrom(PUSH_ANKLE, hand, reach, -1);
  const deg = angle(PUSH_ANKLE, shoulder);
  return {
    ...straightBody(PUSH_ANKLE, deg),
    hands: { near: hand, far: hand },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: PUSH_ANKLE, far: PUSH_ANKLE },
    toes: { near: 62, far: 62 },
  };
}


// ---------------------------------------------------------------- leaning curl (facing the anchor)

/** Body direction (degrees from the ankle) at the top, with the hands at the forehead. */
const CURL_TOP_DEG = -125;
/** The face looks forward of the spine (a quarter turn clockwise of the way the body points). */
const CURL_HAND: Point = along(along(LEAN_ANKLE, CURL_TOP_DEG, BODY_REACH + 38), CURL_TOP_DEG + 90, 56);
const CURL_ANCHOR: Point = along(CURL_HAND, -20, 90);
const CURL_BOTTOM_SHOULDER = shoulderFrom(LEAN_ANKLE, CURL_HAND, ARM_REACH, -1);

/**
 * The hands hang still on the straps; the body rises to them as the elbows
 * bend, the elbows staying up and forward. `t`: 0 straight arms, 1 hands at the forehead.
 */
function curl(t: number): Pose {
  const bottom = angle(LEAN_ANKLE, CURL_BOTTOM_SHOULDER);
  const deg = bottom + (CURL_TOP_DEG - bottom) * t;
  const shoulder = along(LEAN_ANKLE, deg, BODY_REACH);
  const reach = Math.hypot(CURL_HAND[0] - shoulder[0], CURL_HAND[1] - shoulder[1]);
  const elbow = reach < ARM_REACH - 2 ? meet(shoulder, UPPER_ARM, CURL_HAND, FOREARM_HAND, ELBOW_SIDE) : undefined;
  return {
    ...straightBody(LEAN_ANKLE, deg),
    hands: { near: CURL_HAND, far: CURL_HAND },
    elbows: elbow ? { near: { at: elbow }, far: { at: elbow } } : { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: LEAN_ANKLE, far: [LEAN_ANKLE[0] - 3, LEAN_ANKLE[1]] },
    toes: { near: -110, far: -110 },
  };
}

// ---------------------------------------------------------------- fallout (facing away)

const FALL_ANKLE: Point = [-170, -19];

interface FalloutShape {
  anchor: Point;
  length: number;
}

/** A shape whose hands start `startAngle` degrees below horizontal forward of the shoulder at `startLean`, the anchor `tilt` degrees back from straight above them. */
function falloutShape(startLean: number, startAngle: number, length: number, tilt: number): FalloutShape {
  const shoulder = along(FALL_ANKLE, -startLean, BODY_REACH);
  const hand = along(shoulder, startAngle, ARM_REACH);
  return { anchor: along(hand, -90 - tilt, length), length };
}

/** Straight body leaning `lean` degrees above the floor; straight arms from the shoulder to the hand on the strap circle. */
function fallout(shape: FalloutShape, lean: number): Pose {
  const shoulder = along(FALL_ANKLE, -lean, BODY_REACH);
  const hand = meet(shoulder, ARM_REACH, shape.anchor, shape.length, 1);
  const chest = along(FALL_ANKLE, -lean, LEG_REACH + 80);
  return {
    pelvis: along(FALL_ANKLE, -lean, LEG_REACH),
    chest,
    hands: { near: hand, far: hand },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: FALL_ANKLE, far: FALL_ANKLE },
    toes: { near: 62, far: 62 },
  };
}

/** Hands on the handles in line with the shoulders. */
const FALL_SIDEWAYS: Sideways = { hands: { near: -SHOULDER_SIDE, far: SHOULDER_SIDE }, feet: { near: -10, far: 10 } };
const FALL_A = falloutShape(46, 10, 120, 35);
const FALL_B = falloutShape(50, 0, 110, 40);


// ---------------------------------------------------------------- two-view helpers

/**
 * The side-view hand for a hand `hz` sideways on a strap: it keeps its arm
 * length `reach` from the shoulder (at `shoulderZ`) and its strap length
 * `length` from the anchor (at `anchorZ`) in 3D, so each circle shrinks by the
 * sideways offset. `side` picks which of the two meeting points.
 */
function strapHand(shoulder: Point, shoulderZ: number, handZ: number, anchor: Point, anchorZ: number, length: number, reach: number, side: 1 | -1): Point {
  const r1 = Math.sqrt(Math.max(0, reach ** 2 - (handZ - shoulderZ) ** 2));
  const r2 = Math.sqrt(Math.max(0, length ** 2 - (handZ - anchorZ) ** 2));
  return meet(shoulder, r1, anchor, r2, side);
}

/** Hands `z` out from the middle, feet a little apart. */
const handsAt = (z: number): Sideways => ({ hands: { near: -z, far: z }, feet: { near: -10, far: 10 } });

// ---------------------------------------------------------------- chest fly (facing away)

const FLY_L = 170;
const FLY_REACH = 121;
const FLY_NARROW = SHOULDER_SIDE;
const FLY_START = along(FALL_ANKLE, -46, BODY_REACH);
const FLY_A: Point = along(along(FLY_START, 12, FLY_REACH), -90 - 35, FLY_L);

/** Soft elbows, body straight and leaning `lean` degrees above the floor, hands `z` out from the middle. */
function fly(lean: number, z: number): Keyframe {
  const shoulder = along(FALL_ANKLE, -lean, BODY_REACH);
  const hand = strapHand(shoulder, SHOULDER_SIDE, z, FLY_A, FLY_NARROW, FLY_L, FLY_REACH, 1);
  const pose: Pose = {
    ...straightBody(FALL_ANKLE, -lean),
    hands: { near: hand, far: hand },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: FALL_ANKLE, far: FALL_ANKLE },
    toes: { near: 62, far: 62 },
  };
  return { hold: 0, pose, sideways: handsAt(z) };
}

// ---------------------------------------------------------------- Y raise and face pull (facing the anchor, two views)

const PULL_REACH = 124;
const PULL_L = 120;
const Y_L = 150;
/** Body direction from the ankle (degrees) at the bottom and at the top. */
const PULL_BOTTOM_DEG = -140;
const PULL_TOP_DEG = -122;

const pullShoulder = (deg: number): Point => along(LEAN_ANKLE, deg, BODY_REACH);
const PULL_BOTTOM_HAND: Point = along(pullShoulder(PULL_BOTTOM_DEG), -20, PULL_REACH);

/** Straight body leaning back, soft elbows; `hand` is the side-view hand, `z` how far out the hands are. */
function pullKey(deg: number, hand: Point, z: number, extra: Partial<Pose> = {}, sideways: Sideways = {}): Keyframe {
  const pose: Pose = {
    ...straightBody(LEAN_ANKLE, deg),
    hands: { near: hand, far: hand },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: LEAN_ANKLE, far: [LEAN_ANKLE[0] - 3, LEAN_ANKLE[1]] },
    toes: { near: -110, far: -110 },
    ...extra,
  };
  const wide = handsAt(z);
  return { hold: 0, pose, sideways: { ...wide, ...sideways, feet: { near: -10, far: 10 } } };
}

// Y raise: the anchor sits ahead of and above the starting hands; the hands stay on their strap as they open out.
const Y_A: Point = along(PULL_BOTTOM_HAND, -90 + 15, Y_L);

/** Arms open from straight ahead into a Y while the body rises to the hands. */
function yRaise(t: number): Keyframe {
  const deg = PULL_BOTTOM_DEG + (PULL_TOP_DEG - PULL_BOTTOM_DEG) * t;
  const z = SHOULDER_SIDE + 70 * t;
  const hand = strapHand(pullShoulder(deg), SHOULDER_SIDE, z, Y_A, SHOULDER_SIDE, Y_L, PULL_REACH - 2 * t, -1);
  return pullKey(deg, hand, z);
}

// Face pull: the hands finish beside the temples, the elbows high and wide.
const FACE_DEG = PULL_TOP_DEG;
const FACE_Z = 36;
const FACE_ELBOW_Z = 80;
const FACE_HEAD: Point = along(LEAN_ANKLE, FACE_DEG, BODY_REACH + 38);
/** The elbow at the top: out beside the shoulder in z, so only a little in front of it in the side view. */
const FACE_ELBOW: Point = along(pullShoulder(FACE_DEG), -60, Math.sqrt(UPPER_ARM ** 2 - (FACE_ELBOW_Z - SHOULDER_SIDE) ** 2));
/** The hand a forearm's length (in 3D) from that elbow, towards the head. */
const FACE_HAND: Point = (() => {
  const reach = Math.sqrt(FOREARM_HAND ** 2 - (FACE_ELBOW_Z - FACE_Z) ** 2);
  const toHead = Math.hypot(FACE_HEAD[0] - FACE_ELBOW[0], FACE_HEAD[1] - FACE_ELBOW[1]);
  return [round(FACE_ELBOW[0] + ((FACE_HEAD[0] - FACE_ELBOW[0]) / toHead) * reach), round(FACE_ELBOW[1] + ((FACE_HEAD[1] - FACE_ELBOW[1]) / toHead) * reach)];
})();
const FACE_A: Point = meet(PULL_BOTTOM_HAND, PULL_L, FACE_HAND, Math.sqrt(PULL_L ** 2 - (FACE_Z - SHOULDER_SIDE) ** 2), 1);

/** `t` of the way round the strap circle from the starting hand to the temples, a hair outside it between (the arm swings the hand a little inside the circle). */
function roundHand(t: number): Point {
  const a0 = angle(FACE_A, PULL_BOTTOM_HAND);
  const a1 = angle(FACE_A, FACE_HAND);
  const r0 = Math.hypot(PULL_BOTTOM_HAND[0] - FACE_A[0], PULL_BOTTOM_HAND[1] - FACE_A[1]);
  const r1 = Math.hypot(FACE_HAND[0] - FACE_A[0], FACE_HAND[1] - FACE_A[1]);
  return along(FACE_A, a0 + (a1 - a0) * t, r0 + (r1 - r0) * t + 4 * Math.sin(Math.PI * t));
}

/** The hands travel round their strap from straight ahead to the temples; at the top the elbows are pinned up and out. */
function facePull(t: number): Keyframe {
  const deg = PULL_BOTTOM_DEG + (FACE_DEG - PULL_BOTTOM_DEG) * t;
  const z = SHOULDER_SIDE + (FACE_Z - SHOULDER_SIDE) * t;
  const top = t === 1;
  let hand = roundHand(t);
  if (t === 0) hand = PULL_BOTTOM_HAND;
  else if (top) hand = FACE_HAND;
  return pullKey(
    deg,
    hand,
    z,
    top ? { elbows: { near: { at: FACE_ELBOW }, far: { at: FACE_ELBOW } } } : {},
    top ? { elbows: { near: { at: -FACE_ELBOW_Z }, far: { at: FACE_ELBOW_Z } } } : {},
  );
}

// ---------------------------------------------------------------- reverse crunch (feet in the cradles, facing away)

const CRUNCH_HAND: Point = [60, 0];
const CRUNCH_ANCHOR: Point = [-196, -210];
const CRUNCH_L = 175;
const KNEE_BEND = -1;

/** The spine keeps its length: the pelvis circles the shoulder, `tilt` degrees above the plank's line. */
function crunch(swing: number, spineDeg: number | undefined): Pose {
  const ankle = onStrap(CRUNCH_ANCHOR, CRUNCH_L, swing);
  const shoulder: Point = [CRUNCH_HAND[0], CRUNCH_HAND[1] - ARM_REACH];
  const body = spineDeg === undefined ? straightBody(ankle, angle(ankle, shoulder)) : { pelvis: along(shoulder, spineDeg, SHOULDER_REACH) };
  return {
    ...body,
    hands: { near: CRUNCH_HAND, far: CRUNCH_HAND },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { bend: KNEE_BEND }, far: { bend: KNEE_BEND } },
    feet: { near: ankle, far: ankle },
    toes: { near: 105, far: 105 },
  };
}

// ---------------------------------------------------------------- split squat, rear foot in the strap (facing away)

const SPLIT_ANCHOR: Point = [-125, -215];
const SPLIT_L = 165;

function splitSquat(pelvisY: number): Pose {
  const pelvis: Point = [-10, pelvisY];
  return {
    pelvis,
    chest: [pelvis[0], pelvis[1] - 80],
    hands: { near: [pelvis[0] + 110, pelvis[1] - 82], far: [pelvis[0] + 104, pelvis[1] - 82] },
    feet: { near: [60, 0], far: onStrap(SPLIT_ANCHOR, SPLIT_L, 0) },
    toes: { near: 0, far: 130 },
    knees: { near: { bend: -1 }, far: { bend: -1 } },
  };
}

export const BATCH_AQ_SPECS: DoodleSpec[] = [
  {
    id: "wger_927",
    slug: "suspended-chest-fly-crossing",
    title: "Suspended Chest Fly (Crossing)",
    views: TWO_VIEWS,
    straps: { anchor: FLY_A, end: "handle" },
    transition: 0.8,
    frames: [
      { ...fly(46, FLY_NARROW), hold: 0.2 },
      { ...fly(42, 60), hold: 0 },
      { ...fly(38, 90), hold: 0.5 },
      { ...fly(42, 60), hold: 0 },
      { ...fly(44, -8), hold: 0.4 },
      { ...fly(45, 7), hold: 0 },
    ],
  },
  {
    id: "wger_2765",
    slug: "suspended-y-raise",
    title: "Suspended Y Raise",
    views: TWO_VIEWS,
    straps: { anchor: Y_A, end: "handle" },
    transition: 0.9,
    frames: [
      { ...yRaise(0), hold: 0.4 },
      { ...yRaise(0.5), hold: 0 },
      { ...yRaise(1), hold: 0.5 },
      { ...yRaise(0.5), hold: 0 },
    ],
  },
  {
    id: "wger_2766",
    slug: "suspended-face-pull",
    title: "Suspended Face Pull",
    views: TWO_VIEWS,
    straps: { anchor: FACE_A, end: "handle" },
    transition: 0.4,
    frames: [
      { ...facePull(0), hold: 0.4 },
      { ...facePull(0.25), hold: 0 },
      { ...facePull(0.5), hold: 0 },
      { ...facePull(0.75), hold: 0 },
      { ...facePull(0.9), hold: 0 },
      { ...facePull(1), hold: 0.5 },
      { ...facePull(0.9), hold: 0 },
      { ...facePull(0.75), hold: 0 },
      { ...facePull(0.5), hold: 0 },
      { ...facePull(0.25), hold: 0 },
    ],
  },
  {
    id: "wger_2763",
    slug: "suspended-chest-fly",
    title: "Suspended Chest Fly",
    views: TWO_VIEWS,
    straps: { anchor: FLY_A, end: "handle" },
    transition: 0.8,
    frames: [
      { ...fly(46, FLY_NARROW), hold: 0.4 },
      { ...fly(42, 60), hold: 0 },
      { ...fly(38, 90), hold: 0.5 },
      { ...fly(42, 60), hold: 0 },
    ],
  },
  {
    id: "fedb_suspended_row",
    slug: "suspended-row",
    title: "Suspended Row",
    straps: { anchor: ROW_A.anchor, end: "handle" },
    transition: 1,
    frames: rowFrames(ROW_A, [0.4, 0.5]),
  },
  {
    id: "wger_674",
    slug: "suspended-leaning-row",
    title: "Suspended Leaning Row",
    straps: { anchor: ROW_B.anchor, end: "handle" },
    transition: 1,
    frames: rowFrames(ROW_B, [0.4, 0.5]),
  },
  {
    id: "wger_959",
    slug: "suspended-row-pull-up-lead-up",
    title: "Suspended Row (Pull-Up Lead-Up)",
    straps: { anchor: ROW_C.anchor, end: "handle" },
    transition: 1,
    frames: rowFrames(ROW_C, [0.4, 0.5]),
  },
  {
    id: "wger_958",
    slug: "suspended-curl",
    title: "Suspended Curl",
    straps: { anchor: CURL_ANCHOR, end: "handle" },
    transition: 1,
    frames: [
      { hold: 0.4, pose: curl(0) },
      { hold: 0, pose: curl(0.5) },
      { hold: 0.5, pose: curl(1) },
      { hold: 0, pose: curl(0.5) },
    ],
  },
  {
    id: "fedb_suspended_push_up",
    slug: "suspended-push-up",
    title: "Suspended Push-Up",
    straps: { anchor: PUSH_ANCHOR, end: "handle" },
    transition: 1,
    frames: [
      { hold: 0.4, pose: suspendedPush(ARM_REACH) },
      { hold: 0.4, pose: suspendedPush(70) },
    ],
  },
  {
    id: "wger_2764",
    slug: "suspended-push-up-low-handles",
    title: "Suspended Push-Up (Low Handles)",
    straps: { anchor: PUSH_ANCHOR, end: "handle" },
    transition: 1,
    frames: [
      { hold: 0.4, pose: suspendedPush(ARM_REACH) },
      { hold: 0.4, pose: suspendedPush(84) },
    ],
  },
  {
    id: "fedb_suspended_fallout",
    slug: "suspended-fallout",
    title: "Suspended Fallout",
    views: TWO_VIEWS,
    straps: { anchor: FALL_A.anchor, end: "handle" },
    transition: 0.7,
    frames: [
      { hold: 0.4, pose: fallout(FALL_A, 46), sideways: FALL_SIDEWAYS },
      { hold: 0, pose: fallout(FALL_A, 32), sideways: FALL_SIDEWAYS },
      { hold: 0.6, pose: fallout(FALL_A, 18), sideways: FALL_SIDEWAYS },
      { hold: 0, pose: fallout(FALL_A, 32), sideways: FALL_SIDEWAYS },
    ],
  },
  {
    id: "wger_1246",
    slug: "suspended-rollout",
    title: "Suspended Rollout",
    views: TWO_VIEWS,
    straps: { anchor: FALL_B.anchor, end: "handle" },
    transition: 0.7,
    frames: [
      { hold: 0.4, pose: fallout(FALL_B, 50), sideways: FALL_SIDEWAYS },
      { hold: 0, pose: fallout(FALL_B, 36), sideways: FALL_SIDEWAYS },
      { hold: 0.6, pose: fallout(FALL_B, 20), sideways: FALL_SIDEWAYS },
      { hold: 0, pose: fallout(FALL_B, 36), sideways: FALL_SIDEWAYS },
    ],
  },
  {
    id: "fedb_suspended_reverse_crunch",
    slug: "suspended-reverse-crunch",
    title: "Suspended Reverse Crunch",
    straps: { anchor: CRUNCH_ANCHOR, end: "handle", to: "feet" },
    transition: 0.8,
    frames: [
      { hold: 0.4, pose: crunch(0, undefined) },
      { hold: 0, pose: crunch(25, 180) },
      { hold: 0.5, pose: crunch(45, 198) },
      { hold: 0, pose: crunch(25, 180) },
    ],
  },
  {
    id: "fedb_suspended_split_squat",
    slug: "suspended-split-squat",
    title: "Suspended Split Squat",
    straps: { anchor: SPLIT_ANCHOR, end: "handle", to: "feet", sides: ["far"] },
    transition: 1,
    frames: [
      { hold: 0.4, pose: splitSquat(-150) },
      { hold: 0.4, pose: splitSquat(-100) },
    ],
  },
];
