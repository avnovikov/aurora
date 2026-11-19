import type { DoodleSpec, Point, Pose } from "./rig";

/**
 * Batch I: conditioning moves (burpee family, climbers, crawls, run-in-place,
 * hops and shuffles) plus the prone superman and swimmers, drawn from their
 * curated steps. Floor at y = 0, up is negative, facing +x: a plank has the
 * head at +x, lying face down has the head at +x.
 *
 * The cross-body mountain climber (ntc_cross_body_climber) is drawn in batch
 * AC, side view only: its knee crossing under the body is not visible there.
 */

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}

const round = (value: number): number => Math.round(value * 10) / 10;
const angle = (from: Point, to: Point): number => (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;

const sub = (a: Point, b: Point): [number, number] => [a[0] - b[0], a[1] - b[1]];

const THIGH = 88;
const SHIN = 86;

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

// ---------------------------------------------------------------- plank (same geometry as the floor push-up)

/** Ankle to shoulder of a straight body (leg 173.9 + pelvis-to-shoulder 98). */
const BODY = 271.9;
/** Shoulder to fingertip with the elbow locked. */
const LOCKED = 125.97;
const PLANK_FOOT: Point = [-190, -18];
const PLANK_HAND: Point = [62, 0];

function straightBody(foot: Point, shoulderY: number): { pelvis: Point; chest: Point; shoulder: Point } {
  const dx = Math.sqrt(BODY ** 2 - (shoulderY - foot[1]) ** 2);
  const shoulder: Point = [foot[0] + dx, shoulderY];
  const deg = angle(foot, shoulder);
  return { pelvis: along(foot, deg, 173.9), chest: along(foot, deg, 253.9), shoulder };
}

/** Shoulder height at which a straight body on `foot` reaches `hand` with a locked arm. */
function lockedShoulderY(foot: Point, hand: Point): number {
  let lo = hand[1] - LOCKED;
  let hi = hand[1] - 1;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    const { shoulder } = straightBody(foot, mid);
    if (Math.hypot(shoulder[0] - hand[0], shoulder[1] - hand[1]) > LOCKED) lo = mid;
    else hi = mid;
  }
  return round((lo + hi) / 2);
}

const PLANK_TOP = lockedShoulderY(PLANK_FOOT, PLANK_HAND);

/** High plank (`shoulderY` = PLANK_TOP) or a push-up lowered to `shoulderY`. */
export function plank(shoulderY: number = PLANK_TOP): Pose {
  const { pelvis, chest } = straightBody(PLANK_FOOT, shoulderY);
  return {
    pelvis,
    chest,
    hands: { near: PLANK_HAND, far: [PLANK_HAND[0] - 2, 0] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: PLANK_FOOT, far: PLANK_FOOT },
    toes: { near: 62, far: 62 },
  };
}

// ---------------------------------------------------------------- burpee / squat thrust

export function stand(): Pose {
  return {
    pelvis: [0, -172],
    chest: [0, -252],
    hands: { near: [6, -146], far: [2, -146] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: [6, 0], far: [0, 0] },
    toes: { near: 0, far: 0 },
  };
}

/** Deep squat with the hands flat on the floor in front of the feet (spine solved from the hands). */
export function squatHandsDown(): Pose {
  const pelvis: Point = [-52, -86];
  const ankle: Point = [-8, 0];
  return {
    pelvis,
    hands: { near: PLANK_HAND, far: [PLANK_HAND[0] - 2, 0] },
    knees: { near: { at: knee(pelvis, ankle, true) }, far: { at: knee(pelvis, [ankle[0] - 4, 0], true) } },
    feet: { near: ankle, far: [ankle[0] - 4, 0] },
    toes: { near: 0, far: 0 },
  };
}

/** In the air, arms overhead, toes pointed. */
function jump(): Pose {
  const pelvis: Point = [0, -206];
  return {
    pelvis,
    chest: [2, -286],
    // Arms up and a little forward, so they read clear of the head.
    hands: { near: along([2.4, -304], -56, 124), far: along([2.4, -304], -58, 124) },
    feet: { near: [4, -36], far: [-2, -36] },
    toes: { near: 70, far: 70 },
  };
}

/** Soft landing: knees bend, arms come down in front. */
function land(): Pose {
  const pelvis: Point = [-14, -150];
  const chest = along(pelvis, -78, 80);
  const shoulder = along(pelvis, -78, 98);
  return {
    pelvis,
    chest,
    hands: { near: along(shoulder, 30, 124), far: along(shoulder, 32, 124) },
    feet: { near: [6, 0], far: [0, 0] },
    toes: { near: 0, far: 0 },
  };
}

