import { solvePose } from "./rig";
import type { DoodleSpec, Keyframe, Point, Pose } from "./rig";

/**
 * Batch C: the last 14 moves of section 2 in docs/doodles-to-prepare.md.
 * Floor at y = 0, up is negative, the figure faces +x (so a plank has the head
 * at +x and lying face up has the head at -x).
 */

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}

const round = (value: number): number => Math.round(value * 10) / 10;
const angle = (from: Point, to: Point): number => (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;

/** Ankle to shoulder of a straight body (leg 173.9 + pelvis-to-shoulder 98). */
const BODY = 271.9;

/**
 * Straight body pivoting on fixed ankles: the shoulder sits at height `shoulderY`
 * on the circle of radius BODY around `foot`. Returns pelvis and chest.
 */
function straightBody(foot: Point, shoulderY: number, dirX: 1 | -1 = 1): { pelvis: Point; chest: Point; shoulder: Point } {
  const dx = Math.sqrt(BODY ** 2 - (shoulderY - foot[1]) ** 2);
  const shoulder: Point = [foot[0] + dirX * dx, shoulderY];
  const deg = angle(foot, shoulder);
  return { pelvis: along(foot, deg, 173.9), chest: along(foot, deg, 253.9), shoulder };
}

/** Arm length with the elbow locked (shoulder to fingertip, a hair short of 126). */
const LOCKED = 125.97;

/** Shoulder height at which a straight body on `foot` reaches `hand` with a locked arm. */
function lockedShoulderY(foot: Point, hand: Point, dirX: 1 | -1 = 1, below = false): number {
  // Searches between "too far" (a full arm above or below the hand) and "too close".
  let lo = below ? hand[1] + LOCKED : hand[1] - LOCKED;
  let hi = below ? hand[1] + 1 : hand[1] - 1;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    const { shoulder } = straightBody(foot, mid, dirX);
    if (Math.hypot(shoulder[0] - hand[0], shoulder[1] - hand[1]) > LOCKED) lo = mid;
    else hi = mid;
  }
  return round((lo + hi) / 2);
}

/**
 * One rep of a straight body pivoting on the ankles: top, a midway frame, bottom, midway.
 * The pelvis is blended in a straight line between keyframes, so the midway frame keeps the
 * chord short enough that the legs stay (nearly) straight.
 */
function rep(at: (shoulderY: number) => Pose, top: number, bottom: number, holdTop: number, holdBottom: number): Keyframe[] {
  const mid = at(round((top + bottom) / 2));
  return [
    { hold: holdTop, pose: at(top) },
    { hold: 0, pose: mid },
    { hold: holdBottom, pose: at(bottom) },
    { hold: 0, pose: mid },
  ];
}

// ---------------------------------------------------------------- push-ups on the floor

const PLANK_FOOT: Point = [-190, -18];

/** Floor push-up with the hands at `handX`; `shoulderY` -123 is the top, about -48 the bottom. */
function pushUp(shoulderY: number | "top", handX: number, foot: Point = PLANK_FOOT): Pose {
  const y = shoulderY === "top" ? pushUpTop(handX, foot) : shoulderY;
  const { pelvis, chest } = straightBody(foot, y);
  return {
    pelvis,
    chest,
    hands: { near: [handX, 0], far: [handX - 2, 0] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: foot, far: foot },
    toes: { near: 62, far: 62 },
  };
}

/** Shoulder height of the top of a floor push-up (arms locked). */
const pushUpTop = (handX: number, foot: Point = PLANK_FOOT): number => lockedShoulderY(foot, [handX, 0]);

/** Diamond push-up: hands together under the chest, a little behind the shoulders. */
const DIAMOND_HAND_X = 40;

/** One-arm push-up: the near hand supports, the far hand rests on the lower back. */
function oneArm(shoulderY: number): Pose {
  const base = pushUp(shoulderY, 62);
  const pelvis = base.pelvis as Point;
  const deg = angle(pelvis, base.chest as Point);
  const back = along(along(pelvis, deg, 30), deg - 90, 12);
  return {
    ...base,
    hands: { near: [62, 0], far: back },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
  };
}

