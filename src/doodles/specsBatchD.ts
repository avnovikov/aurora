import { solvePose } from "./rig";
import type { DoodleSpec, Point, Pose } from "./rig";

/**
 * Batch D: rarely planned bar-and-bodyweight moves (docs/doodles-to-prepare.md §3).
 * Floor at y = 0, up is negative, facing +x. Side-lying moves use the front view
 * so the hips stack (near = bottom side, far = top side).
 */

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}

const round = (value: number): number => Math.round(value * 10) / 10;

// ---------------------------------------------------------------- lying face up (head left)

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

/** Single-leg bridge: near heel on the floor at `heelX`, far leg held straight up and forward. */
function singleLegBridge(pelvisY: number, heelX: number): Pose {
  const pelvis: Point = [-12, pelvisY];
  return {
    ...lyingFaceUp(pelvis),
    feet: { near: [heelX, -4], far: along(pelvis, -62, 173.6) },
    toes: { near: -60, far: -40 },
  };
}

/** Lying on the back, straight legs raised at `deg` (-90 vertical) with the knees together. */
function legsUp(deg: number): Pose {
  const base = lyingFaceUp([-12, -20]);
  const pelvis = base.pelvis as Point;
  return {
    ...base,
    feet: { near: along(pelvis, deg, 173.9), far: along(pelvis, deg - 1, 173.4) },
    toes: { near: deg, far: deg },
  };
}

// ---------------------------------------------------------------- spiderman push-up

const PUSH_FOOT: Point = [-189, -22];
const PUSH_REACH = 271.5;

/** Straight body from the feet to the shoulders at `shoulderY`; hands under the chest. */
function pushUp(shoulderY: number): Pose {
  const dx = Math.sqrt(PUSH_REACH ** 2 - (shoulderY - PUSH_FOOT[1]) ** 2);
  const u: Point = [dx / PUSH_REACH, (shoulderY - PUSH_FOOT[1]) / PUSH_REACH];
  const pelvis: Point = [round(PUSH_FOOT[0] + u[0] * 173.9), round(PUSH_FOOT[1] + u[1] * 173.9)];
  return {
    pelvis,
    chest: [round(pelvis[0] + u[0] * 80), round(pelvis[1] + u[1] * 80)],
    hands: { near: [60, 0], far: [58, 0] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: PUSH_FOOT, far: PUSH_FOOT },
    toes: { near: 62, far: 62 },
  };
}

/** Thigh angle and ankle height of the stepping leg; the knee bends and the shin trails back. */
function steppingLeg(base: Pose, side: "near" | "far", thighDeg: number, ankleY: number, toe: number): Pose {
  const pelvis = base.pelvis as Point;
  const knee = along(pelvis, thighDeg, 88);
  const ankle: Point = [round(knee[0] - Math.sqrt(86 ** 2 - (ankleY - knee[1]) ** 2)), ankleY];
  return {
    ...base,
    knees: { [side]: { at: knee } },
    feet: { ...base.feet, [side]: ankle },
    toes: { ...base.toes, [side]: toe },
  };
}

/**
 * One knee drawn forward under the body while the arms bend. A side view can't show the knee
 * travelling out to the side, so it comes in low, under the elbow, without crossing the arm.
 * `stage` 1 drags the foot along the floor under the hips, 2 brings the knee forward at the top,
 * 3 is the bottom (the knee under the elbow).
 */
function spiderman(side: "near" | "far", stage: 1 | 2 | 3): Pose {
  // The foot turns over through toes-up (never toes-down through the floor), then trails back.
  if (stage === 1) return steppingLeg(pushUp(-126), side, 94, -16, -80);
  if (stage === 2) return steppingLeg(pushUp(-126), side, 42, -10, 186);
  return steppingLeg(pushUp(-100), side, 46, -8, 186);
}

// ---------------------------------------------------------------- L-sit and pike compression

const LSIT_HANDS = { near: [-20, 0] as Point, far: [-24, 0] as Point };

/** Sitting with straight legs, hands beside the hips, elbows soft. */
function lSitSeated(): Pose {
  const pelvis: Point = [-38, -16];
  return {
    pelvis,
    chest: along(pelvis, -84, 80),
    hands: LSIT_HANDS,
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: along(pelvis, 3, 173.6), far: along(pelvis, 3, 173.2) },
    toes: { near: 10, far: 10 },
  };
}

/** Arms locked, hips off the floor, straight legs held level; `lift` raises the legs a touch. */
function lSitHold(lift: number): Pose {
  const pelvis: Point = [-36, -32];
  return {
    pelvis,
    hands: LSIT_HANDS,
    feet: { near: along(pelvis, -lift, 173.6), far: along(pelvis, -lift - 1, 173.2) },
    toes: { near: -lift + 5, far: -lift + 5 },
  };
}

