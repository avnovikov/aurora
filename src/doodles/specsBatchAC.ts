import { BONES, dist, HIP_SIDE, other, solvePose, zOut } from "./rig";
import type { AuthoredPose, DoodleSpec, Keyframe, Point, Pose, Prop, Side, Sideways } from "./rig";
import { lockedY3, TWO_VIEWS } from "./sideways";
import { LOCKED, lockedShoulderY, pushUp, rep, straightBody } from "./specsBatchC";
import { plank } from "./specsBatchI";

/**
 * Batch AC (#174): incline push-ups, dips on chairs and benches, the ab wheel
 * rollout and plank crawls. One view each (side), except the leg wheel (side + front). Floor at y = 0, up is
 * negative, the figure faces +x (a plank has the head at +x, lying face up has
 * the head at -x).
 *
 * The ab wheel is drawn by the spec's `wheel` radius round the near hand; the
 * hands roll at the wheel's axle height so it sits on the floor.
 */

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}

const round = (value: number): number => Math.round(value * 10) / 10;
const angle = (from: Point, to: Point): number => (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;

const THIGH = BONES.thigh;
const SHIN = BONES.shin;
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

/** Second view (#174): hands on the box well outside the shoulders (±22), elbows flaring as the chest lowers. */
const INCLINE_WIDE: Sideways = { hands: { near: -52, far: 52 }, elbows: { near: { out: 65 }, far: { out: 65 } } };
const INCLINE_WIDE_TOP = lockedY3(incline, INCLINE_WIDE, ["near", "far"], -260, -100);
const inclineWideRep = (): Keyframe[] =>
  rep(incline, INCLINE_WIDE_TOP, INCLINE_BOTTOM, 0.4, 0.3).map((frame) => ({ ...frame, sideways: INCLINE_WIDE }));

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
/** Ab wheel radius (about half the head's, with a hub dot, so it does not read as a second head); the hands hold its axle this high. */
const AB_WHEEL = 14;

/**
 * Kneeling rollout: thigh at `thighDeg` from the knee, torso at `torsoDeg` from
 * the hips, arms locked from the shoulders to the hands on the wheel's axle ahead.
 */
function rollout(thighDeg: number, torsoDeg: number): Pose {
  const pelvis = along(AB_KNEE, thighDeg, THIGH);
  const chest = along(pelvis, torsoDeg, 80);
  const shoulder = along(pelvis, torsoDeg, 98);
  const reach = LOCKED - 0.3;
  const hand: Point = [round(shoulder[0] + Math.sqrt(reach ** 2 - (shoulder[1] + AB_WHEEL) ** 2)), -AB_WHEEL];
  return {
    pelvis,
    chest,
    hands: { near: hand, far: [hand[0] - 2, -AB_WHEEL] },
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
  { hold: 0.5, pose: rollout(-20, -20) },
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

/** Feet sideways (z) at rest: together, a little inside the hips (±8). */
const WHEEL_FOOT_Z = 4;
/** Half-width of the circle, in degrees of leg tilt (forward/back in the side view, sideways in the front view). */
const WHEEL_TILT = 11;

/**
 * Legs straight up and together, tilted `deg` from the hips in the side view
 * (-90 is vertical) and `sway` degrees sideways (towards the far side).
 */
function legsUp(deg: number, sway: number): Keyframe {
  const base = lyingFaceUp([-12, -20]);
  const pelvis = base.pelvis as Point;
  const r = (sway * Math.PI) / 180;
  const shift = 173.98 * Math.sin(r);
  const foot = (side: Side): { at: Point; z: number } => {
    const hipZ = side === "near" ? -8 : 8;
    const z = (side === "near" ? -WHEEL_FOOT_Z : WHEEL_FOOT_Z) + shift;
    return { at: along(pelvis, deg, Math.sqrt(173.98 ** 2 - (z - hipZ) ** 2)), z: round(z) };
  };
  const [near, far] = [foot("near"), foot("far")];
  return {
    hold: 0,
    pose: { ...base, feet: { near: near.at, far: far.at }, toes: { near: deg, far: deg } },
    sideways: { feet: { near: near.z, far: far.z } },
  };
}

/**
 * One small circle: the feet sweep towards the head and back in the side view
 * while they sway side to side in the front view, a quarter turn out of step,
 * so the two together trace the circle. The pelvis stays down.
 */
const LEG_WHEEL_FRAMES: Keyframe[] = Array.from({ length: 8 }, (_, i) => {
  const theta = (i * Math.PI) / 4;
  return legsUp(round(-84 + WHEEL_TILT * Math.cos(theta)), round(WHEEL_TILT * Math.sin(theta)));
});

// ---------------------------------------------------------------- climbers and crawls

// Cross-body climber: a knee drives in low under the chest, across to finish under the other shoulder.

/** Second view: the knee crosses the midline to under the opposite shoulder (±22); the foot follows partway. */
const CROSS_KNEE_Z = 24;
const CROSS_ANKLE_Z = 2;
/** The driven foot, toes pointed back. */
const CROSS_TOE = 150;

function crossClimber(side: Side): AuthoredPose {
  const base = plank();
  // Across the body: the knee ends on the other side of the midline.
  return {
    ...base,
    knees: { [side]: { dir: 40 } },
    feet: { [side]: { dir: 170 }, [other(side)]: base.feet?.near as Point },
    toes: { [side]: CROSS_TOE, [other(side)]: 62 },
  };
}

function crossSideways(side: Side): Sideways {
  const across = -zOut(side);
  return {
    knees: { [side]: { at: across * CROSS_KNEE_Z } },
    feet: { [side]: across * CROSS_ANKLE_Z },
  };
}

/** The hips pike up this much as a knee passes under them (in a plank the hip is lower than a thigh is long). */
const CROSS_PIKE = 24;
const CROSS_PIKE_SLIDE = 7;

/**
 * Halfway through a swing: hips piked up a little, `side`'s thigh straight
 * down under the hip with the shin trailing back level, the other foot planted.
 */
function crossPass(side: Side): AuthoredPose {
  const base = plank();
  const chest = base.chest as Point;
  const flat = base.pelvis as Point;
  const chord = dist(flat, chest);
  const y = flat[1] - CROSS_PIKE;
  const pelvis: Point = [round(chest[0] - Math.sqrt(chord ** 2 - (chest[1] - y) ** 2)), y];
  const [plantX, plantY] = base.feet?.near as Point;
  return {
    ...base,
    pelvis,
    knees: { [side]: { dir: 92 } },
    // The planted foot slides in a little as the hips pike, so that leg stays straight.
    feet: { [side]: { dir: 200 }, [other(side)]: [plantX + CROSS_PIKE_SLIDE, plantY] },
    toes: { [side]: 100, [other(side)]: 62 },
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
  // Knees bend forward (and roll out in the second view, see GROIN_SQUAT).
  const base: Pose = {
    pelvis,
    hands: GROIN_HANDS,
    knees: { near: { bend: -1 }, far: { bend: -1 } },
    feet: { near: ankle, far: [ankle[0] - 3, 0] },
    toes: { near: 0, far: 0 },
  };
  const { chest } = solvePose(base);
  // Head up: the neck tips back from the line of the spine to look ahead.
  return { ...base, chest, head: along(chest, angle(pelvis, chest) + 14, 56) };
}

/** Feet in the air halfway between plank and squat, knees tucked. */
function groinAir(): Pose {
  const pelvis: Point = [-58, -110];
  const ankle: Point = [-66, -44];
  return {
    pelvis,
    hands: GROIN_HANDS,
    knees: { near: { bend: -1 }, far: { bend: -1 } },
    feet: { near: ankle, far: ankle },
    toes: { near: 60, far: 60 },
  };
}

/** Push-off: the hips pop up and both feet leave the floor before the knees fold (and on the way back, before they land). */
function groinLift(): AuthoredPose {
  const base = plank();
  const chest = base.chest as Point;
  const plankPelvis = base.pelvis as Point;
  const chord = dist(plankPelvis, chest);
  const pelvisY = plankPelvis[1] - 14;
  const pelvis: Point = [round(chest[0] - Math.sqrt(chord ** 2 - (chest[1] - pelvisY) ** 2)), pelvisY];
  const leg = { dir: 166, length: LEG - 2 };
  return { ...base, pelvis, feet: { near: leg, far: leg }, toes: { near: 70, far: 70 } };
}

/** Just before touching down in the squat: feet over their landing spot, a hand's breadth up. */
function groinLand(): Pose {
  const squat = groinSquat();
  const pelvis = squat.pelvis as Point;
  return {
    ...squat,
    pelvis: [pelvis[0] - 6, pelvis[1] - 14],
    head: undefined,
    chest: undefined,
    feet: { near: [28, -9], far: [25, -9] },
    toes: { near: 10, far: 10 },
  };
}

/**
 * Second view: hands on the floor inside the shoulders, the feet land wide,
 * outside the hands, knees pushed out over the toes.
 */
const GROIN_HAND_Z = 16;
const groinSideways = (footZ: number, out: number): Sideways => ({
  hands: { near: -GROIN_HAND_Z, far: GROIN_HAND_Z },
  feet: { near: -footZ, far: footZ },
  knees: { near: { out }, far: { out } },
});
const GROIN_PLANK = groinSideways(HIP_SIDE, 0);
const GROIN_AIR = groinSideways(34, 45);
const GROIN_SQUAT = groinSideways(58, 60);

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
    views: TWO_VIEWS,
    props: [INCLINE_PROP],
    transition: 0.5,
    frames: inclineWideRep(),
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
      { hold: 0.4, pose: chairDip([0, -128], true) },
      { hold: 0.3, pose: chairDip([-9, -84], false) },
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
    wheel: AB_WHEEL,
    transition: 0.4,
    frames: ROLLOUT_FRAMES,
  },
  {
    id: "wger_1573",
    slug: "ab-wheel",
    title: "Ab wheel",
    wheel: AB_WHEEL,
    transition: 0.4,
    frames: ROLLOUT_FRAMES,
  },
  {
    id: "wger_1909",
    slug: "leg-wheel",
    title: "Leg Wheel",
    views: TWO_VIEWS,
    transition: 0.28,
    frames: LEG_WHEEL_FRAMES,
  },
  {
    id: "ntc_cross_body_climber",
    slug: "cross-body-mountain-climber",
    title: "Cross-body mountain climber",
    views: TWO_VIEWS,
    transition: 0.14,
    frames: [
      // One leg at a time: drive a knee across, return that foot to plank, then the other.
      { hold: 0.12, pose: crossClimber("near"), sideways: crossSideways("near") },
      { hold: 0, pose: crossPass("near") },
      { hold: 0, pose: plank() },
      { hold: 0, pose: crossPass("far") },
      { hold: 0.12, pose: crossClimber("far"), sideways: crossSideways("far") },
      { hold: 0, pose: crossPass("far") },
      { hold: 0, pose: plank() },
      { hold: 0, pose: crossPass("near") },
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
    views: TWO_VIEWS,
    transition: 0.14,
    frames: [
      { hold: 0.3, pose: { ...plank(), chest: undefined }, sideways: GROIN_PLANK },
      { hold: 0, pose: groinLift(), sideways: GROIN_PLANK },
      { hold: 0, pose: groinAir(), sideways: GROIN_AIR },
      { hold: 0, pose: groinLand(), sideways: GROIN_SQUAT },
      { hold: 0.5, pose: groinSquat(), sideways: GROIN_SQUAT },
      { hold: 0, pose: groinLand(), sideways: GROIN_SQUAT },
      { hold: 0, pose: groinAir(), sideways: GROIN_AIR },
      { hold: 0, pose: groinLift(), sideways: GROIN_PLANK },
    ],
  },
];
