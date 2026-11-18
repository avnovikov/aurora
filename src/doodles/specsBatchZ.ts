import { solvePose } from "./rig";
import type { DoodleSpec, Point, Pose, Prop } from "./rig";

/**
 * Batch Z: flexibility and mobility (frog, couch, front split, Jefferson
 * curl, pigeon, middle split, wall ankle dorsiflexion) and the Hindu squat.
 * Floor at y = 0, up is negative, the side-view figure faces +x. Import only
 * from ./rig — never from ./specs (that would be circular).
 */

const round = (value: number): number => Math.round(value * 10) / 10;

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}

/** Near-side shoulder of a solved pose. */
const shoulderOf = (pose: Pose, view?: "side" | "front"): Point => solvePose(pose, { view }).arms.near.root;

/** Straight-arm reach from shoulder to fingertip (a hair short of locked). */
const REACH = 125.4;
/** Hip to ankle with the knee straight (a hair short of locked). */
const LEG = 173.6;

// ---------------------------------------------------------------- Jefferson curl (side view, on a step)

const STEP_TOP = -40;
const STEP: Prop = { kind: "box", x: -60, y: STEP_TOP, w: 84, h: 40 };
const CURL_ANKLE: Point = [0, STEP_TOP];

/**
 * Standing on a step, legs straight, rolling the spine down from the top:
 * `a` holds the directions (degrees) of pelvis→waist, waist→chest,
 * chest→neck and neck→head; the arms hang straight down from the shoulders.
 */
function curl(a: [number, number, number, number], hipBack: number, hang = 90): Pose {
  const pelvis: Point = [-hipBack, round(STEP_TOP - Math.sqrt(LEG ** 2 - hipBack ** 2))];
  const waist = along(pelvis, a[0], 40);
  const chest = along(waist, a[1], 40);
  const neck = along(chest, a[2], 20);
  const head = along(neck, a[3], 36);
  const base: Pose = {
    pelvis,
    chest,
    head,
    feet: { near: CURL_ANKLE, far: [CURL_ANKLE[0] - 3, STEP_TOP] },
    toes: { near: 0, far: 0 },
  };
  const shoulder = shoulderOf(base);
  return {
    ...base,
    hands: { near: along(shoulder, hang, REACH), far: along(shoulder, hang + 1, REACH) },
  };
}

// ---------------------------------------------------------------- wall ankle dorsiflexion (side view)

const ANKLE_WALL_X = 150;
const ANKLE_WALL: Prop = { kind: "box", x: ANKLE_WALL_X, y: -340, w: 14, h: 340 };
/** Front foot: toes a hand's width from the wall. */
const DF_ANKLE: Point = [ANKLE_WALL_X - 52, 0];

/** Staggered stance facing the wall, hands on it; the front shin tips `shin` degrees forward of vertical, heel down. */
function dorsiflex(shin: number): Pose {
  const knee = along(DF_ANKLE, -90 + shin, 86);
  // Hips sit back of the knee, the thigh angled a little forward.
  const pelvis = along(knee, -122, 88);
  return {
    pelvis,
    chest: along(pelvis, -88, 80),
    hands: { near: [ANKLE_WALL_X - 3, -232], far: [ANKLE_WALL_X - 3, -226] },
    knees: { near: { at: knee } },
    feet: { near: DF_ANKLE, far: [10, 0] },
    toes: { near: 0, far: 0 },
  };
}

// ---------------------------------------------------------------- couch stretch (side view)

const COUCH_WALL_X = -140;
const COUCH_WALL: Prop = { kind: "box", x: COUCH_WALL_X - 14, y: -340, w: 14, h: 340 };
/** Back knee on the floor against the wall, back shin straight up it. */
const COUCH_KNEE: Point = [COUCH_WALL_X + 9, -3];
const COUCH_ANKLE: Point = [COUCH_WALL_X + 9, -89];

/**
 * Near (back) knee on the floor at the wall with the shin straight up it; far
 * (front) foot flat in a lunge, hands on the front knee. `hip` is the back
 * thigh's angle (degrees from the knee to the hip), `lean` the torso's angle
 * forward of vertical.
 */
