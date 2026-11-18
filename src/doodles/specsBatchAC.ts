import { dist, solvePose } from "./rig";
import type { DoodleSpec, Keyframe, Point, Pose, Prop } from "./rig";
import { LOCKED, lockedShoulderY, pushUp, rep, straightBody } from "./specsBatchC";
import { plank } from "./specsBatchI";

/**
 * Batch AC (#174): incline push-ups, dips on chairs and benches, the ab wheel
 * rollout and plank crawls. One view each (side). Floor at y = 0, up is
 * negative, the figure faces +x (a plank has the head at +x, lying face up has
 * the head at -x).
 *
 * The ab wheel has no prop: the hands roll forward along the floor where the
 * wheel would be.
 */

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}

const round = (value: number): number => Math.round(value * 10) / 10;
const angle = (from: Point, to: Point): number => (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;

type Side = "near" | "far";
const other = (side: Side): Side => (side === "near" ? "far" : "near");

const THIGH = 88;
const SHIN = 86;
/** Hip to ankle with the knee straight. */
const LEG = 173.98;

/** Where circles around `a` (radius ra) and `b` (radius rb) meet; `side` 1 or -1 picks the point left/right of a→b. */
function meet(a: Point, ra: number, b: Point, rb: number, side: 1 | -1): Point {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const x = (ra * ra - rb * rb + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, ra * ra - x * x));
  const ux = (b[0] - a[0]) / d;
  const uy = (b[1] - a[1]) / d;
  return [round(a[0] + ux * x - side * uy * h), round(a[1] + uy * x + side * ux * h)];
}

/** Knee between hip and ankle, folded towards +x (`forward`) or -x. */
function knee(hip: Point, ankle: Point, forward: boolean): Point {
  const a = meet(hip, THIGH, ankle, SHIN, 1);
  const b = meet(hip, THIGH, ankle, SHIN, -1);
  return forward === a[0] > b[0] ? a : b;
}

/**
 * Chest on a circle of radius `chord` round the pelvis, at the angle (between
 * `lo` and `hi` degrees) where the near arm reaches `hand` with a locked elbow.
 * A chord under 80 bows the spine (see `spine.bend`).
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

// ---------------------------------------------------------------- incline push-up (hands on a bench / ledge)

const INCLINE_BOX = { x: 36, y: -90, w: 110, h: 90 };
const INCLINE_PROP: Prop = { kind: "box", ...INCLINE_BOX };
const INCLINE_HAND: Point = [54, -92];
const INCLINE_FOOT: Point = [-206, -18];
const INCLINE_TOP = lockedShoulderY(INCLINE_FOOT, INCLINE_HAND);
/** Chest down to the edge: shoulders just above the hands. */
const INCLINE_BOTTOM = -140;

/** Straight body on the balls of the feet, hands on the box edge; `shoulderY` sets the depth. */
function incline(shoulderY: number): Pose {
  const { pelvis, chest } = straightBody(INCLINE_FOOT, shoulderY);
  return {
    pelvis,
    chest,
    hands: { near: INCLINE_HAND, far: [INCLINE_HAND[0] - 2, INCLINE_HAND[1]] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: INCLINE_FOOT, far: INCLINE_FOOT },
    toes: { near: 62, far: 62 },
  };
}

const inclineRep = (): Keyframe[] => rep(incline, INCLINE_TOP, INCLINE_BOTTOM, 0.4, 0.3);

/**
 * Incline scapular push-up: pelvis, feet and hands fixed, arms locked. Pushed
 * away (`spread`, shoulder blades apart) the body is one straight line; sinking
 * (blades together) the chest drops between the shoulders and the head follows.
 */
function inclineScap(spread: boolean): Pose {
  const { pelvis, chest: lineChest } = straightBody(INCLINE_FOOT, INCLINE_TOP);
  const line = angle(pelvis, lineChest);
  const base: Pose = {
    pelvis,
    spine: { bend: 1 },
    hands: { near: INCLINE_HAND, far: [INCLINE_HAND[0] - 2, INCLINE_HAND[1]] },
    feet: { near: INCLINE_FOOT, far: INCLINE_FOOT },
    toes: { near: 62, far: 62 },
  };
  const chest = lockChest(base, spread ? 80 : 77, INCLINE_HAND, line - 30, line + 30);
  return { ...base, chest, head: along(chest, line + (spread ? 0 : 16), 56) };
}

// ---------------------------------------------------------------- dips (hands on a chair / bench behind)

/** Seat of the chair or the first bench; the hands grip its front edge. */
const SEAT = { x: -150, y: -96, w: 104, h: 96 };
const DIP_HAND: Point = [-42, -97];
const CHAIR_BACK: Prop = { kind: "box", x: -150, y: -214, w: 8, h: 118 };

