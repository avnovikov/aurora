import type { DoodleSpec, Keyframe, Point, Pose, Prop, Side, Sideways } from "./rig";

/**
 * Batch AI: conditioning and standing mobility (marching high knees, fast
 * skipping, carioca, overhead claps, leg swings, horse stance, pancakes).
 * Floor at y = 0, up is negative, the side-view figure faces +x; in front
 * view the near side is on the viewer's left. Import only from ./rig and
 * other batch files — never from ./specs (that would be circular).
 */

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}

const round = (value: number): number => Math.round(value * 10) / 10;
const angle = (from: Point, to: Point): number => (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;

/** Where circles around `a` (radius ra) and `b` (radius rb) meet; `side` 1 or -1 picks the point left/right of a→b. */
function meet(a: Point, ra: number, b: Point, rb: number, side: 1 | -1): Point {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const x = (ra * ra - rb * rb + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, ra * ra - x * x));
  const ux = (b[0] - a[0]) / d;
  const uy = (b[1] - a[1]) / d;
  return [round(a[0] + ux * x - side * uy * h), round(a[1] + uy * x + side * ux * h)];
}

/** Middle joint (knee / elbow) between `root` and `end`, pushed towards -x (`outLeft`) or +x. */
function joint(root: Point, l1: number, end: Point, l2: number, outLeft: boolean): Point {
  const a = meet(root, l1, end, l2, 1);
  const b = meet(root, l1, end, l2, -1);
  return outLeft === a[0] < b[0] ? a : b;
}

const other = (side: Side): Side => (side === "near" ? "far" : "near");

const THIGH = 88;
const SHIN = 86;
/** Shoulder to fingertip, elbow locked (a hair short so the solver keeps it straight). */
const ARM = 125.9;
/** Hip to ankle, knee locked. */
const LEG = 173.6;

const STAND_PELVIS: Point = [0, -172];
const STAND_CHEST: Point = [0, -252];
/** Side-view shoulder of the standing figure (chest + 18 up the spine). */
const STAND_SHOULDER: Point = [0, -270];

// ---------------------------------------------------------------- marching high knees (side)

/** Arm swing for a march or skip: `fwd` drives forward with the elbow bent, the other arm swings back. */
function swingArms(shoulder: Point, fwd: Side, reach: number): Pick<Pose, "hands" | "elbows"> {
  const fwdElbow = along(shoulder, 90 - reach, 60);
  const backElbow = along(shoulder, 90 + reach * 0.8, 60);
  return {
    hands: { [fwd]: along(fwdElbow, -15, 66), [other(fwd)]: along(backElbow, 70, 66) },
    elbows: { [fwd]: { at: fwdElbow }, [other(fwd)]: { at: backElbow } },
  };
}

/** Standing tall on one straight leg, the `up` knee lifted above hip height, opposite arm forward. */
function highMarch(up: Side): Pose {
  const pelvis = STAND_PELVIS;
  const knee = along(pelvis, -24, THIGH);
  return {
    pelvis,
    chest: STAND_CHEST,
    knees: { [up]: { at: knee } },
    feet: { [up]: along(knee, 96, SHIN), [other(up)]: [0, 0] },
    toes: { [up]: 15, [other(up)]: 0 },
    ...swingArms(STAND_SHOULDER, other(up), 34),
  };
}