// ---------------------------------------------------------------- mountain climbers

/** High plank with the `side` knee driven in under the chest. */
function climber(side: "near" | "far"): Pose {
  const base = plank();
  const pelvis = base.pelvis as Point;
  const k = along(pelvis, 32, THIGH);
  const ankle = along(k, 164, SHIN);
  const other = side === "near" ? "far" : "near";
  return {
    ...base,
    knees: { [side]: { at: k } },
    feet: { [side]: ankle, [other]: PLANK_FOOT },
    toes: { [side]: 40, [other]: 62 },
  };
}

// ---------------------------------------------------------------- bear crawl (knees hover)

const BEAR_PELVIS: Point = [-44, -122];
/** Shoulders over the hands, back flat: the chest is pinned so each arm reaches on its own. */
const BEAR_CHEST: Point = along(BEAR_PELVIS, angle(BEAR_PELVIS, [50, -119]), 80);
const BEAR_HAND_X = 46;
/** Ball of the foot behind the knee; the knee hovers well clear of the floor. */
const BEAR_ANKLE: Point = [-126, -14];
/** Half a step: each hand and foot travels twice this. */
const BEAR_STEP = 20;
const BEAR_LIFT = 16;

/** Ankle on the ball of the foot, toes tucked under. */
function bearToe(ankleY: number): number {
  return round((Math.asin(Math.min(1, (-2 - ankleY) / 20)) * 180) / Math.PI);
}

/**
 * Treadmill-style crawl in place: `phase` 0 has the near hand and far foot
 * forward, 2 the far hand and near foot; 1 and 3 swing the other pair through.
 */
function bear(phase: 0 | 1 | 2 | 3): Pose {
  // Offset of each limb along the step: +1 forward, -1 back, 0 passing (lifted when swinging).
  const pairA = [1, 0, -1, 0][phase]; // near hand + far foot
  const pairB = -[1, 0, -1, 0][phase]; // far hand + near foot
  const liftA = phase === 3;
  const liftB = phase === 1;
  const hand = (offset: number, lifted: boolean, dx: number): Point => [BEAR_HAND_X + dx + offset * BEAR_STEP, lifted ? -BEAR_LIFT : 0];
  const foot = (offset: number, lifted: boolean, dx: number): Point => [
    BEAR_ANKLE[0] + dx + offset * BEAR_STEP,
    BEAR_ANKLE[1] - (lifted ? BEAR_LIFT : 0),
  ];
  const nearFoot = foot(pairB, liftB, 0);
  const farFoot = foot(pairA, liftA, 3);
  return {
    pelvis: BEAR_PELVIS,
    chest: BEAR_CHEST,
    hands: { near: hand(pairA, liftA, 0), far: hand(pairB, liftB, -4) },
    knees: { near: { at: knee(BEAR_PELVIS, nearFoot, true) }, far: { at: knee(BEAR_PELVIS, farFoot, true) } },
    feet: { near: nearFoot, far: farFoot },
    // A lifted foot keeps the tucked angle it had on the floor.
    toes: { near: bearToe(BEAR_ANKLE[1]), far: bearToe(BEAR_ANKLE[1]) },
  };
}

// ---------------------------------------------------------------- high knees / fast feet

/** Running in place: the `side` knee at hip height, on the ball of the other foot, arms pumping. */
function highKnee(side: "near" | "far"): Pose {
  const pelvis: Point = [0, -179];
  const other = side === "near" ? "far" : "near";
  const k = along(pelvis, -6, THIGH);
  const chest = along(pelvis, -88, 80);
  const shoulder = along(pelvis, -88, 98);
  // The arm opposite the raised knee drives forward, elbow bent at 90°.
  const fwdElbow = along(shoulder, 70, 60);
  const backElbow = along(shoulder, 125, 60);
  return {
    pelvis,
    chest,
    knees: { [side]: { at: k } },
    feet: { [side]: along(k, 96, SHIN), [other]: [2, -6] },
    toes: { [side]: 30, [other]: 24 },
    hands: { [other]: along(fwdElbow, -30, 66), [side]: along(backElbow, 60, 66) },
    elbows: { [other]: { at: fwdElbow }, [side]: { at: backElbow } },
  };
}