/** Shoulder a locked arm (shoulder to fingertip) from `hand` and a torso length from `pelvis`, the upper option. */
function lockedShoulder(pelvis: Point, hand: Point): Point {
  const torso = 98;
  const arm = 125.97;
  const d = Math.hypot(hand[0] - pelvis[0], hand[1] - pelvis[1]);
  const a = (torso ** 2 - arm ** 2 + d ** 2) / (2 * d);
  const h = Math.sqrt(torso ** 2 - a ** 2);
  const u: Point = [(hand[0] - pelvis[0]) / d, (hand[1] - pelvis[1]) / d];
  const base: Point = [pelvis[0] + u[0] * a, pelvis[1] + u[1] * a];
  const options: Point[] = [
    [base[0] - u[1] * h, base[1] + u[0] * h],
    [base[0] + u[1] * h, base[1] - u[0] * h],
  ];
  return options[0][1] < options[1][1] ? options[0] : options[1];
}

const PIKE_PELVIS: Point = [-40, -16];
/** Hands flat beside the knees. */
const PIKE_HAND: Point = [64, -2];

/** Seated pike, leaning forward over locked arms with the hands by the knees; `lift` raises the straight legs. */
function pikeCompression(lift: number): Pose {
  const pelvis = PIKE_PELVIS;
  const shoulder = lockedShoulder(pelvis, PIKE_HAND);
  const torso = (Math.atan2(shoulder[1] - pelvis[1], shoulder[0] - pelvis[0]) * 180) / Math.PI;
  return {
    pelvis,
    chest: along(pelvis, torso, 80),
    // Eyes down towards the knees.
    head: along(along(pelvis, torso, 100), torso + 40, 36),
    hands: { near: PIKE_HAND, far: [PIKE_HAND[0] - 3, PIKE_HAND[1]] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: along(pelvis, 3 - lift, 173.6), far: along(pelvis, 3 - lift, 173.2) },
    toes: { near: 12 - lift, far: 12 - lift },
  };
}

// ---------------------------------------------------------------- single-leg soft landing

const STEP_BOX = { kind: "box" as const, x: -120, y: -40, w: 110, h: 40 };

function onStep(): Pose {
  return {
    pelvis: [-46, -212],
    chest: [-46, -292],
    hands: { near: [-38, -186], far: [-42, -186] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: [-40, -42], far: [-46, -42] },
    toes: { near: 0, far: 0 },
  };
}

/** Near foot stepping off the front of the step, the far leg still on it. */
function stepOff(): Pose {
  const pelvis: Point = [-30, -200];
  return {
    pelvis,
    chest: along(pelvis, -84, 80),
    hands: { near: [-10, -180], far: [-14, -180] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: [36, -70], far: [-46, -42] },
    toes: { near: 10, far: 0 },
  };
}

/** Landed on the near foot: hips back, knee over the toes, the far foot held off the floor behind. */
function softLanding(depth: number): Pose {
  const pelvis: Point = [30, -140 + depth];
  return {
    pelvis,
    chest: along(pelvis, -66, 80),
    hands: { near: [126, -190 + depth], far: [122, -190 + depth] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: [96, 0], far: [4, -62] },
    toes: { near: 0, far: 20 },
  };
}

// ---------------------------------------------------------------- copenhagen (front view, head left)

/**
 * Bench drawn with the parallel-bar shape (top rail and two legs) so the bottom leg can sit
 * in front of the near bench leg; the rail is not an obstacle for the validator.
 */
const BENCH = { kind: "parallelBars" as const, y: -84, x1: 232, x2: 360 };
/** Top ankle on the end of the bench. */
const COPEN_ANKLE: Point = [244, -92];
/** Bottom elbow on the floor, straight under the bottom shoulder. */
const COPEN_ELBOW: Point = [-27.8, -4];

/**
 * Side plank on the bottom forearm, top ankle on the bench. Pelvis and spine angle were solved
 * so the bottom shoulder sits on the vertical upper arm and the top leg stays straight: hips
 * dropped, or lifted into one straight line.
 */
function copenhagen(lifted: boolean): Pose {
  const pelvis: Point = lifted ? [70.3, -85.3] : [71.2, -47.3];
  const chest = along(pelvis, lifted ? 180.4 : 202.2, 80);
  return {
    pelvis,
    chest,
    elbows: { near: { at: COPEN_ELBOW }, far: { bend: 1 } },
    // Top arm reaches straight up to the ceiling.
    hands: { near: [COPEN_ELBOW[0] + 66, -4], far: [round(chest[0] - 18), round(chest[1] - 144)] },
    // Bottom leg rests on the floor in front of the bench.
    feet: { near: [212, -4], far: COPEN_ANKLE },
    knees: { near: { bend: -1 } },
    toes: { near: 0, far: 0 },
  };
}

// ---------------------------------------------------------------- clamshell (front view, head left)

const CLAM_PELVIS: Point = [0, -24];

