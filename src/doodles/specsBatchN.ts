import { solvePose } from "./rig";
import type { DoodleSpec, Point, Pose, Prop } from "./rig";

/**
 * Batch N: core moves lying, seated, in side plank and hanging.
 * Floor at y = 0, up is negative, the figure faces +x (lying face up has the
 * head at -x). Side-lying uses the front view so the hips stack
 * (near = bottom side, far = top side).
 *
 * Left out: Floor windshield wiper (the legs sweep sideways from vertical; from
 * the feet the torso vanishes and from above the vertical legs do, so no view
 * reads honestly) and Leg Wheel (small leg circles project to a sway in side
 * and front view).
 */

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}

const round = (value: number): number => Math.round(value * 10) / 10;
const angle = (from: Point, to: Point): number => (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;
const distance = (a: Point, b: Point): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Hip to ankle with the knee straight (a hair short of 174). */
const LEG = 173.9;

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

/** Straight legs hovering just off the floor, or knees pulled in with the shins level. */
function legPullIn(tucked: boolean): Pose {
  const base = lyingFaceUp([-12, -20]);
  const pelvis = base.pelvis as Point;
  if (!tucked) {
    return {
      ...base,
      feet: { near: along(pelvis, -12, LEG), far: along(pelvis, -13, LEG - 0.5) },
      toes: { near: -12, far: -12 },
    };
  }
  const kneeNear = along(pelvis, -112, 88);
  const kneeFar = along(pelvis, -114, 88);
  return {
    ...base,
    knees: { near: { at: kneeNear }, far: { at: kneeFar } },
    // Shins parallel to the floor.
    feet: { near: along(kneeNear, 0, 86), far: along(kneeFar, -2, 86) },
    toes: { near: -5, far: -5 },
  };
}

// ---------------------------------------------------------------- sit-up (head left, knees bent)

const SITUP_PELVIS: Point = [-8, -20];
const SITUP_FEET: Point = [84, -2];

/**
 * Sit-up: the torso pivots at the hips from lying (`theta` ≈ 183, pointing -x) up
 * to sitting (`theta` ≈ -100). Arms crossed on the chest, hands at the opposite
 * shoulder; `tuck` tips the chin towards the chest. Feet stay flat and anchored.
 */
function sitUp(theta: number, tuck: number): Pose {
  const pelvis = SITUP_PELVIS;
  const chest = along(pelvis, theta, 80);
  const shoulder = along(pelvis, theta, 98);
  // Face side is theta + 90; the elbow points out over the chest towards the hips.
  const elbow = along(shoulder, theta + 150, 60);
  const hand = along(elbow, theta - 8, 66);
  const elbowFar = along(shoulder, theta + 148, 60);
  return {
    pelvis,
    chest,
    head: along(chest, theta + tuck, 56),
    hands: { near: hand, far: along(elbowFar, theta - 10, 66) },
    elbows: { near: { at: elbow }, far: { at: elbowFar } },
    feet: { near: SITUP_FEET, far: [SITUP_FEET[0] - 3, SITUP_FEET[1]] },
    toes: { near: 0, far: 0 },
  };
}

// ---------------------------------------------------------------- seated tucks (bench or floor)

/** Bench: seat from x = -170 to 20, top at y = -80. */
const SEAT_TOP = -80;
const SEAT_BENCH: Prop = { kind: "box", x: -170, y: SEAT_TOP, w: 190, h: -SEAT_TOP };

/**
 * Seated tuck, facing +x: hands grip the seat behind the hips, torso leaning
 * back at `torso`. `tucked` draws the knees to the chest (shins angled down);
 * otherwise the legs reach long and straight at `legDeg`, feet off the floor.
 */
function seatedTuck(seatY: number, hands: Point, torso: number, tucked: boolean, legDeg: number, tuckLeg: [number, number]): Pose {
  const pelvis: Point = [0, seatY];
  const chest = along(pelvis, torso, 80);
  const base: Pose = {
    pelvis,
    chest,
    // Head in line with the torso, eyes towards the knees.
    head: along(chest, torso + 12, 56),
    hands: { near: hands, far: [hands[0] - 4, hands[1]] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
  };
  if (!tucked) {
    return {
      ...base,
      feet: { near: along(pelvis, legDeg, LEG), far: along(pelvis, legDeg - 1, LEG - 0.4) },
      toes: { near: legDeg, far: legDeg },
    };
  }
  const [thigh, shin] = tuckLeg;
  const kneeNear = along(pelvis, thigh, 88);
  const kneeFar = along(pelvis, thigh - 2, 88);
  return {
    ...base,
    knees: { near: { at: kneeNear }, far: { at: kneeFar } },
    feet: { near: along(kneeNear, shin, 86), far: along(kneeFar, shin - 2, 86) },
    toes: { near: shin - 30, far: shin - 30 },
  };
}

/** On the bench: pelvis just above the seat, hands on its edges beside and behind the hips. */
const benchTuck = (tucked: boolean): Pose =>
  seatedTuck(SEAT_TOP - 10, [-44, SEAT_TOP - 2], tucked ? -100 : -135, tucked, 8, [-70, 80]);

/** On the floor: hands planted behind the hips; feet never touch down. */
const floorTuck = (tucked: boolean): Pose =>
  seatedTuck(-12, [-64, -2], tucked ? -105 : -128, tucked, -16, [-60, 30]);

// ---------------------------------------------------------------- dynamic side plank (front view, head left)

/** Bottom elbow on the floor; the bottom shoulder sits straight above it. */
const SP_ELBOW: Point = [-28, -4];
const SP_SHOULDER: Point = [SP_ELBOW[0], SP_ELBOW[1] - 60];
/** Pelvis to the bottom shoulder in the front view (98 along the spine, 22 across). */
const SP_REACH = Math.hypot(98, 22);
const SP_TWIST = (Math.atan2(22, 98) * 180) / Math.PI;
const SP_ANKLE_Y = -10;

/**
 * Side plank on the bottom forearm, legs stacked, top arm to the ceiling.
 * `pelvisY` lifts the hips into one line or dips them towards the floor;
 * the bottom ankle slides a touch so both legs stay straight.
 */
function sidePlankDip(pelvisY: number): Pose {
  const pelvis: Point = [round(SP_SHOULDER[0] + Math.sqrt(SP_REACH ** 2 - (pelvisY - SP_SHOULDER[1]) ** 2)), pelvisY];
  const spine = angle(pelvis, SP_SHOULDER) + SP_TWIST;
  const chest = along(pelvis, spine, 80);
  const hipNear = along(pelvis, spine - 90, 8);
  const hipFar = along(pelvis, spine + 90, 8);
  const ankleNear: Point = [round(hipNear[0] + Math.sqrt(LEG ** 2 - (SP_ANKLE_Y - hipNear[1]) ** 2)), SP_ANKLE_Y];
  const legDeg = angle(hipNear, ankleNear);
  const shoulderFar = along(along(chest, spine, 18), spine + 90, 22);
  return {
    pelvis,
    chest,
    elbows: { near: { at: SP_ELBOW }, far: { bend: 1 } },
    hands: { near: [SP_ELBOW[0] + 66, -4], far: along(shoulderFar, -90, 125.5) },
    feet: { near: ankleNear, far: along(hipFar, legDeg, LEG) },
    toes: { near: 0, far: 0 },
  };
}

// ---------------------------------------------------------------- reverse plank (head left, face up)

const RP_WRIST: Point = [0, -3];

/**
 * Reverse plank: wrists under the shoulders with the fingers to the feet, arms
 * straight, one straight line shoulder to heel. `b` is that line's slope (degrees).
 */
function reversePlank(b: number): Pose {
  const shoulder: Point = [RP_WRIST[0], RP_WRIST[1] - 117.9];
  const pelvis = along(shoulder, b, 98);
  const ankle = along(pelvis, b, LEG);
  return {
    pelvis,
    chest: along(pelvis, b + 180, 80),
    hands: { near: RP_WRIST, far: [RP_WRIST[0] - 3, RP_WRIST[1]] },
    wrists: { near: 0, far: 0 },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: ankle, far: ankle },
    toes: { near: RP_TOES, far: RP_TOES },
  };
}

/** Slope that puts the heels at `ankleY` with the body straight from the shoulders. */
const rpSlope = (ankleY: number): number => (Math.asin((ankleY - (RP_WRIST[1] - 117.9)) / (98 + LEG)) * 180) / Math.PI;

/** Heel height (ankle) in both phases; the toes point up. */
const RP_ANKLE_Y = -10;
const RP_TOES = -60;
/** Where the heels rest: under the straight-line plank, so they stay put as the hips lift. */
const RP_ANKLE_X = along([RP_WRIST[0], RP_WRIST[1] - 117.9], rpSlope(RP_ANKLE_Y), 98 + LEG)[0];

/**
 * Step 1, seated: legs long on the floor, hands on the floor behind the hips
 * with the fingers to the feet, arms straight, torso leaning back onto them.
 */
function reversePlankSeated(): Pose {
  const pelvisY = -20;
  const pelvis: Point = [round(RP_ANKLE_X - Math.sqrt(LEG ** 2 - (RP_ANKLE_Y - pelvisY) ** 2)), pelvisY];
  // Shoulder: 98 up the spine from the pelvis and a straight arm (117.9) from the wrist.
  const d = distance(pelvis, RP_WRIST);
  const a = (98 ** 2 - 117.9 ** 2 + d ** 2) / (2 * d);
  const h = Math.sqrt(98 ** 2 - a ** 2);
  const u: Point = [(RP_WRIST[0] - pelvis[0]) / d, (RP_WRIST[1] - pelvis[1]) / d];
  const shoulder: Point = [pelvis[0] + u[0] * a - u[1] * h, pelvis[1] + u[1] * a + u[0] * h];
  const ankle: Point = [RP_ANKLE_X, RP_ANKLE_Y];
  return {
    pelvis,
    chest: along(pelvis, angle(pelvis, shoulder), 80),
    hands: { near: RP_WRIST, far: RP_WRIST },
    wrists: { near: 0, far: 0 },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: ankle, far: ankle },
    toes: { near: RP_TOES, far: RP_TOES },
  };
}