/** Chair dip: feet flat on the floor, knees bent; `lock` straightens the arms at the top. */
const CHAIR_ANKLE: Point = [78, 0];

function chairDip(pelvis: Point, lock: boolean): Pose {
  const k = knee(pelvis, CHAIR_ANKLE, true);
  const base: Pose = {
    pelvis,
    hands: { near: DIP_HAND, far: [DIP_HAND[0] - 2, DIP_HAND[1]] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { at: k }, far: { at: k } },
    feet: { near: CHAIR_ANKLE, far: [CHAIR_ANKLE[0] - 2, 0] },
    toes: { near: 0, far: 0 },
  };
  return { ...base, chest: lock ? lockChest(base, 80, DIP_HAND, -130, -80) : along(pelvis, -96, 80) };
}

/** Second bench, under the heels. */
const HEEL_BENCH = { x: 142, y: -96, w: 104, h: 96 };
const BENCH_HEEL: Point = [150, -105];

/** Dip between two benches: legs straight out to the heels on the far bench. */
function benchesDip(pelvisY: number, lock: boolean): Pose {
  const dy = pelvisY - BENCH_HEEL[1];
  const pelvis: Point = [round(BENCH_HEEL[0] - Math.sqrt(LEG ** 2 - dy * dy)), pelvisY];
  const base: Pose = {
    pelvis,
    hands: { near: DIP_HAND, far: [DIP_HAND[0] - 2, DIP_HAND[1]] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: BENCH_HEEL, far: BENCH_HEEL },
    toes: { near: -70, far: -70 },
  };
  return { ...base, chest: lock ? lockChest(base, 80, DIP_HAND, -130, -80) : along(pelvis, -96, 80) };
}

// ---------------------------------------------------------------- ab wheel rollout (kneeling)

const AB_KNEE: Point = [0, -6];
const AB_ANKLE: Point = [-86, -6];

/**
 * Kneeling rollout: thigh at `thighDeg` from the knee, torso at `torsoDeg` from
 * the hips, arms locked from the shoulders to the hands on the floor ahead.
 */
function rollout(thighDeg: number, torsoDeg: number): Pose {
  const pelvis = along(AB_KNEE, thighDeg, THIGH);
  const chest = along(pelvis, torsoDeg, 80);
  const shoulder = along(pelvis, torsoDeg, 98);
  const reach = LOCKED - 0.3;
  const hand: Point = [round(shoulder[0] + Math.sqrt(reach ** 2 - shoulder[1] ** 2)), 0];
  return {
    pelvis,
    chest,
    hands: { near: hand, far: [hand[0] - 2, 0] },
    knees: { near: { at: AB_KNEE }, far: { at: AB_KNEE } },
    feet: { near: AB_ANKLE, far: AB_ANKLE },
    toes: { near: 180, far: 180 },
  };
}

const ROLLOUT_FRAMES: Keyframe[] = [
  // Start: hips over the knees, hands under the shoulders.
  { hold: 0.5, pose: rollout(-92, -14) },
  { hold: 0, pose: rollout(-62, -20) },
  { hold: 0, pose: rollout(-38, -24) },
  // Long and low, body straight from knees to hands.
  { hold: 0.5, pose: rollout(-16, -16) },
  { hold: 0, pose: rollout(-38, -24) },
  { hold: 0, pose: rollout(-62, -20) },
];

// ---------------------------------------------------------------- leg wheel (lying, legs up, small circles)

const SUPINE_CHORD = 77;

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

/** Legs straight up and together, tilted `deg` from the hips (-90 is vertical). */
function legsUp(deg: number): Pose {
  const base = lyingFaceUp([-12, -20]);
  const pelvis = base.pelvis as Point;
  return {
    ...base,
    feet: { near: along(pelvis, deg, 173.98), far: along(pelvis, deg - 1, 173.98) },
    toes: { near: deg, far: deg },
  };
}

/**
 * One small circle seen from the side: the feet sweep towards the head and back.
 * The eased swing between the two ends is the side-on shadow of a steady circle.
 */
const LEG_WHEEL_FRAMES: Keyframe[] = [
  { hold: 0, pose: legsUp(-73) },
  { hold: 0, pose: legsUp(-95) },
];

// ---------------------------------------------------------------- climbers and crawls

/** Cross-body climber: a knee drives in low under the chest (across towards the other elbow). */
function crossClimber(side: Side): Pose {
  const base = plank();
  const pelvis = base.pelvis as Point;
  const k = along(pelvis, 40, THIGH);
  const ankle = along(k, 170, SHIN);
  return {
    ...base,
    knees: { [side]: { at: k } },
    feet: { [side]: ankle, [other(side)]: base.feet?.near as Point },
    toes: { [side]: 30, [other(side)]: 62 },
  };
}