/** Bottom (near) leg: hip 8 below the pelvis in the front view, knee forward and up, foot on the floor. */
const CLAM_BOTTOM_KNEE = along([CLAM_PELVIS[0], CLAM_PELVIS[1] + 8], -24, 88);
const CLAM_BOTTOM_FOOT = along(CLAM_BOTTOM_KNEE, 30, 86);

/**
 * Side-lying, head resting on the straight lower arm, knees bent, feet together. With fixed bone
 * lengths the top knee can only rise if the hip-to-ankle distance shrinks, so `open` (0..1) slides
 * the top ankle a little along the bottom foot (it stays resting on it, never lifting).
 */
function clamshell(open: number): Pose {
  const topAnkle: Point = [round(CLAM_BOTTOM_FOOT[0] - 22 * open), round(CLAM_BOTTOM_FOOT[1] - 12 - 4 * open)];
  return {
    pelvis: CLAM_PELVIS,
    chest: [-80, CLAM_PELVIS[1]],
    // Head rests on the lower arm.
    head: [-134, -30],
    spine: { bend: -1 },
    // Lower arm straight overhead along the floor as the pillow; top arm straight along the top side.
    hands: { near: [-223.5, -3], far: [26, -44] },
    elbows: { near: { bend: 1 }, far: { bend: -1 } },
    knees: { near: { at: CLAM_BOTTOM_KNEE }, far: { bend: -1 } },
    feet: { near: CLAM_BOTTOM_FOOT, far: topAnkle },
    toes: { near: 0, far: 0 },
  };
}

// ---------------------------------------------------------------- specs

export const BATCH_D_SPECS: DoodleSpec[] = [
  {
    id: "hf_13",
    slug: "spiderman-push-up",
    title: "Spiderman Push-Up",
    transition: 0.5,
    frames: [
      { hold: 0.3, pose: pushUp(-126) },
      { hold: 0, pose: spiderman("near", 1) },
      { hold: 0, pose: spiderman("near", 2) },
      { hold: 0.5, pose: spiderman("near", 3) },
      { hold: 0, pose: spiderman("near", 2) },
      { hold: 0, pose: spiderman("near", 1) },
      { hold: 0.3, pose: pushUp(-126) },
      { hold: 0, pose: spiderman("far", 1) },
      { hold: 0, pose: spiderman("far", 2) },
      { hold: 0.5, pose: spiderman("far", 3) },
      { hold: 0, pose: spiderman("far", 2) },
      { hold: 0, pose: spiderman("far", 1) },
    ],
  },
  {
    id: "wger_1294",
    slug: "single-leg-hamstring-curl",
    title: "Single-leg hamstring curl",
    transition: 1.2,
    frames: [
      { hold: 0.5, pose: singleLegBridge(-80, 62) },
      { hold: 0.5, pose: singleLegBridge(-76, 142) },
    ],
  },
  {
    id: "hf_105",
    slug: "l-sit",
    title: "L-Sit",
    transition: 1,
    frames: [
      { hold: 0.5, pose: lSitSeated() },
      { hold: 1.2, pose: lSitHold(0) },
      { hold: 1.2, pose: lSitHold(2) },
    ],
  },
  {
    id: "hf_123",
    slug: "pike-compression",
    title: "Pike Compression",
    transition: 1,
    frames: [
      { hold: 0.4, pose: pikeCompression(0) },
      { hold: 0.6, pose: pikeCompression(14) },
    ],
  },
  {
    id: "wger_1909",
    slug: "leg-wheel",
    title: "Leg Wheel",
    transition: 0.35,
    frames: [
      { hold: 0.05, pose: legsUp(-80) },
      { hold: 0.05, pose: legsUp(-88) },
      { hold: 0.05, pose: legsUp(-96) },
      { hold: 0.05, pose: legsUp(-88) },
    ],
  },
  {
    id: "wger_2619",
    slug: "single-leg-soft-landing-hold",
    title: "Single-Leg Soft-Landing Hold",
    props: [STEP_BOX],
    transition: 0.8,
    frames: [
      { hold: 0.5, pose: onStep() },
      { hold: 0.2, pose: stepOff() },
      { hold: 1.2, pose: softLanding(0) },
      { hold: 0.2, pose: stepOff() },
    ],
  },
  {
    id: "wger_1605",
    slug: "copenhagen-adduction",
    title: "Copenhagen Adduction",
    view: "front",
    props: [BENCH],
    transition: 1.2,
    frames: [
      { hold: 0.5, pose: copenhagen(false) },
      { hold: 1, pose: copenhagen(true) },
    ],
  },
  {
    id: "ntc_clamshell",
    slug: "clamshell",
    title: "Clamshell",
    view: "front",
    transition: 1,
    frames: [
      { hold: 0.4, pose: clamshell(0) },
      { hold: 0.5, pose: clamshell(1) },
    ],
  },
];