/** Between steps: both feet down, arms passing the hips. */
function marchDown(): Pose {
  return {
    pelvis: STAND_PELVIS,
    chest: STAND_CHEST,
    feet: { near: [0, 0], far: [0, 0] },
    toes: { near: 0, far: 0 },
    hands: { near: [8, -146], far: [4, -146] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
  };
}

// ---------------------------------------------------------------- fast skipping (side)

/** The `side` foot lands under the hips; the other leg trails behind, toes just off the floor. */
function skipStep(side: Side): Pose {
  const pelvis: Point = [0, -166];
  const chest = along(pelvis, -84, 80);
  const shoulder = along(pelvis, -84, 98);
  const trail: Point = [-56, -26];
  return {
    pelvis,
    chest,
    knees: { [side]: { bend: -1 }, [other(side)]: { at: joint(pelvis, THIGH, trail, SHIN, false) } },
    feet: { [side]: [6, 0], [other(side)]: trail },
    toes: { [side]: 0, [other(side)]: 60 },
    ...swingArms(shoulder, side, 10),
  };
}

/** Hop on the `side` foot (low, toes just off the floor) while the other knee drives up. */
function skipHop(side: Side): Pose {
  const pelvis: Point = [6, -182];
  const chest = along(pelvis, -84, 80);
  const shoulder = along(pelvis, -84, 98);
  const knee = along(pelvis, 28, THIGH);
  return {
    pelvis,
    chest,
    knees: { [other(side)]: { at: knee } },
    feet: { [side]: [2, -16], [other(side)]: along(knee, 104, SHIN) },
    toes: { [side]: 40, [other(side)]: 40 },
    ...swingArms(shoulder, side, 40),
  };
}

// ---------------------------------------------------------------- carioca quick step (two views)

const CARIOCA_Y = -160;
/** Half the gap between the feet in the stance ("a few inches apart"). */
const CARIOCA_HALF = 18;

/**
 * One carioca key in two views. `pelvisZ` is the sideways position of the hips;
 * `feet` gives each foot's side-view point and z. `pull` drives that knee forward
 * and up towards hip height (the opposite arm swings forward).
 */
function cariocaKey(
  hold: number,
  pelvisZ: number,
  feet: Record<Side, [x: number, y: number, z: number]>,
  pull?: Side,
): Keyframe {
  const pelvis: Point = [-6, CARIOCA_Y - (pull ? 6 : 0)];
  const shoulder = along(pelvis, -86, 98);
  const pose: Pose = {
    pelvis,
    chest: along(pelvis, -86, 80),
    feet: { near: [feet.near[0], feet.near[1]], far: [feet.far[0], feet.far[1]] },
    toes: { near: 0, far: 0 },
  };
  const sideways: Sideways = { pelvis: pelvisZ, feet: { near: feet.near[2], far: feet.far[2] } };
  if (pull) {
    // The pulled knee keeps its foot's z (across the body), so the thigh is a little shorter in the side view.
    const kneeZ = feet[pull][2];
    const hipZ = pelvisZ + (pull === "near" ? -8 : 8);
    const knee = along(pelvis, 6, Math.sqrt(THIGH * THIGH - (kneeZ - hipZ) ** 2));
    sideways.knees = { [pull]: { at: kneeZ } };
    const fwdElbow = along(shoulder, 50, 60);
    const backElbow = along(shoulder, 125, 60);
    pose.knees = { [pull]: { at: knee } };
    pose.feet = { ...pose.feet, [pull]: along(knee, 100, SHIN) };
    pose.toes = { ...pose.toes, [pull]: 30 };
    pose.hands = { [other(pull)]: along(fwdElbow, -30, 66), [pull]: along(backElbow, 70, 66) };
    pose.elbows = { [other(pull)]: { at: fwdElbow }, [pull]: { at: backElbow } };
  } else {
    // Arms loose and slightly bent, hands by the hips.
    pose.hands = { near: [shoulder[0] + 16, shoulder[1] + 112], far: [shoulder[0] + 12, shoulder[1] + 112] };
    pose.elbows = { near: { bend: 1 }, far: { bend: 1 } };
  }
  return { hold, pose, sideways };
}

/**
 * One carioca cycle from a stance centred at `c`, travelling `dir` (-1 towards the
 * near side, the front panel's left). The trailing foot steps behind the support
 * leg, that knee is pulled forward and up, the foot comes down across the front,
 * and the lead foot steps out to a fresh stance 60 further on.
 */
function cariocaCycle(c: number, dir: 1 | -1): Keyframe[] {
  const lead: Side = dir < 0 ? "near" : "far";
  const cross = other(lead);
  const at = (leadFoot: [number, number, number], crossFoot: [number, number, number]) =>
    ({ [lead]: leadFoot, [cross]: crossFoot }) as Record<Side, [number, number, number]>;
  const leadZ = c + dir * CARIOCA_HALF;
  return [
    cariocaKey(0.04, c, at([0, 0, leadZ], [0, 0, c - dir * CARIOCA_HALF])),
    // Trailing foot lifts and steps behind the support leg...
    cariocaKey(0, c + dir * 8, at([0, 0, leadZ], [-18, -22, c + dir * 8])),
    cariocaKey(0.02, c + dir * 20, at([0, 0, leadZ], [-30, 0, c + dir * 40])),
    // ...then that knee is pulled forward and up.
    cariocaKey(0.06, c + dir * 22, at([0, 0, leadZ], [0, 0, c + dir * 30]), cross),
    // It comes down across the front, and the lead foot steps out.
    cariocaKey(0.02, c + dir * 30, at([0, 0, leadZ], [4, 0, c + dir * 44])),
    cariocaKey(0, c + dir * 45, at([0, -22, c + dir * 62], [4, 0, c + dir * 44])),
  ];
}

// ---------------------------------------------------------------- claps over the head (front)

/** Front-view shoulders of the clap stance (pelvis on locked legs, feet ±24). */
const CLAP_LEGS = straightLegsFront(24);
const CLAP_PELVIS = CLAP_LEGS.pelvis as Point;
const SHOULDER_NEAR: Point = [-22, CLAP_PELVIS[1] - 98];
const SHOULDER_FAR: Point = [22, CLAP_PELVIS[1] - 98];

/** Straight arms at `deg` from the near shoulder (mirrored on the far side). */
function straightArms(deg: number): Pick<Pose, "hands" | "elbows"> {
  const farDeg = 180 - deg;
  return {
    hands: { near: along(SHOULDER_NEAR, deg, ARM), far: along(SHOULDER_FAR, farDeg, ARM) },
    elbows: { near: { at: along(SHOULDER_NEAR, deg, 60) }, far: { at: along(SHOULDER_FAR, farDeg, 60) } },
  };
}

/** Hands meeting above the head, elbows bent out so the arms pass beside the head. */
function clapArms(): Pick<Pose, "hands" | "elbows"> {
  const handNear: Point = [-2, SHOULDER_NEAR[1] - 114];
  const handFar: Point = [2, SHOULDER_FAR[1] - 114];
  return {
    hands: { near: handNear, far: handFar },
    elbows: {
      near: { at: joint(SHOULDER_NEAR, 60, handNear, 66, true) },
      far: { at: joint(SHOULDER_FAR, 60, handFar, 66, false) },
    },
  };
}

/** Front view: straight legs from the hips (±8) to feet at ±`footX`, with the pelvis at the height that keeps them locked. */
function straightLegsFront(footX: number): Pick<Pose, "pelvis" | "knees" | "feet" | "toes"> {
  const dx = footX - 8;
  const y = -round(Math.sqrt(LEG * LEG - dx * dx));
  const hipNear: Point = [-8, y];
  const hipFar: Point = [8, y];
  const feet: Record<Side, Point> = { near: [-footX, 0], far: [footX, 0] };
  return {
    pelvis: [0, y],
    knees: { near: { at: along(hipNear, angle(hipNear, feet.near), THIGH) }, far: { at: along(hipFar, angle(hipFar, feet.far), THIGH) } },
    feet,
    toes: { near: 180, far: 0 },
  };
}

function clapPose(arms: Pick<Pose, "hands" | "elbows">): Pose {
  return { ...CLAP_LEGS, chest: [0, CLAP_PELVIS[1] - 80], ...arms };
}

// ---------------------------------------------------------------- front leg raises (side)

/** A chair back / rail seen end-on beside the hips; the far hand holds it. */
const RAIL: Prop = { kind: "bar", y: -196, x1: 20, x2: 34, grips: [27] };

/** Tall on the far leg, far hand on the rail, near hand on the hip; the straight near leg swings `deg` from straight down (+ forward). */
function frontLegRaise(deg: number): Pose {
  return {
    pelvis: STAND_PELVIS,
    chest: STAND_CHEST,
    hands: { near: [-4, -176], far: [30, -196] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: along(STAND_PELVIS, 90 - deg, LEG), far: [-2, 0] },
    // Toes pulled up on the forward swing, pointed on the back swing.
    toes: { near: deg > 0 ? -deg * 0.6 : 30 - deg, far: 0 },
  };
}

// ---------------------------------------------------------------- crossbody leg swings (front)

/** An upright support on the viewer's right; the far (left) hand holds it. */
const POST: Prop = { kind: "box", x: 112, y: -300, w: 10, h: 300 };
const SWING_PELVIS: Point = [0, -174];
const SWING_HIP_NEAR: Point = [-8, -174];

/** Standing on the far leg; the straight near leg swings `deg` from straight down (+ across the body, - out to the side). */
function crossSwing(deg: number): Pose {
  const shoulder: Point = [-22, -272];
  const elbow = along(shoulder, 118, 60);
  return {
    pelvis: SWING_PELVIS,
    chest: [0, -254],
    hands: { near: along(elbow, angle(elbow, [-14, -178]), 66), far: [110, -204] },
    elbows: { near: { at: elbow }, far: { bend: -1 } },
    feet: { near: along(SWING_HIP_NEAR, 90 - deg, LEG), far: [8, 0] },
    toes: { near: 180, far: 0 },
  };
}

// ---------------------------------------------------------------- horse stance (front)

const HORSE_FEET: Record<Side, Point> = { near: [-104, 0], far: [104, 0] };

/** Feet wide, toes out; `pelvisY` sets the depth. Hands rest on the thighs, knees pressed out over the toes. */
function horse(pelvisY: number): Pose {
  const hipNear: Point = [-8, pelvisY];
  const hipFar: Point = [8, pelvisY];
  const kneeNear = joint(hipNear, THIGH, HORSE_FEET.near, SHIN, true);
  const kneeFar = joint(hipFar, THIGH, HORSE_FEET.far, SHIN, false);
  // Hands on the thighs, a little above the knees.
  // Standing tall: hands on the hips. Sitting low: hands on the thighs, a little above the knees.
  const share = pelvisY < -120 ? 0.1 : 0.62;
  const handNear: Point = [round(hipNear[0] + (kneeNear[0] - hipNear[0]) * share - (share < 0.5 ? 10 : 0)), round(hipNear[1] + (kneeNear[1] - hipNear[1]) * share - 4)];
  const handFar: Point = [round(hipFar[0] + (kneeFar[0] - hipFar[0]) * share + (share < 0.5 ? 10 : 0)), round(hipFar[1] + (kneeFar[1] - hipFar[1]) * share - 4)];
  const shoulderNear: Point = [-22, pelvisY - 98];
  const shoulderFar: Point = [22, pelvisY - 98];
  return {
    pelvis: [0, pelvisY],
    chest: [0, pelvisY - 80],
    hands: { near: handNear, far: handFar },
    elbows: { near: { at: joint(shoulderNear, 60, handNear, 66, true) }, far: { at: joint(shoulderFar, 60, handFar, 66, false) } },
    knees: { near: { at: kneeNear }, far: { at: kneeFar } },
    feet: HORSE_FEET,
    toes: { near: 200, far: -20 },
  };
}

// ---------------------------------------------------------------- standing pancake (two views)

/** Feet much wider than the shoulders (±22), toes forward; legs long, knees soft. */
const PANCAKE_FEET_Z = 84;

/** Pelvis height for long legs from hips at `x` to feet at x 0, set out ±PANCAKE_FEET_Z. */
const pancakeY = (x: number): number => -round(Math.sqrt(LEG * LEG - x * x - (PANCAKE_FEET_Z - 8) ** 2));

const pancakeSideways = (handZ: number): Sideways => ({
  feet: { near: -PANCAKE_FEET_Z, far: PANCAKE_FEET_Z },
  hands: { near: -handZ, far: handZ },
});

/** Tall in the wide stance, hands on the tops of the thighs. */
function pancakeStand(): Keyframe {
  const pelvis: Point = [0, pancakeY(0)];
  return {
    hold: 0.5,
    pose: {
      pelvis,
      chest: [0, pelvis[1] - 80],
      hands: { near: [12, pelvis[1] + 16], far: [8, pelvis[1] + 16] },
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
      feet: { near: [0, 0], far: [0, 0] },
      toes: { near: 0, far: 0 },
    },
    sideways: pancakeSideways(28),
  };
}

/** Hips pushed back, flat back at `spineDeg` (0 = level, + head lower), hands lowering to `handY` between the feet. */
function pancakeHinge(spineDeg: number, handY: number, hold: number): Keyframe {
  const pelvis: Point = [-34, pancakeY(34)];
  const chest = along(pelvis, spineDeg, 80);
  const shoulder = along(pelvis, spineDeg, 98);
  const drop = handY - shoulder[1];
  const reach = Math.min(drop, ARM - 1);
  const hand: Point = [round(shoulder[0] + Math.sqrt(Math.max(0, (ARM - 1) ** 2 - reach * reach)) * 0.4), handY];
  return {
    hold,
    pose: {
      pelvis,
      chest,
      head: along(shoulder, spineDeg + 8, 38),
      hands: { near: hand, far: hand },
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
      feet: { near: [0, 0], far: [0, 0] },
      toes: { near: 0, far: 0 },
    },
    sideways: pancakeSideways(16),
  };
}

// ---------------------------------------------------------------- seated pancake (side)

const SEAT: Point = [0, -22];
/** Straight legs along the floor (knees locked). */
const SEAT_FEET: Record<Side, Point> = { near: along(SEAT, 4, LEG), far: along(SEAT, 4, LEG) };
const SEAT_KNEE: Point = along(SEAT, 4, THIGH);

/** Seated, legs straight with toes up; torso at `lean` (degrees forward of upright), hands on the floor at `handX`. */
function seatedPancake(lean: number, handX: number): Pose {
  const spineDeg = -90 + lean;
  const shoulder = along(SEAT, spineDeg, 98);
  return {
    pelvis: SEAT,
    chest: along(SEAT, spineDeg, 80),
    head: along(shoulder, spineDeg + lean * 0.15, 38),
    hands: { near: [handX, -2], far: [handX - 4, -2] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { at: SEAT_KNEE }, far: { at: SEAT_KNEE } },
    feet: SEAT_FEET,
    toes: { near: -80, far: -80 },
  };
}

export const BATCH_AI_SPECS: DoodleSpec[] = [
  {
    id: "wger_1965",
    slug: "marching-high-knees",
    title: "Marching High Knees",
    transition: 0.4,
    frames: [
      { hold: 0.25, pose: highMarch("near") },
      { hold: 0, pose: marchDown() },
      { hold: 0.25, pose: highMarch("far") },
      { hold: 0, pose: marchDown() },
    ],
  },
  {
    id: "fedb_fast_skipping",
    slug: "fast-skipping",
    title: "Fast Skipping",
    transition: 0.14,
    frames: [
      { hold: 0.02, pose: skipStep("near") },
      { hold: 0.04, pose: skipHop("near") },
      { hold: 0.02, pose: skipStep("far") },
      { hold: 0.04, pose: skipHop("far") },
    ],
  },
  {
    // Two views: the side shows the trailing foot stepping behind the support leg
    // and that knee pulled forward and up; the front the sideways travel and the crossing.
    id: "fedb_carioca_quick_step",
    slug: "carioca-quick-step",
    title: "Carioca Quick Step",
    views: ["side", "front"],
    transition: 0.17,
    frames: [...cariocaCycle(0, -1), ...cariocaCycle(-60, -1), ...cariocaCycle(-120, 1), ...cariocaCycle(-60, 1)],
  },
  {
    id: "wger_1223",
    slug: "claps-over-the-head",
    title: "Claps over the head",
    view: "front",
    transition: 0.3,
    frames: [
      { hold: 0.1, pose: clapPose(straightArms(98)) },
      { hold: 0, pose: clapPose(straightArms(176)) },
      { hold: 0.12, pose: clapPose(clapArms()) },
      { hold: 0, pose: clapPose(straightArms(176)) },
    ],
  },
  {
    id: "fedb_front_leg_raises",
    slug: "front-leg-raises",
    title: "Front Leg Raises",
    props: [RAIL],
    transition: 0.65,
    frames: [
      { hold: 0.1, pose: frontLegRaise(70) },
      { hold: 0.1, pose: frontLegRaise(-34) },
    ],
  },
  {
    id: "wger_1395",
    slug: "crossbody-leg-swings",
    title: "Crossbody Leg Swings",
    view: "front",
    props: [POST],
    transition: 0.65,
    frames: [
      { hold: 0.1, pose: crossSwing(32) },
      { hold: 0.1, pose: crossSwing(-40) },
    ],
  },
  {
    id: "wger_1846",
    slug: "horse-stance",
    title: "Horse Stance (Side Splits)",
    view: "front",
    transition: 1.1,
    frames: [
      { hold: 0.5, pose: horse(-140) },
      { hold: 2, pose: horse(-86) },
    ],
  },
  {
    // Two views: the side shows the hips pushing back and the flat-back hinge;
    // the front the very wide stance, toes forward, hands lowering between the feet.
    id: "wger_1396",
    slug: "standing-pancake",
    title: "Standing Pancake",
    views: ["side", "front"],
    transition: 1.1,
    frames: [pancakeStand(), pancakeHinge(4, -60, 0.3), pancakeHinge(26, -4, 1.6)],
  },
  {
    id: "hf_162",
    slug: "pancake-stretch",
    title: "Pancake Stretch",
    transition: 1.1,
    frames: [
      { hold: 0.6, pose: seatedPancake(4, 36) },
      { hold: 0.2, pose: seatedPancake(30, 100) },
      { hold: 1.6, pose: seatedPancake(58, 160) },
    ],
  },
];