function couch(hip: number, lean: number): Pose {
  const pelvis = along(COUCH_KNEE, hip, 88);
  const frontAnkle: Point = [round(pelvis[0] + 92), 0];
  const base: Pose = {
    pelvis,
    chest: along(pelvis, -90 + lean, 80),
    knees: { near: { at: COUCH_KNEE }, far: { bend: -1 } },
    feet: { near: COUCH_ANKLE, far: frontAnkle },
    toes: { near: -90, far: 0 },
  };
  const knee = solvePose(base).legs.far.mid;
  return {
    ...base,
    hands: { near: [knee[0] - 4, knee[1] - 6], far: [knee[0] - 8, knee[1] - 7] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
  };
}

// ---------------------------------------------------------------- front split (side view)

/**
 * Legs straight front and back from a pelvis at height `y`; hands on the floor
 * at `handX`, the spine leaning just enough for the arms to reach them.
 */
function frontSplit(y: number, handX: number): Pose {
  const pelvis: Point = [0, y];
  const dy = -6 - y;
  const dx = round(Math.sqrt(LEG ** 2 - dy ** 2));
  return {
    pelvis,
    hands: { near: [handX, 0], far: [handX - 4, 0] },
    feet: { near: [dx, -6], far: [-dx, -5] },
    // Front toes point up, the back foot lies on its laces.
    toes: { near: -80, far: 180 },
  };
}

/** Kneeling start: back knee down, front leg reaching straight out with the heel on the floor. */
function splitStart(): Pose {
  const pelvis: Point = [-10, -80];
  const backKnee = along(pelvis, 180 - Math.asin(77 / 88) * (180 / Math.PI), 88);
  return {
    pelvis,
    hands: { near: [56, 0], far: [52, 0] },
    knees: { far: { at: backKnee } },
    feet: { near: [round(pelvis[0] + Math.sqrt(LEG ** 2 - 74 ** 2)), -6], far: [round(backKnee[0] - 86), -4] },
    toes: { near: -80, far: 180 },
  };
}

// ---------------------------------------------------------------- pigeon (side view)

/** All fours: hands under the shoulders, knees under the hips. */
function pigeonAllFours(): Pose {
  return {
    pelvis: [-50, -92],
    hands: { near: [48, 0], far: [44, 0] },
    feet: { near: [-136, -4], far: [-132, -4] },
    toes: { near: 180, far: 180 },
  };
}

/** Near knee drawn up towards the near wrist, foot lifted, on the way into the pose. */
function pigeonKneeIn(): Pose {
  const pelvis: Point = [-40, -94];
  const knee = along(pelvis, 30, 88);
  return {
    pelvis,
    hands: { near: [48, 0], far: [44, 0] },
    knees: { near: { at: knee } },
    feet: { near: along(knee, 170, 86), far: [-132, -4] },
    toes: { near: 180, far: 180 },
  };
}

/**
 * Pigeon: near (front) knee forward behind the near wrist, the shin folded
 * back across under the body; the far (back) leg long behind, on its laces.
 * `y` is the pelvis height.
 */
function pigeon(y: number, handsX: number): Pose {
  const pelvis: Point = [-6, y];
  const kneeY = -6;
  const knee: Point = [round(pelvis[0] + Math.sqrt(88 ** 2 - (kneeY - y) ** 2)), kneeY];
  const backDy = -5 - y;
  return {
    pelvis,
    hands: { near: [handsX, 0], far: [handsX - 4, 0] },
    knees: { near: { at: knee } },
    feet: { near: [round(knee[0] - 86), -6], far: [round(pelvis[0] - Math.sqrt(LEG ** 2 - backDy ** 2)), -5] },
    toes: { near: 180, far: 180 },
  };
}

// ---------------------------------------------------------------- Hindu squat (side view)

/**
 * `pelvis`, the torso's lean forward of vertical, the ankle lift (heels up)
 * with the toe angle, and the straight arms' angle from the shoulder (0 =
 * forward, 90 = down, more = back).
 */
function hinduSquat(pelvis: Point, lean: number, heel: number, toe: number, arm: number): Pose {
  const base: Pose = {
    pelvis,
    chest: along(pelvis, -90 + lean, 80),
    feet: { near: [0, -heel], far: [-4, -heel] },
    toes: { near: toe, far: toe },
  };
  const shoulder = shoulderOf(base);
  return { ...base, hands: { near: along(shoulder, arm, REACH), far: along(shoulder, arm + 2, REACH) } };
}

// ---------------------------------------------------------------- middle split (front view)

/** Hip offset from the pelvis in front view. */
const HIP_SIDE = 8;

/** Feet slid wide to the sides, legs straight, toes up; the pelvis at height `y`. Hands on the thighs, or on the floor when low. */
function middleSplit(y: number): Pose {
  const pelvis: Point = [0, y];
  const dy = -8 - y;
  const dx = round(HIP_SIDE + Math.sqrt(LEG ** 2 - dy ** 2));
  const base: Pose = {
    pelvis,
    chest: [0, y - 80],
    feet: { near: [-dx, -8], far: [dx, -8] },
    toes: { near: -90, far: -90 },
  };
  const shoulder = shoulderOf(base, "front");
  const drop = -shoulder[1];
  if (drop < REACH - 2) {
    // Straight arms down to the floor, just outside the shoulders.
    const out = round(Math.sqrt(REACH ** 2 - drop ** 2));
    return { ...base, hands: { near: [round(shoulder[0] - out), 0], far: [round(-shoulder[0] + out), 0] } };
  }
  // Hands on the hips, elbows out to the sides.
  return {
    ...base,
    hands: { near: [-26, y - 22], far: [26, y - 22] },
    elbows: { near: { bend: 1 }, far: { bend: -1 } },
  };
}

// ---------------------------------------------------------------- frog (seen from above)

/**
 * Face down, seen from above (front view laid flat, head right): knees wide
 * out to the sides, shins parallel pointing back, feet turned out; arms long
 * on the floor in front. `back` rocks the hips back between the knees.
 */
const FROG_KNEE_X = -40;
const FROG_HANDS: { near: Point; far: Point } = { near: [140, -200], far: [140, -100] };

function frog(back: number): Pose {
  const pelvis: Point = [FROG_KNEE_X - back, -150];
  const hipNear: Point = [pelvis[0], -150 - HIP_SIDE];
  const hipFar: Point = [pelvis[0], -150 + HIP_SIDE];
  const kneeDy = Math.sqrt(88 ** 2 - back ** 2);
  const kneeNear: Point = [FROG_KNEE_X, round(hipNear[1] - kneeDy)];
  const kneeFar: Point = [FROG_KNEE_X, round(hipFar[1] + kneeDy)];
  return {
    pelvis,
    chest: [pelvis[0] + 80, -150],
    head: [pelvis[0] + 136, -150],
    hands: FROG_HANDS,
    elbows: { near: { bend: -1 }, far: { bend: 1 } },
    knees: { near: { at: kneeNear }, far: { at: kneeFar } },
    feet: { near: [FROG_KNEE_X - 86, kneeNear[1]], far: [FROG_KNEE_X - 86, kneeFar[1]] },
    toes: { near: -90, far: 90 },
  };
}

export const BATCH_Z_SPECS: DoodleSpec[] = [
  {
    id: "hf_156",
    slug: "jefferson-curl",
    title: "Jefferson Curl",
    props: [STEP],
    transition: 1.1,
    frames: [
      { hold: 0.5, pose: curl([-90, -90, -90, -90], 0) },
      { hold: 0.1, pose: curl([-90, -90, -70, -30], 2) },
      { hold: 0.1, pose: curl([-90, -64, -32, 6], 6) },
      { hold: 0.1, pose: curl([-56, -24, 8, 50], 14, 104) },
      { hold: 0, pose: curl([-24, 8, 40, 76], 20, 110) },
      { hold: 1, pose: curl([14, 47, 80, 60], 26, 108) },
      { hold: 0, pose: curl([-24, 8, 40, 76], 20, 110) },
      { hold: 0.1, pose: curl([-56, -24, 8, 50], 14, 104) },
      { hold: 0.1, pose: curl([-90, -64, -32, 6], 6) },
    ],
  },
  {
    id: "hf_166",
    slug: "wall-ankle-dorsiflexion",
    title: "Wall Ankle Dorsiflexion",
    props: [ANKLE_WALL],
    transition: 0.9,
    frames: [
      { hold: 0.5, pose: dorsiflex(6) },
      { hold: 0.6, pose: dorsiflex(34) },
    ],
  },
  {
    id: "hf_161",
    slug: "couch-stretch",
    title: "Couch Stretch",
    props: [COUCH_WALL],
    transition: 1.4,
    frames: [
      { hold: 0.5, pose: couch(-58, 34) },
      { hold: 0.6, pose: couch(-62, 2) },
      { hold: 1.2, pose: couch(-69, -2) },
    ],
  },
  {
    id: "hf_163",
    slug: "front-split",
    title: "Front Split",
    transition: 1.5,
    frames: [
      { hold: 0.5, pose: splitStart() },
      { hold: 0.5, pose: frontSplit(-50, 40) },
      { hold: 1.4, pose: frontSplit(-22, 28) },
    ],
  },
  {
    id: "hf_159",
    slug: "pigeon-pose",
    title: "Pigeon Pose",
    transition: 1.1,
    frames: [
      { hold: 0.4, pose: pigeonAllFours() },
      { hold: 0, pose: pigeonKneeIn() },
      { hold: 0.4, pose: pigeon(-52, 60) },
      { hold: 1.4, pose: pigeon(-40, 48) },
    ],
  },
  {
    id: "hf_77",
    slug: "hindu-squat",
    title: "Hindu Squat",
    transition: 0.55,
    frames: [
      { hold: 0.2, pose: hinduSquat([0, -172], 2, 0, 0, 0) },
      { hold: 0, pose: hinduSquat([-22, -128], 12, 12, 40, 90) },
      { hold: 0.2, pose: hinduSquat([-34, -58], 14, 22, 62, 140) },
      { hold: 0, pose: hinduSquat([-20, -126], 12, 12, 40, 50) },
    ],
  },
  {
    id: "hf_164",
    slug: "middle-split",
    title: "Middle Split",
    view: "front",
    transition: 0.45,
    frames: [
      { hold: 0.5, pose: middleSplit(-120) },
      { hold: 0, pose: middleSplit(-95) },
      { hold: 0, pose: middleSplit(-70) },
      { hold: 0, pose: middleSplit(-46) },
      { hold: 1.4, pose: middleSplit(-24) },
      { hold: 0, pose: middleSplit(-46) },
      { hold: 0, pose: middleSplit(-70) },
      { hold: 0, pose: middleSplit(-95) },
    ],
  },
  {
    id: "hf_160",
    slug: "frog-stretch",
    title: "Frog Stretch",
    view: "front",
    transition: 1.3,
    frames: [
      { hold: 0.6, pose: frog(0) },
      { hold: 0.8, pose: frog(40) },
    ],
  },
];