// ---------------------------------------------------------------- hanging pike (copied from toes to bar)

/**
 * Facing +x throughout: straight arms, the spine leaning from the hands;
 * straight legs rise forward from the hips to `ankle`.
 */
function hangPike(pelvis: Point, ankle: Point, toe?: number): Pose {
  const hand: Point = [2, -420];
  const d = distance(hand, pelvis);
  const along1 = (98 ** 2 - 125.6 ** 2 + d ** 2) / (2 * d);
  const h = Math.sqrt(Math.max(0, 98 ** 2 - along1 ** 2));
  const u: Point = [(hand[0] - pelvis[0]) / d, (hand[1] - pelvis[1]) / d];
  const shoulder: Point = [pelvis[0] + u[0] * along1 - u[1] * h, pelvis[1] + u[1] * along1 + u[0] * h];
  const spine = angle(pelvis, shoulder);
  const chest = along(pelvis, spine, 80);
  const legDeg = angle(pelvis, ankle);
  return {
    pelvis,
    chest,
    head: along(chest, Math.min(spine + 40, -40), 54),
    hands: { near: [hand[0] + 2, hand[1]], far: [hand[0] - 2, hand[1]] },
    // Knees pinned on the hip-ankle line so the straight legs never kink.
    knees: { near: { at: along(pelvis, legDeg, 88) }, far: { at: along(pelvis, legDeg - 1, 88) } },
    feet: { near: ankle, far: along(pelvis, legDeg - 1, Math.min(173.85, distance(pelvis, ankle))) },
    toes: { near: toe ?? legDeg, far: toe ?? legDeg },
  };
}