/** Legs passing: the `rising` knee comes up with the heel tucked, the other leg reaches down to land. */
function kneesPassing(rising: "near" | "far"): Pose {
  const pelvis: Point = [0, -182];
  const other = rising === "near" ? "far" : "near";
  const k = along(pelvis, 52, THIGH);
  const shoulder = along(pelvis, -88, 98);
  const elbow = along(shoulder, 96, 60);
  return {
    pelvis,
    chest: along(pelvis, -88, 80),
    knees: { [rising]: { at: k } },
    feet: { [rising]: along(k, 140, SHIN), [other]: [8, -14] },
    toes: { [rising]: 70, [other]: 40 },
    hands: { near: along(elbow, 20, 66), far: along(elbow, 24, 66) },
    elbows: { near: { at: elbow }, far: { at: elbow } },
  };
}

/** Quarter squat on the balls of the feet; `lift` raises that foot a few inches. */
function fastFeet(lift: "near" | "far"): Pose {
  const pelvis: Point = [-22, -156];
  const chest = along(pelvis, -74, 80);
  const down = lift === "near" ? "far" : "near";
  return {
    pelvis,
    chest,
    // Hands up in front, elbows bent: ready position.
    hands: { near: [60, -196], far: [56, -196] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { bend: -1 }, far: { bend: -1 } },
    feet: { [lift]: [10, -40], [down]: [4, -8] },
    toes: { [lift]: 30, [down]: 24 },
  };
}

// ---------------------------------------------------------------- front-view jumps and shuffles

/**
 * Front view, upright spine over `pelvis`: mirror-image arms with the upper arm
 * `elbowOut`° out from straight down and the forearm `handIn`° back in from it.
 */
function frontArms(pelvis: Point, elbowOut: number, handIn: number): Pick<Pose, "hands" | "elbows"> {
  const shoulderY = pelvis[1] - 98;
  const elbowNear = along([pelvis[0] - 22, shoulderY], 90 + elbowOut, 60);
  const elbowFar = along([pelvis[0] + 22, shoulderY], 90 - elbowOut, 60);
  return {
    hands: { near: along(elbowNear, 90 + elbowOut - handIn, 66), far: along(elbowFar, 90 - elbowOut + handIn, 66) },
    elbows: { near: { at: elbowNear }, far: { at: elbowFar } },
  };
}

/** Front view: elbows down and out, hands meeting in front of the chest. */
function chestHands(pelvis: Point): Pick<Pose, "hands" | "elbows"> {
  const shoulderY = pelvis[1] - 98;
  const elbowNear = along([pelvis[0] - 22, shoulderY], 118, 60);
  const elbowFar = along([pelvis[0] + 22, shoulderY], 62, 60);
  const meetY = shoulderY + 22;
  return {
    hands: {
      near: along(elbowNear, angle(elbowNear, [pelvis[0] - 6, meetY]), 66),
      far: along(elbowFar, angle(elbowFar, [pelvis[0] + 6, meetY]), 66),
    },
    elbows: { near: { at: elbowNear }, far: { at: elbowFar } },
  };
}

/** Squat jack: half squat with feet together or out wide, hands at the chest. */
function squatJack(wide: boolean): Pose {
  const pelvis: Point = wide ? [0, -116] : [0, -142];
  const feet = wide ? 92 : 16;
  return {
    pelvis,
    chest: [0, pelvis[1] - 80],
    ...chestHands(pelvis),
    knees: { near: { bend: 1 }, far: { bend: -1 } },
    feet: { near: [-feet, 0], far: [feet, 0] },
    toes: { near: 180, far: 0 },
  };
}

/** Ski hop: feet together, landing at `x` with soft knees, or airborne between. */
function skiHop(x: number, air: boolean): Pose {
  const pelvis: Point = [x, air ? -212 : -168];
  const footY = air ? -44 : 0;
  return {
    pelvis,
    chest: [x, pelvis[1] - 80],
    // Arms a little out from the sides for balance.
    ...frontArms(pelvis, air ? 34 : 24, 20),
    knees: { near: { bend: 1 }, far: { bend: -1 } },
    feet: { near: [x - 10, footY], far: [x + 10, footY] },
    toes: { near: air ? 120 : 180, far: air ? 60 : 0 },
  };
}