/** Spider crawl: high plank, a knee travels out to the side towards the same elbow (as the Spiderman plank). */
const SP_HAND_X = 62;
const SP_FOOT: Point = [-170, -18];
const SP_TOP = lockedShoulderY(SP_FOOT, [SP_HAND_X, 0]);

function spider(knee: Side | null, thighDeg = 0, ankleY = -8): Pose {
  const base = pushUp(SP_TOP, SP_HAND_X, SP_FOOT);
  if (!knee) return base;
  const solved = solvePose(base);
  const hip = solved.legs[knee].root;
  const k = along(hip, thighDeg, THIGH);
  const shinDeg = 180 - (Math.asin(Math.max(-1, Math.min(1, (ankleY - k[1]) / SHIN))) * 180) / Math.PI;
  const ankle = along(k, shinDeg, SHIN);
  return {
    ...base,
    chest: solved.chest,
    knees: { [knee]: { at: k } },
    feet: { [knee]: ankle, [other(knee)]: SP_FOOT },
    toes: { [knee]: 185, [other(knee)]: 62 },
  };
}

/** Bear walk with the hips high: legs long, hips above the shoulders, opposite hand and foot step. */
const HIGH_BEAR_PELVIS: Point = [-50, -158];
const HIGH_BEAR_SHOULDER_Y = -112;
const HIGH_BEAR_DEG = (Math.asin((HIGH_BEAR_SHOULDER_Y - HIGH_BEAR_PELVIS[1]) / 98) * 180) / Math.PI;
const HIGH_BEAR_CHEST = along(HIGH_BEAR_PELVIS, HIGH_BEAR_DEG, 80);
const HIGH_BEAR_SHOULDER = along(HIGH_BEAR_PELVIS, HIGH_BEAR_DEG, 98);
const HIGH_BEAR_HAND_X = HIGH_BEAR_SHOULDER[0] + 14;
const HIGH_BEAR_ANKLE: Point = [-128, -14];
const HIGH_BEAR_STEP = 20;
const HIGH_BEAR_LIFT = 18;

/** `phase` 0: near hand + far foot forward; 2: far hand + near foot forward; 1 and 3 swing a pair through. */
function highBear(phase: 0 | 1 | 2 | 3): Pose {
  const pairA = [1, 0, -1, 0][phase];
  const pairB = -pairA;
  const liftA = phase === 3;
  const liftB = phase === 1;
  const hand = (offset: number, lifted: boolean, dx: number): Point => [
    round(HIGH_BEAR_HAND_X + dx + offset * HIGH_BEAR_STEP),
    lifted ? -HIGH_BEAR_LIFT : 0,
  ];
  const foot = (offset: number, lifted: boolean, dx: number): Point => [
    HIGH_BEAR_ANKLE[0] + dx + offset * HIGH_BEAR_STEP,
    HIGH_BEAR_ANKLE[1] - (lifted ? HIGH_BEAR_LIFT : 0),
  ];
  const nearFoot = foot(pairB, liftB, 0);
  const farFoot = foot(pairA, liftA, 3);
  return {
    pelvis: HIGH_BEAR_PELVIS,
    chest: HIGH_BEAR_CHEST,
    // Head in line with the back, eyes a little ahead of the hands.
    head: along(HIGH_BEAR_CHEST, HIGH_BEAR_DEG - 26, 56),
    hands: { near: hand(pairA, liftA, 0), far: hand(pairB, liftB, -4) },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { at: knee(HIGH_BEAR_PELVIS, nearFoot, true) }, far: { at: knee(HIGH_BEAR_PELVIS, farFoot, true) } },
    feet: { near: nearFoot, far: farFoot },
    toes: { near: 52, far: 52 },
  };
}

/** Groiner: hands planted; the feet jump in beside the hands to a deep squat, head up. */
const GROIN_HAND: Point = [62, 0];
const GROIN_HANDS = { near: GROIN_HAND, far: [GROIN_HAND[0] - 2, 0] as Point };

function groinSquat(): Pose {
  const pelvis: Point = [-40, -50];
  const ankle: Point = [32, 0];
  const k = knee(pelvis, ankle, true);
  const base: Pose = {
    pelvis,
    hands: GROIN_HANDS,
    knees: { near: { at: k }, far: { at: knee(pelvis, [ankle[0] - 3, 0], true) } },
    feet: { near: ankle, far: [ankle[0] - 3, 0] },
    toes: { near: 0, far: 0 },
  };
  const { chest } = solvePose(base);
  // Head up: the neck tips back from the line of the spine to look ahead.
  return { ...base, chest, head: along(chest, angle(pelvis, chest) + 14, 56) };
}