/** High plank; `tap` lifts that hand to the opposite shoulder. */
function shoulderTap(tap: "near" | "far" | null): Pose {
  const base = pushUp("top", 62);
  if (!tap) return base;
  const { shoulder } = straightBody(PLANK_FOOT, lockedShoulderY(PLANK_FOOT, [62, 0]));
  const hand: Point = [round(shoulder[0] - 6), round(shoulder[1] + 30)];
  const other = tap === "near" ? "far" : "near";
  return {
    ...base,
    hands: { [tap]: hand, [other]: [62, 0] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
  };
}

/** Superman push-up: the whole body in the air, arms reaching forward and up, legs long. */
function superman(): Pose {
  const shoulder: Point = [72, -122];
  const foot = along(shoulder, 176, BODY);
  const deg = angle(foot, shoulder);
  // Arms long and reaching forward, a little below the line of the body so they pass under the head.
  const reach = along(shoulder, 32, LOCKED);
  return {
    pelvis: along(foot, deg, 173.9),
    chest: along(foot, deg, 253.9),
    hands: { near: reach, far: along(shoulder, 34, LOCKED) },
    feet: { near: foot, far: foot },
    toes: { near: 176, far: 176 },
  };
}

// ---------------------------------------------------------------- low incline push-up

const LOW_BOX = { x: 70, w: 90, h: 45 };
const LOW_HAND: Point = [100, -47];
const LOW_FOOT: Point = [-150, -18];

function lowIncline(shoulderY: number): Pose {
  const { pelvis, chest } = straightBody(LOW_FOOT, shoulderY);
  return {
    pelvis,
    chest,
    hands: { near: LOW_HAND, far: [LOW_HAND[0] - 2, LOW_HAND[1]] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: LOW_FOOT, far: LOW_FOOT },
    toes: { near: 62, far: 62 },
  };
}

// ---------------------------------------------------------------- pull-ups (front view, as the chin-up)

const HIGH_BAR = -420;
const JUMP_BAR = -410;
/** Low box the jumping pull-up starts from (top at y = -30). */
const JUMP_BOX = -30;
const GRIP = 64;

/** Front-view hang from a bar at `bar` with hands at ±GRIP, legs straight under the hips. */
function frontHang(pelvisY: number, bar: number, feetY?: number): Pose {
  return {
    pelvis: [0, pelvisY],
    chest: [0, pelvisY - 80],
    hands: { near: [-GRIP, bar], far: [GRIP, bar] },
    // Elbows fold down and out.
    elbows: { near: { bend: -1 }, far: { bend: 1 } },
    feet: { near: [-14, feetY ?? pelvisY + 173.7], far: [14, feetY ?? pelvisY + 173.7] },
    knees: { near: { bend: 1 }, far: { bend: -1 } },
    toes: { near: 180, far: 0 },
  };
}

// ---------------------------------------------------------------- handstand push-ups

/** Free handstand, hands at x 52 (as in press-to-handstand). */
function handstand(): Pose {
  return {
    pelvis: [54, -223.5],
    chest: [60.5, -143.6],
    head: [92, -104],
    hands: { near: [52, -1], far: [50, -1.5] },
    feet: { near: [46, -397], far: [42, -397] },
    toes: { near: -90, far: -90 },
  };
}

/** Bent arms with the body tilted `bodyDeg` from the shoulder towards the feet (180 = level, back). */
function hspuTilt(forearmDeg: number, upperDeg: number, bodyDeg: number): Pose {
  const hand: Point = [52, -1];
  const elbow = along(hand, forearmDeg, 66);
  const shoulder = along(elbow, upperDeg, 60);
  const pelvis = along(shoulder, bodyDeg, 98);
  return {
    pelvis,
    chest: along(shoulder, bodyDeg, 18),
    hands: { near: hand, far: hand },
    elbows: { near: { at: elbow }, far: { at: elbow } },
    feet: { near: along(pelvis, bodyDeg, 174), far: along(pelvis, bodyDeg, 174) },
    toes: { near: bodyDeg + 20, far: bodyDeg + 20 },
  };
}

const BLOCK_H = 40;
const DEFICIT_HAND: Point = [52, -BLOCK_H - 1];
const DEFICIT_WALL_X = 17;

/** Wall handstand on blocks: the heels rest on the wall behind. */
function deficitTop(): Pose {
  const shoulder: Point = [52, DEFICIT_HAND[1] - 126];
  const dir = -94.2;
  const pelvis = along(shoulder, dir, 98);
  return {
    pelvis,
    chest: along(pelvis, dir + 180, 80),
    head: [75, shoulder[1] + 29],
    hands: { near: DEFICIT_HAND, far: [DEFICIT_HAND[0] - 2, DEFICIT_HAND[1]] },
    feet: { near: along(pelvis, dir, 174), far: along(pelvis, dir, 174) },
    toes: { near: -75, far: -75 },
  };
}

/** Bottom of the deficit push-up: forearms near vertical, head below the hands, in front of the blocks. */
function deficitBottom(upperDeg: number, forearmDeg: number): Pose {
  const elbow = along(DEFICIT_HAND, forearmDeg, 66);
  const shoulder = along(elbow, upperDeg, 60);
  // Body leans back from the shoulders so the heels stay on the wall.
  const dir = angle(shoulder, [DEFICIT_WALL_X + 17, shoulder[1] - 263]);
  const pelvis = along(shoulder, dir, 98);
  const chest = along(shoulder, dir, 18);
  const neck = along(chest, dir + 180, 20);
  return {
    pelvis,
    chest,
    head: along(neck, dir + 180, 36),
    hands: { near: DEFICIT_HAND, far: DEFICIT_HAND },
    elbows: { near: { at: elbow }, far: { at: elbow } },
    feet: { near: along(pelvis, dir, 174), far: along(pelvis, dir, 174) },
    toes: { near: -75, far: -75 },
  };
}

// ---------------------------------------------------------------- cat plank

function catPlank(breathe: 0 | 1): Pose {
  const pelvis: Point = [-50, -96 - breathe * 2];
  const knee = along(pelvis, 79.5 - breathe, 88);
  const ankle = along(knee, 184, 86);
  return {
    pelvis,
    chest: [26, -110 - breathe * 3],
    head: [76, -96 - breathe * 2],
    spine: { bend: -1 },
    hands: { near: [48, 0], far: [44, 0] },
    knees: { near: { at: knee }, far: { at: knee } },
    feet: { near: ankle, far: ankle },
    toes: { near: round(Math.asin(-ankle[1] / 20) * (180 / Math.PI)), far: round(Math.asin(-ankle[1] / 20) * (180 / Math.PI)) },
  };
}

// ---------------------------------------------------------------- lying on a flat bench

const BENCH_TOP = -44;

/** Lying face up on the bench: copy of lyingFaceUp raised to the bench top; arms long beside the hips. */
function onBench(pelvisRel: Point): Pose {
  const pelvis: Point = [pelvisRel[0], pelvisRel[1] + BENCH_TOP];
  const top = -18 + BENCH_TOP;
  const dy = top - pelvis[1];
  const chest: Point = [round(pelvis[0] - Math.sqrt(77 ** 2 - dy * dy)), top];
  const head: Point = [round(chest[0] - 55), -24 + BENCH_TOP];
  const base: Pose = { pelvis, chest, head, spine: { bend: -1 } };
  const shoulder = solvePose(base).arms.near.root;
  const reach = 125.4;
  const handY = -6 + BENCH_TOP;
  const handX = round(shoulder[0] + Math.sqrt(reach ** 2 - (shoulder[1] - handY) ** 2));
  return {
    ...base,
    hands: { near: [handX, handY], far: [handX, handY - 1] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
  };
}

function benchLegs(deg: number): Pose {
  const base = onBench([-12, -20]);
  const pelvis = base.pelvis as Point;
  return {
    ...base,
    feet: { near: along(pelvis, deg, 173.9), far: along(pelvis, deg - 1, 173.4) },
    toes: { near: deg, far: deg },
  };
}

/** Knees drawn towards the chest; `thigh` is the thigh angle from the hips. */
function benchTuck(thigh: number, shin: number): Pose {
  const base = onBench([-12, -20]);
  const pelvis = base.pelvis as Point;
  const kneeNear = along(pelvis, thigh, 88);
  const kneeFar = along(pelvis, thigh - 2, 88);
  return {
    ...base,
    knees: { near: { at: kneeNear }, far: { at: kneeFar } },
    feet: { near: along(kneeNear, shin, 86), far: along(kneeFar, shin - 2, 86) },
    toes: { near: shin - 10, far: shin - 10 },
  };
}

// ---------------------------------------------------------------- inverted row (head at -x, face up)

const ROW_BAR = -200;
const ROW_FOOT: Point = [170, -8];
/** Chest-to-bar shoulder height; the hands sit over the chest there. */
const ROW_TOP_Y = -185;
const ROW_HAND_X = round(straightBody(ROW_FOOT, ROW_TOP_Y, -1).shoulder[0] + 25);

/** Straight body from the heels; `shoulderY` sets how high the chest is. */
/** Shoulder height at the bottom of the row (arms straight). */
const ROW_HANG_Y = lockedShoulderY(ROW_FOOT, [ROW_HAND_X, ROW_BAR], -1, true);

function invertedRow(shoulderY: number): Pose {
  const { pelvis, chest } = straightBody(ROW_FOOT, shoulderY, -1);
  return {
    pelvis,
    chest,
    hands: { near: [ROW_HAND_X, ROW_BAR], far: [ROW_HAND_X, ROW_BAR] },
    // Elbows drive down past the body, towards the floor and the feet.
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: ROW_FOOT, far: ROW_FOOT },
  };
}

// ---------------------------------------------------------------- manna

/** Seated support: hands under the hips, shoulders behind them; `torso` and `legs` are angles from the pelvis. */
function mannaPose(pelvis: Point, torso: number, legs: number): Pose {
  const shoulder = along(pelvis, torso, 98);
  const handX = round(shoulder[0] + Math.sqrt(125.4 ** 2 - shoulder[1] ** 2));
  return {
    pelvis,
    chest: along(pelvis, torso, 80),
    hands: { near: [handX, 0], far: [handX - 2, 0] },
    feet: { near: along(pelvis, legs, 173.9), far: along(pelvis, legs - 1, 173.6) },
    toes: { near: legs, far: legs },
  };
}

export const BATCH_C_SPECS: DoodleSpec[] = [
  {
    id: "hf_4",
    slug: "diamond-push-up",
    title: "Diamond Push-Up",
    transition: 0.45,
    frames: rep((y) => pushUp(y, DIAMOND_HAND_X), pushUpTop(DIAMOND_HAND_X), -50, 0.4, 0.3),
  },
  {
    id: "hf_54",
    slug: "explosive-pull-up",
    title: "Explosive Pull-Up",
    view: "front",
    props: [{ kind: "bar", y: HIGH_BAR, x1: -150, x2: 150, grips: [-GRIP, GRIP] }],
    transition: 0.45,
    frames: [
      { hold: 0.5, pose: frontHang(-209, HIGH_BAR) },
      // Fast up (one transition) until the chest reaches the bar; lowered over two.
      { hold: 0.3, pose: frontHang(-318, HIGH_BAR) },
      { hold: 0, pose: frontHang(-268, HIGH_BAR) },
    ],
  },
  {
    id: "wger_2748",
    slug: "jumping-pull-up",
    title: "Jumping Pull-Up",
    view: "front",
    props: [
      { kind: "bar", y: JUMP_BAR, x1: -150, x2: 150, grips: [-GRIP, GRIP] },
      { kind: "box", x: -60, y: JUMP_BOX, w: 120, h: -JUMP_BOX },
    ],
    transition: 0.5,
    frames: [
      // Standing on a low box under the bar, knees soft, arms a little bent.
      { hold: 0.4, pose: frontHang(-203.6, JUMP_BAR, JUMP_BOX) },
      // Jump and pull in one go: chin over the bar, feet off the box.
      { hold: 0.3, pose: frontHang(-308, JUMP_BAR) },
      // Lowered slowly (three transitions) to straight arms, feet back on the box.
      { hold: 0, pose: frontHang(-275, JUMP_BAR) },
      { hold: 0, pose: frontHang(-238, JUMP_BAR) },
    ],
  },
  {
    id: "ntc_incline_push_up_low",
    slug: "low-incline-push-up",
    title: "Low incline push-up",
    props: [{ kind: "box", x: LOW_BOX.x, y: -LOW_BOX.h, w: LOW_BOX.w, h: LOW_BOX.h }],
    transition: 0.45,
    frames: rep(lowIncline, lockedShoulderY(LOW_FOOT, LOW_HAND), -90, 0.4, 0.3),
  },
  {
    id: "hf_8",
    slug: "one-arm-push-up",
    title: "One-Arm Push-Up",
    transition: 0.55,
    frames: rep(oneArm, pushUpTop(62), -56, 0.4, 0.3),
  },
  {
    id: "hf_124",
    slug: "plank-shoulder-tap",
    title: "Plank Shoulder Tap",
    transition: 0.5,
    frames: [
      { hold: 0.2, pose: shoulderTap(null) },
      { hold: 0.3, pose: shoulderTap("near") },
      { hold: 0.2, pose: shoulderTap(null) },
      { hold: 0.3, pose: shoulderTap("far") },
    ],
  },
  {
    id: "hf_18",
    slug: "superman-push-up",
    title: "Superman Push-Up",
    transition: 0.4,
    frames: [
      { hold: 0.4, pose: pushUp("top", 62) },
      { hold: 0, pose: pushUp(round((pushUpTop(62) - 52) / 2), 62) },
      { hold: 0.1, pose: pushUp(-52, 62) },
      // Explode: straight through the top and into the air, arms reaching forward.
      { hold: 0, pose: pushUp(round((pushUpTop(62) - 52) / 2), 62) },
      { hold: 0, pose: pushUp("top", 62) },
      { hold: 0.25, pose: superman() },
    ],
  },
  {
    id: "hf_23",
    slug: "90-degree-handstand-push-up",
    title: "90-Degree Handstand Push-Up",
    transition: 1,
    frames: [
      { hold: 0.6, pose: handstand() },
      { hold: 0, pose: hspuTilt(-95, -60, -135) },
      { hold: 0.5, pose: hspuTilt(-100, -15, 180) },
      { hold: 0, pose: hspuTilt(-95, -60, -135) },
    ],
  },
  {
    id: "wger_1911",
    slug: "cat-plank",
    title: "Cat Plank",
    transition: 1.6,
    frames: [
      { hold: 1.2, pose: catPlank(0) },
      { hold: 1.2, pose: catPlank(1) },
    ],
  },
  {
    id: "hf_21",
    slug: "deficit-handstand-push-up",
    title: "Deficit Handstand Push-Up",
    props: [
      { kind: "box", x: DEFICIT_WALL_X, y: -520, w: 14, h: 520 },
      { kind: "box", x: 45, y: -BLOCK_H, w: 14, h: BLOCK_H },
    ],
    transition: 0.7,
    frames: [
      { hold: 0.5, pose: deficitTop() },
      { hold: 0, pose: deficitBottom(-50, -92) },
      { hold: 0.4, pose: deficitBottom(20, -95) },
      { hold: 0, pose: deficitBottom(-50, -92) },
    ],
  },
  {
    id: "fedb_flat_bench_leg_pull_in",
    slug: "flat-bench-leg-pull-in",
    title: "Flat Bench Leg Pull-In",
    props: [{ kind: "box", x: -190, y: BENCH_TOP, w: 220, h: -BENCH_TOP }],
    transition: 0.9,
    frames: [
      { hold: 0.4, pose: benchLegs(-6) },
      { hold: 0.5, pose: benchTuck(-122, 8) },
    ],
  },
  {
    id: "fedb_flat_bench_lying_leg_raise",
    slug: "flat-bench-lying-leg-raise",
    title: "Flat Bench Lying Leg Raise",
    props: [{ kind: "box", x: -190, y: BENCH_TOP, w: 220, h: -BENCH_TOP }],
    transition: 0.35,
    frames: [
      { hold: 0.5, pose: benchLegs(-6) },
      { hold: 0.05, pose: benchLegs(-30) },
      { hold: 0.05, pose: benchLegs(-60) },
      { hold: 0.5, pose: benchLegs(-88) },
      { hold: 0.05, pose: benchLegs(-60) },
      { hold: 0.05, pose: benchLegs(-30) },
    ],
  },
  {
    id: "hf_39",
    slug: "inverted-row",
    title: "Inverted Row",
    // Short bar so it stays clear of the head as it passes beyond the bar.
    props: [{ kind: "bar", y: ROW_BAR, x1: ROW_HAND_X - 24, x2: ROW_HAND_X + 60, grips: [ROW_HAND_X - 1] }],
    transition: 0.5,
    frames: rep(invertedRow, ROW_HANG_Y, ROW_TOP_Y, 0.4, 0.4),
  },
  {
    id: "hf_107",
    slug: "manna",
    title: "Manna",
    transition: 1.4,
    frames: [
      { hold: 0.5, pose: mannaPose([20, -30], -115, -45) },
      { hold: 1.5, pose: mannaPose([30, -40], -150, -100) },
    ],
  },
];