/** Athletic stance (knees bent, low) with the feet at `nearX` and `farX`. */
function shuffle(nearX: number, farX: number): Pose {
  const x = (nearX + farX) / 2;
  const pelvis: Point = [x, -136];
  return {
    pelvis,
    chest: [x, -216],
    // Elbows bent, hands up in front: ready position.
    ...frontArms(pelvis, 24, -36),
    knees: { near: { bend: 1 }, far: { bend: -1 } },
    feet: { near: [nearX, 0], far: [farX, 0] },
    toes: { near: 180, far: 0 },
  };
}

// ---------------------------------------------------------------- crab toe touch

const CRAB_HAND: Point = [-82, 0];
const CRAB_FOOT: Point = [84, 0];

/** Reverse tabletop: hands behind, fingers forward, hips up level with the knees. */
function crabTable(): Pose {
  const pelvis: Point = [0, -90];
  return {
    pelvis,
    chest: along(pelvis, -162, 80),
    hands: { near: CRAB_HAND, far: [CRAB_HAND[0] - 4, 0] },
    knees: { near: { at: knee(pelvis, CRAB_FOOT, true) }, far: { at: knee(pelvis, [CRAB_FOOT[0] - 4, 0], true) } },
    feet: { near: CRAB_FOOT, far: [CRAB_FOOT[0] - 4, 0] },
    toes: { near: 0, far: 0 },
  };
}

/** One straight leg kicks up and the opposite hand reaches to its toes; the other hand and foot stay down. */
function crabReach(kick: "near" | "far"): Pose {
  const pelvis: Point = [-2, -60];
  const spine = -140;
  /** Leg a touch forward of vertical, so it swings up through the front. */
  const leg = -82;
  const other = kick === "near" ? "far" : "near";
  const ankle = along(pelvis, leg, 171);
  const plantedFoot: Point = kick === "near" ? [CRAB_FOOT[0] - 4, 0] : CRAB_FOOT;
  const plantedHand: Point = kick === "near" ? CRAB_HAND : [CRAB_HAND[0] - 4, 0];
  // The reaching hand meets the leg as high up as a straight arm allows (at the toes when it can).
  const shoulder = along(pelvis, spine, 98);
  let reach = 191;
  while (reach > 100 && Math.hypot(...sub(along(pelvis, leg, reach), shoulder)) > 124) reach -= 1;
  return {
    pelvis,
    chest: along(pelvis, spine, 80),
    hands: { [kick]: plantedHand, [other]: along(pelvis, leg, reach) },
    knees: { [kick]: { at: knee(pelvis, ankle, false) }, [other]: { at: knee(pelvis, plantedFoot, true) } },
    feet: { [kick]: ankle, [other]: plantedFoot },
    toes: { [kick]: leg, [other]: 0 },
  };
}

// ---------------------------------------------------------------- superman / swimmers (face down, head at +x)

const PRONE_PELVIS: Point = [-20, -14];

/** Face down; `lift` 0 lies flat, 1 lifts chest, arms and legs; `arm`/`leg` add a flutter per side. */
function prone(
  lift: number,
  flutter: { hands?: Partial<Record<"near" | "far", number>>; feet?: Partial<Record<"near" | "far", number>> } = {},
): Pose {
  const pelvis = PRONE_PELVIS;
  const spine = -8 - 8 * lift;
  const chest = along(pelvis, spine, 80);
  const shoulder = along(pelvis, spine, 98);
  // Neck long, gaze down at the floor: the head tips below the line of the spine...
  const head = along(along(chest, spine, 20), spine + 30, 36);
  // ...so the arms reach long past it, just above the line of the spine.
  const arm = spine - 22;
  const leg = 180 + 4 + 8 * lift;
  const hand = (side: "near" | "far") => along(shoulder, arm - (flutter.hands?.[side] ?? 0), 125.9);
  // Straight legs: knees pinned on the line from hip to ankle.
  const legAt = (side: "near" | "far") => leg + (flutter.feet?.[side] ?? 0);
  const foot = (side: "near" | "far") => along(pelvis, legAt(side), 174);
  return {
    pelvis,
    chest,
    head,
    hands: { near: hand("near"), far: hand("far") },
    knees: { near: { at: along(pelvis, legAt("near"), THIGH) }, far: { at: along(pelvis, legAt("far"), THIGH) } },
    feet: { near: foot("near"), far: foot("far") },
    toes: { near: round(legAt("near")), far: round(legAt("far")) },
  };
}

