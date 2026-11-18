import type { DoodleSpec, Keyframe, Point, Pose, Prop, Side } from "./rig";

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

// ---------------------------------------------------------------- carioca quick step (front)

const CARIOCA_Y = -160;

/** Athletic stance seen from the front with the feet at `nearX` / `farX`; `lift` raises that foot mid-step. */
function carioca(nearX: number, farX: number, lift?: Side): Pose {
  const x = round((nearX + farX) / 2);
  const pelvis: Point = [x, CARIOCA_Y + (lift ? -6 : 0)];
  const hips: Record<Side, Point> = { near: [x - 8, pelvis[1]], far: [x + 8, pelvis[1]] };
  const feet: Record<Side, Point> = { near: [nearX, lift === "near" ? -24 : 0], far: [farX, lift === "far" ? -24 : 0] };
  // Arms loose and slightly bent, hands by the hips.
  const shoulderY = pelvis[1] - 98;
  const elbowNear = along([x - 22, shoulderY], 106, 60);
  const elbowFar = along([x + 22, shoulderY], 74, 60);
  return {
    pelvis,
    chest: [x, pelvis[1] - 80],
    hands: { near: along(elbowNear, 78, 66), far: along(elbowFar, 102, 66) },
    elbows: { near: { at: elbowNear }, far: { at: elbowFar } },
    // Knees fold towards the outside of each leg (front view: soft, slightly bent).
    knees: {
      near: { at: joint(hips.near, THIGH, feet.near, SHIN, true) },
      far: { at: joint(hips.far, THIGH, feet.far, SHIN, false) },
    },
    feet,
    toes: { near: 180, far: 0 },
  };
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

// ---------------------------------------------------------------- standing pancake (side)

/** Tall, hands on the front of the thighs. */
function pancakeStand(): Pose {
  return {
    pelvis: [0, -LEG],
    chest: [0, -LEG - 80],
    hands: { near: [12, -156], far: [8, -156] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { at: [0, -LEG + THIGH] }, far: { at: [0, -LEG + THIGH] } },
    feet: { near: [0, 0], far: [0, 0] },
    toes: { near: 0, far: 0 },
  };
}

/** Hips pushed back, flat back at `spineDeg` (0 = level, + head lower), arms hanging to `handY`. */
function pancakeHinge(spineDeg: number, handY: number): Pose {
  // Legs locked, leaning back from the feet as the hips push back.
  const pelvis: Point = [-34, -round(Math.sqrt(LEG * LEG - 34 * 34))];
  const chest = along(pelvis, spineDeg, 80);
  const shoulder = along(pelvis, spineDeg, 98);
  const drop = handY - shoulder[1];
  const reach = Math.min(drop, ARM);
  const hand: Point = [round(shoulder[0] + Math.sqrt(Math.max(0, ARM * ARM - reach * reach)) * 0.4), handY];
  return {
    pelvis,
    chest,
    head: along(shoulder, spineDeg + 8, 38),
    hands: { near: hand, far: [hand[0] - 4, handY] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { at: along(pelvis, angle(pelvis, [0, 0]), THIGH) }, far: { at: along(pelvis, angle(pelvis, [0, 0]), THIGH) } },
    feet: { near: [0, 0], far: [0, 0] },
    toes: { near: 0, far: 0 },
  };
}

// ---------------------------------------------------------------- seated pancake (side + front)

const SEAT: Point = [0, -22];
/** Legs slope gently down from the hip to the heels (degrees below horizontal). */
const PANCAKE_SLOPE = 4;
/** Each leg opens this far from straight ahead, so the legs make a wide V. */
const PANCAKE_SPLAY = 36;
/** Straight leg, hip to ankle. */
const PANCAKE_LEG = 173.9;

/** A point `length` down the straddled leg: side-view position and sideways (z) offset from the body line. */
function pancakeLeg(length: number): { at: Point; z: number } {
  const flat = length * Math.cos((PANCAKE_SLOPE * Math.PI) / 180);
  const splay = (PANCAKE_SPLAY * Math.PI) / 180;
  return {
    at: [round(SEAT[0] + flat * Math.cos(splay)), round(SEAT[1] + length * Math.sin((PANCAKE_SLOPE * Math.PI) / 180))],
    z: round(HIP_Z + flat * Math.sin(splay)),
  };
}
const HIP_Z = 8;
const PANCAKE_KNEE = pancakeLeg(THIGH);
const PANCAKE_FOOT = pancakeLeg(PANCAKE_LEG);
/** Height of the leg line (the floor the legs rest on) at `x`, so the hands sit level with the legs. */
const legLineY = (x: number): number =>
  round(SEAT[1] + ((PANCAKE_FOOT.at[1] - SEAT[1]) * Math.min(x, PANCAKE_FOOT.at[0])) / PANCAKE_FOOT.at[0]);
/** Hands on the floor between the legs, a little wider than the shoulders. */
const PANCAKE_HAND_Z = 30;

/** Seated, legs straight in a wide V with toes up; torso at `lean` (degrees forward of upright), hands on the floor at `handX`. */
function seatedPancake(lean: number, handX: number): Keyframe {
  const spineDeg = -90 + lean;
  const shoulder = along(SEAT, spineDeg, 98);
  const handY = legLineY(handX);
  return {
    hold: 0,
    pose: {
      pelvis: SEAT,
      chest: along(SEAT, spineDeg, 80),
      head: along(shoulder, spineDeg + lean * 0.15, 38),
      hands: { near: [handX, handY], far: [handX - 4, handY] },
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
      knees: { near: { at: PANCAKE_KNEE.at }, far: { at: PANCAKE_KNEE.at } },
      feet: { near: PANCAKE_FOOT.at, far: PANCAKE_FOOT.at },
      toes: { near: -80, far: -80 },
    },
    sideways: {
      hands: { near: -PANCAKE_HAND_Z, far: PANCAKE_HAND_Z },
      knees: { near: { at: -PANCAKE_KNEE.z }, far: { at: PANCAKE_KNEE.z } },
      feet: { near: -PANCAKE_FOOT.z, far: PANCAKE_FOOT.z },
    },
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
    id: "fedb_carioca_quick_step",
    slug: "carioca-quick-step",
    title: "Carioca Quick Step",
    view: "front",
    transition: 0.2,
    frames: [
      // Travelling to the viewer's left: the far foot steps behind, the near foot steps out.
      { hold: 0.04, pose: carioca(10, 62) },
      { hold: 0, pose: carioca(10, 0, "far") },
      { hold: 0.04, pose: carioca(10, -34) },
      { hold: 0.04, pose: carioca(-66, -34) },
      { hold: 0, pose: carioca(-66, -76, "far") },
      { hold: 0.04, pose: carioca(-66, -110) },
      { hold: 0.04, pose: carioca(-150, -110) },
      // And back to the right: the near foot crosses, the far foot steps out.
      { hold: 0, pose: carioca(-104, -110, "near") },
      { hold: 0.04, pose: carioca(-72, -110) },
      { hold: 0.04, pose: carioca(-72, -16) },
      { hold: 0, pose: carioca(-22, -16, "near") },
      { hold: 0.04, pose: carioca(10, -16) },
    ],
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
    id: "wger_1396",
    slug: "standing-pancake",
    title: "Standing Pancake",
    transition: 1.1,
    frames: [
      { hold: 0.5, pose: pancakeStand() },
      { hold: 0.3, pose: pancakeHinge(4, -60) },
      { hold: 1.6, pose: pancakeHinge(26, -4) },
    ],
  },
  {
    id: "hf_162",
    slug: "pancake-stretch",
    title: "Pancake Stretch",
    views: ["side", "front"],
    transition: 1.1,
    frames: [
      { ...seatedPancake(4, 36), hold: 0.6 },
      { ...seatedPancake(30, 96), hold: 0.2 },
      { ...seatedPancake(58, 140), hold: 1.6 },
    ],
  },
];