export const BATCH_N_SPECS: DoodleSpec[] = [
  {
    id: "fedb_leg_pull_in",
    slug: "leg-pull-in",
    title: "Leg Pull-In",
    transition: 0.9,
    frames: [
      { hold: 0.4, pose: legPullIn(false) },
      { hold: 0.5, pose: legPullIn(true) },
    ],
  },
  {
    id: "fedb_seated_flat_bench_leg_pull_in",
    slug: "seated-flat-bench-leg-pull-in",
    title: "Seated Flat Bench Leg Pull-In",
    props: [SEAT_BENCH],
    transition: 0.9,
    frames: [
      { hold: 0.4, pose: benchTuck(false) },
      { hold: 0.5, pose: benchTuck(true) },
    ],
  },
  {
    id: "fedb_seated_leg_tucks",
    slug: "seated-leg-tucks",
    title: "Seated Leg Tucks",
    props: [SEAT_BENCH],
    transition: 0.9,
    frames: [
      { hold: 0.4, pose: benchTuck(false) },
      { hold: 0.5, pose: benchTuck(true) },
    ],
  },
  {
    id: "wger_1105",
    slug: "seated-knee-tuck",
    title: "Seated Knee Tuck",
    transition: 0.9,
    frames: [
      { hold: 0.4, pose: floorTuck(false) },
      { hold: 0.5, pose: floorTuck(true) },
    ],
  },
  {
    id: "fedb_sit_up",
    slug: "sit-up",
    title: "Sit-Up",
    transition: 0.6,
    frames: [
      { hold: 0.4, pose: sitUp(183, 1) },
      { hold: 0.05, pose: sitUp(215, 10) },
      { hold: 0.5, pose: sitUp(-100, 8) },
      { hold: 0.05, pose: sitUp(215, 10) },
    ],
  },
  {
    id: "wger_1288",
    slug: "dynamic-side-plank",
    title: "Dynamic side plank",
    view: "front",
    transition: 1,
    frames: [
      { hold: 0.4, pose: sidePlankDip(-52) },
      { hold: 0.3, pose: sidePlankDip(-28) },
    ],
  },
  {
    id: "wger_500",
    slug: "reverse-plank",
    title: "Reverse Plank",
    // Seated set-up, then lift into the straight-line plank and hold.
    transition: 1.1,
    frames: [
      { hold: 0.6, pose: reversePlankSeated() },
      { hold: 1.6, pose: reversePlank(rpSlope(RP_ANKLE_Y)) },
    ],
  },
  {
    id: "fedb_hanging_pike",
    slug: "hanging-pike",
    title: "Hanging Pike",
    props: [{ kind: "bar", y: -420, x1: -110, x2: 110, grips: [0] }],
    transition: 0.6,
    frames: [
      // Dead hang, straight legs forward to an L, then on up into a pike with the feet at the bar.
      { hold: 0.4, pose: hangPike([0, -196], along([0, -196], 89, 173.85)) },
      { hold: 0.05, pose: hangPike([-6, -198], along([-6, -198], 0, 173.85)) },
      // Ankle a full straight leg from the pelvis, so the knees do not hyperextend at the top.
      { hold: 0.5, pose: hangPike([-80, -258], along([-80, -258], angle([-80, -258], [12, -402]), 173.85), -20) },
      { hold: 0.05, pose: hangPike([-6, -198], along([-6, -198], 0, 173.85)) },
    ],
  },
];