export const BATCH_I_SPECS: DoodleSpec[] = [
  {
    id: "hf_139",
    slug: "burpee",
    title: "Burpee",
    transition: 0.4,
    frames: [
      { hold: 0.2, pose: stand() },
      { hold: 0.1, pose: squatHandsDown() },
      { hold: 0.15, pose: plank() },
      { hold: 0.15, pose: plank(-48) },
      { hold: 0.1, pose: plank() },
      { hold: 0.1, pose: squatHandsDown() },
      { hold: 0.15, pose: jump() },
      { hold: 0.05, pose: land() },
    ],
  },
  {
    id: "ntc_squat_thrust",
    slug: "squat-thrust",
    title: "Squat thrust",
    transition: 0.4,
    frames: [
      { hold: 0.25, pose: stand() },
      { hold: 0.1, pose: squatHandsDown() },
      { hold: 0.3, pose: plank() },
      { hold: 0.1, pose: squatHandsDown() },
    ],
  },
  {
    id: "hf_121",
    slug: "mountain-climber",
    title: "Mountain Climber",
    transition: 0.24,
    frames: [
      { hold: 0.12, pose: climber("near") },
      { hold: 0.12, pose: climber("far") },
    ],
  },
  {
    id: "hf_142",
    slug: "bear-crawl",
    title: "Bear Crawl",
    transition: 0.3,
    frames: [
      { hold: 0.05, pose: bear(0) },
      { hold: 0, pose: bear(1) },
      { hold: 0.05, pose: bear(2) },
      { hold: 0, pose: bear(3) },
    ],
  },
  {
    id: "ntc_high_knees",
    slug: "high-knees",
    title: "High knees",
    transition: 0.13,
    frames: [
      { hold: 0.08, pose: highKnee("near") },
      { hold: 0, pose: kneesPassing("far") },
      { hold: 0.08, pose: highKnee("far") },
      { hold: 0, pose: kneesPassing("near") },
    ],
  },
  {
    id: "ntc_fast_feet",
    slug: "fast-feet",
    title: "Fast feet",
    transition: 0.12,
    frames: [
      { hold: 0.02, pose: fastFeet("near") },
      { hold: 0.02, pose: fastFeet("far") },
    ],
  },
  {
    id: "ntc_squat_jacks",
    slug: "squat-jacks",
    title: "Squat jacks",
    view: "front",
    transition: 0.3,
    frames: [
      { hold: 0.15, pose: squatJack(false) },
      { hold: 0.15, pose: squatJack(true) },
    ],
  },
  {
    id: "ntc_ski_hops",
    slug: "ski-hops",
    title: "Ski hops",
    view: "front",
    props: [{ kind: "floor" }],
    transition: 0.18,
    frames: [
      { hold: 0.1, pose: skiHop(-55, false) },
      { hold: 0, pose: skiHop(0, true) },
      { hold: 0.1, pose: skiHop(55, false) },
      { hold: 0, pose: skiHop(0, true) },
    ],
  },
  {
    id: "ntc_lateral_shuffle",
    slug: "lateral-shuffle",
    title: "Lateral shuffle",
    view: "front",
    transition: 0.22,
    frames: [
      { hold: 0.05, pose: shuffle(-110, 10) },
      { hold: 0.05, pose: shuffle(-40, 10) },
      { hold: 0.05, pose: shuffle(-40, 80) },
      { hold: 0.05, pose: shuffle(30, 80) },
      { hold: 0.05, pose: shuffle(-40, 80) },
      { hold: 0.05, pose: shuffle(-40, 10) },
    ],
  },
  {
    id: "ntc_crab_toe_touch",
    slug: "crab-toe-touch",
    title: "Crab toe touch",
    transition: 0.6,
    frames: [
      { hold: 0.2, pose: crabTable() },
      { hold: 0.35, pose: crabReach("near") },
      { hold: 0.2, pose: crabTable() },
      { hold: 0.35, pose: crabReach("far") },
    ],
  },
  {
    id: "hf_117",
    slug: "superman-hold",
    title: "Superman Hold",
    transition: 0.9,
    frames: [
      { hold: 1.2, pose: prone(1) },
      { hold: 1.2, pose: prone(0.7) },
    ],
  },
  {
    id: "ntc_swimmers",
    slug: "swimmers",
    title: "Swimmers",
    transition: 0.3,
    frames: [
      // Opposite arm and leg rise together (near arm with far leg, then far arm with near leg).
      { hold: 0.05, pose: prone(1, { hands: { near: 18 }, feet: { far: 12 } }) },
      { hold: 0.05, pose: prone(1, { hands: { far: 18 }, feet: { near: 12 } }) },
    ],
  },
];