/** Feet in the air halfway between plank and squat, knees tucked. */
function groinAir(): Pose {
  const pelvis: Point = [-58, -104];
  const ankle: Point = [-70, -30];
  const k = knee(pelvis, ankle, true);
  return {
    pelvis,
    hands: GROIN_HANDS,
    knees: { near: { at: k }, far: { at: k } },
    feet: { near: ankle, far: ankle },
    toes: { near: 40, far: 40 },
  };
}

// ---------------------------------------------------------------- specs

export const BATCH_AC_SPECS: DoodleSpec[] = [
  {
    id: "fedb_incline_push_up_medium",
    slug: "incline-push-up-medium",
    title: "Incline Push-Up Medium",
    props: [INCLINE_PROP],
    transition: 0.5,
    frames: inclineRep(),
  },
  {
    id: "fedb_incline_push_up_wide",
    slug: "incline-push-up-wide",
    title: "Incline Push-Up Wide",
    props: [INCLINE_PROP],
    transition: 0.5,
    frames: inclineRep(),
  },
  {
    id: "wger_1716",
    slug: "incline-shoulder-press-up",
    title: "Incline Shoulder Press Up",
    props: [INCLINE_PROP],
    transition: 0.8,
    frames: [
      { hold: 0.4, pose: inclineScap(true) },
      { hold: 0.4, pose: inclineScap(false) },
    ],
  },
  {
    id: "wger_1774",
    slug: "chair-dips",
    title: "Chair dips",
    props: [{ kind: "box", ...SEAT }, CHAIR_BACK],
    transition: 0.7,
    frames: [
      { hold: 0.4, pose: chairDip([-22, -112], true) },
      { hold: 0.3, pose: chairDip([-14, -52], false) },
    ],
  },
  {
    id: "wger_197",
    slug: "dips-between-two-benches",
    title: "Dips Between Two Benches",
    props: [{ kind: "box", ...SEAT }, { kind: "box", ...HEEL_BENCH }],
    transition: 0.4,
    frames: [
      { hold: 0.4, pose: benchesDip(-124, true) },
      { hold: 0, pose: benchesDip(-86, false) },
      { hold: 0.3, pose: benchesDip(-48, false) },
      { hold: 0, pose: benchesDip(-86, false) },
    ],
  },
  {
    id: "hf_113",
    slug: "ab-wheel-rollout",
    title: "Ab Wheel Rollout",
    transition: 0.4,
    frames: ROLLOUT_FRAMES,
  },
  {
    id: "wger_1573",
    slug: "ab-wheel",
    title: "Ab wheel",
    transition: 0.4,
    frames: ROLLOUT_FRAMES,
  },
  {
    id: "wger_1909",
    slug: "leg-wheel",
    title: "Leg Wheel",
    transition: 0.9,
    frames: LEG_WHEEL_FRAMES,
  },
  {
    id: "ntc_cross_body_climber",
    slug: "cross-body-mountain-climber",
    title: "Cross-body mountain climber",
    transition: 0.26,
    frames: [
      { hold: 0.12, pose: crossClimber("near") },
      { hold: 0.12, pose: crossClimber("far") },
    ],
  },
  {
    id: "fedb_spider_crawl",
    slug: "spider-crawl",
    title: "Spider Crawl",
    transition: 0.45,
    frames: [
      { hold: 0.25, pose: spider(null) },
      { hold: 0, pose: spider("near", 30, -36) },
      { hold: 0.5, pose: spider("near", 14, -30) },
      { hold: 0, pose: spider("near", 30, -36) },
      { hold: 0.25, pose: spider(null) },
      { hold: 0, pose: spider("far", 30, -36) },
      { hold: 0.5, pose: spider("far", 14, -30) },
      { hold: 0, pose: spider("far", 30, -36) },
    ],
  },
  {
    id: "wger_57",
    slug: "bear-walk-2",
    title: "Bear Walk 2",
    transition: 0.3,
    frames: [
      { hold: 0.05, pose: highBear(0) },
      { hold: 0, pose: highBear(1) },
      { hold: 0.05, pose: highBear(2) },
      { hold: 0, pose: highBear(3) },
    ],
  },
  {
    id: "fedb_groiners",
    slug: "groiners",
    title: "Groiners",
    transition: 0.24,
    frames: [
      { hold: 0.3, pose: { ...plank(), chest: undefined } },
      { hold: 0, pose: groinAir() },
      { hold: 0.5, pose: groinSquat() },
      { hold: 0, pose: groinAir() },
    ],
  },
];
