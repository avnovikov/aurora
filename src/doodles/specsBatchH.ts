import { solvePose } from "./rig";
import type { DoodleSpec, Point, Pose, Prop } from "./rig";

/**
 * Batch H: lunge, squat, bridge and hip-opener doodles. Floor at y = 0, up is
 * negative, the figure faces +x. Import only from ./rig (./specs imports this).
 */

const round = (value: number): number => Math.round(value * 10) / 10;

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}

/** Shoulder of a straight spine (pelvis → chest is 80, shoulder 18 further). */
const shoulderAt = (pelvis: Point, spine: number): Point => along(pelvis, spine, 98);

type Legs = "near" | "far";
const other = (leg: Legs): Legs => (leg === "near" ? "far" : "near");

/** Hands on the hips, elbows back (as in the reverse lunge). */
function handsOnHips(pelvis: Point): Pick<Pose, "hands" | "elbows"> {
  return {
    hands: { near: [pelvis[0] + 4, pelvis[1] - 16], far: [pelvis[0], pelvis[1] - 16] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
  };
}

/** Feet for two legs, keyed by which leg is which. */
function legs(
  a: Legs,
  footA: Point,
  toeA: number,
  footB: Point,
  toeB: number,
): Pick<Pose, "feet" | "toes"> {
  const b = other(a);
  return {
    feet: { [a]: footA, [b]: footB } as Pose["feet"],
    toes: { [a]: toeA, [b]: toeB } as Pose["toes"],
  };
}

// ---------------------------------------------------------------- lunges

/**
 * Upright split stance with hands on the hips: `front` leg's ankle flat at
 * `frontX`, the back leg on the ball of the foot at `backX` (heel up).
 */
function splitStance(pelvis: Point, front: Legs, frontX: number, backX: number): Pose {
  return {
    pelvis,
    chest: along(pelvis, -88, 80),
    ...handsOnHips(pelvis),
    knees: { [other(front)]: { bend: -1 } },
    ...legs(front, [frontX, 0], 0, [backX, -20], 78),
  };
}

function standTall(pelvis: Point = [0, -172]): Pose {
  return {
    pelvis,
    chest: along(pelvis, -90, 80),
    ...handsOnHips(pelvis),
    feet: { near: [pelvis[0] + 6, 0], far: [pelvis[0], 0] },
    toes: { near: 0, far: 0 },
  };
}

// Forward lunge: the back foot stays where it stood, the near foot steps out and back.
function forwardStep(): Pose {
  const pelvis: Point = [26, -168];
  return {
    pelvis,
    chest: along(pelvis, -89, 80),
    ...handsOnHips(pelvis),
    feet: { near: [86, -34], far: [0, 0] },
    toes: { near: 5, far: 0 },
  };
}

function forwardLand(): Pose {
  const pelvis: Point = [68, -150];
  return {
    pelvis,
    chest: along(pelvis, -88, 80),
    ...handsOnHips(pelvis),
    feet: { near: [142, 0], far: [0, 0] },
    toes: { near: 0, far: 0 },
  };
}

const forwardDown = (): Pose => splitStance([86, -96], "near", 142, 12);

// Walking lunge, drawn on the spot like a walk cycle: the planted foot slides
// back under the hips while the back leg swings through into the next lunge.
const walkLunge = (front: Legs): Pose => splitStance([0, -96], front, 56, -76);

function walkPass(stance: Legs): Pose {
  const pelvis: Point = [0, -166];
  const knee = along(pelvis, 18, 88);
  return {
    pelvis,
    chest: along(pelvis, -88, 80),
    ...handsOnHips(pelvis),
    // The back leg swings through, knee forward and below the hip.
    knees: { [other(stance)]: { at: knee } },
    ...legs(stance, [-6, 0], 0, along(knee, 104, 86), 40),
  };
}

// Reverse lunge to knee drive.
const reverseStep = (): Pose => splitStance([-40, -166], "near", 6, -126);
const reverseDown = (): Pose => splitStance([-50, -96], "near", 6, -126);

function kneeDrive(): Pose {
  const pelvis: Point = [0, -172];
  const knee = along(pelvis, -4, 88);
  return {
    pelvis,
    chest: along(pelvis, -90, 80),
    ...handsOnHips(pelvis),
    knees: { far: { at: knee } },
    feet: { near: [6, 0], far: along(knee, 96, 86) },
    toes: { near: 0, far: 40 },
  };
}

// ---------------------------------------------------------------- squats

/** Squat bottom: hips back and down, chest up; `arms` sets where the hands are. */
function squatBottom(pelvis: Point, spine: number, arms: "forward" | "back"): Pose {
  const s = shoulderAt(pelvis, spine);
  return {
    pelvis,
    chest: along(pelvis, spine, 80),
    hands:
      arms === "forward"
        ? { near: [s[0] + 122, s[1] - 8], far: [s[0] + 118, s[1] - 8] }
        : { near: along(s, 122, 125), far: along(s, 124, 125) },
    feet: { near: [6, 0], far: [0, 0] },
    toes: { near: 0, far: 0 },
  };
}

function jumpAir(): Pose {
  const pelvis: Point = [4, -262];
  const s = shoulderAt(pelvis, -90);
  return {
    pelvis,
    chest: along(pelvis, -90, 80),
    // Arms swung overhead, legs long, toes pointed.
    hands: { near: along(s, -46, 125), far: along(s, -48, 125) },
    feet: { near: [10, -90], far: [4, -90] },
    toes: { near: 68, far: 68 },
  };
}

/** Sumo squat, front view: wide stance, toes out, knees pushed out over the toes, hands at the chest. */
function sumo(pelvisY: number): Pose {
  const pelvis: Point = [0, pelvisY];
  const chest: Point = [0, pelvisY - 80];
  // Shoulders sit 18 up the spine and 22 either side in front view.
  const elbowNear = along([-22, chest[1] - 18], 96, 60);
  const elbowFar = along([22, chest[1] - 18], 84, 60);
  return {
    pelvis,
    chest,
    hands: { near: along(elbowNear, -62, 66), far: along(elbowFar, -118, 66) },
    elbows: { near: { at: elbowNear }, far: { at: elbowFar } },
    knees: { near: { bend: 1 }, far: { bend: -1 } },
    feet: { near: [-104, 0], far: [104, 0] },
    toes: { near: 180, far: 0 },
  };
}

// ---------------------------------------------------------------- wall sit

const WALL: Prop = { kind: "box", x: -88, y: -400, w: 14, h: 400 };
const WALL_PELVIS_X = -50;
const WALL_ANKLE_X = 38;

function wallSit(pelvisY: number, breath: number): Pose {
  const pelvis: Point = [WALL_PELVIS_X, pelvisY];
  return {
    pelvis,
    // Whole back flat on the wall.
    chest: [WALL_PELVIS_X - breath, pelvisY - 80],
    head: [WALL_PELVIS_X - breath, pelvisY - 136],
    // Hands resting on the thighs.
    hands: { near: [WALL_ANKLE_X - 10, pelvisY - 8], far: [WALL_ANKLE_X - 14, pelvisY - 8] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: [WALL_ANKLE_X + 4, 0], far: [WALL_ANKLE_X, 0] },
    toes: { near: 0, far: 0 },
  };
}

// ---------------------------------------------------------------- sissy squat

/** On the balls of the feet, heels high. */
const SISSY_ANKLE: Point = [-2, -18];

/** Knees forward, straight line knee → hip → shoulder leaning back; `shin` is the shin angle. */
function sissy(shin: number, line: number): Pose {
  const knee = along(SISSY_ANKLE, shin, 86);
  const pelvis = along(knee, line, 88);
  const s = shoulderAt(pelvis, line);
  return {
    pelvis,
    chest: along(pelvis, line, 80),
    // Arms reach forward for balance.
    hands: { near: along(s, 4, 125), far: along(s, 6, 125) },
    knees: { near: { at: knee }, far: { at: knee } },
    feet: { near: SISSY_ANKLE, far: SISSY_ANKLE },
    toes: { near: 62, far: 62 },
  };
}

// ---------------------------------------------------------------- lying on the back

const SUPINE_CHORD = 77;

/** Lying on the back: upper back and head on the floor, arms long by the sides, hips at `pelvis`. */
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

/** Single-leg bridge: near foot planted, far knee drawn up over the chest. */
function singleBridge(pelvis: Point): Pose {
  // Thigh pulled in past vertical, shin level: the knee drawn toward the chest.
  const knee = along(pelvis, -104, 88);
  return {
    ...lyingFaceUp(pelvis),
    knees: { far: { at: knee } },
    feet: { near: [74, 0], far: along(knee, 12, 86) },
    toes: { near: 0, far: -20 },
  };
}

// ---------------------------------------------------------------- kneeling hip openers

const LOW_LUNGE_KNEE: Point = [-30, -3];

/** Low lunge: near (back) knee and shin on the floor, far foot forward, near arm reaching overhead. */
function lowLunge(pelvisX: number, reach: number): Pose {
  const pelvis: Point = [pelvisX, -(round(Math.sqrt(88 * 88 - (pelvisX - LOW_LUNGE_KNEE[0]) ** 2)) + 3)];
  const spine = -92;
  const s = shoulderAt(pelvis, spine);
  return {
    pelvis,
    chest: along(pelvis, spine, 80),
    hands: { near: along(s, reach, 125), far: [pelvis[0] + 80, pelvis[1] - 6] },
    elbows: { far: { bend: 1 } },
    knees: { near: { at: LOW_LUNGE_KNEE }, far: { bend: -1 } },
    feet: { near: [-116, -3], far: [pelvis[0] + 90, 0] },
    toes: { near: 180, far: 0 },
  };
}

/**
 * Lizard: deep lunge with the near (back) knee and shin down, the far (front)
 * foot planted ahead, hands or forearms on the floor inside the front foot.
 * `pelvisY` sinks the hips.
 */
function lizard(forearms: boolean, pelvisY: number): Pose {
  const pelvis: Point = [0, pelvisY];
  const backKnee: Point = [round(-Math.sqrt(88 * 88 - (pelvisY + 3) ** 2)), -3];
  const lower = {
    knees: { near: { at: backKnee }, far: { bend: -1 as const } },
    feet: { near: [backKnee[0] - 86, -3] as Point, far: [96, 0] as Point },
    toes: { near: 180, far: 0 },
  };
  if (!forearms) {
    const spine = -30;
    const s = shoulderAt(pelvis, spine);
    return {
      pelvis,
      chest: along(pelvis, spine, 80),
      hands: { near: [s[0] + 40, -2], far: [s[0] + 36, -2] },
      ...lower,
    };
  }
  // Spine angle that keeps the shoulder one upper arm above the floor.
  const spine = round((Math.asin((-65 - pelvisY) / 98) * 180) / Math.PI);
  const s = shoulderAt(pelvis, spine);
  const elbow = along(s, 92, 60);
  const farElbow: Point = [elbow[0] - 3, elbow[1]];
  return {
    pelvis,
    chest: along(pelvis, spine, 80),
    hands: { near: along(elbow, -1, 66), far: along(farElbow, -1, 66) },
    elbows: { near: { at: elbow }, far: { at: farElbow } },
    ...lower,
  };
}

export const BATCH_H_SPECS: DoodleSpec[] = [
  {
    id: "fedb_bodyweight_walking_lunge",
    slug: "bodyweight-walking-lunge",
    title: "Bodyweight Walking Lunge",
    transition: 0.6,
    frames: [
      { hold: 0.35, pose: walkLunge("near") },
      { hold: 0, pose: walkPass("near") },
      { hold: 0.35, pose: walkLunge("far") },
      { hold: 0, pose: walkPass("far") },
    ],
  },
  {
    id: "hf_79",
    slug: "forward-lunge",
    title: "Forward Lunge",
    transition: 0.5,
    frames: [
      { hold: 0.4, pose: standTall() },
      { hold: 0, pose: forwardStep() },
      { hold: 0, pose: forwardLand() },
      { hold: 0.5, pose: forwardDown() },
      { hold: 0, pose: forwardLand() },
      { hold: 0, pose: forwardStep() },
    ],
  },
  {
    id: "ntc_reverse_lunge_knee_drive",
    slug: "reverse-lunge-to-knee-drive",
    title: "Reverse lunge to knee drive",
    transition: 0.55,
    frames: [
      { hold: 0.6, pose: kneeDrive() },
      { hold: 0, pose: reverseStep() },
      { hold: 0.4, pose: reverseDown() },
      { hold: 0, pose: reverseStep() },
    ],
  },
  {
    id: "hf_94",
    slug: "jump-squat",
    title: "Jump Squat",
    props: [{ kind: "floor" }],
    transition: 0.4,
    frames: [
      { hold: 0.35, pose: squatBottom([-54, -92], -60, "back") },
      { hold: 0.1, pose: jumpAir() },
      { hold: 0.15, pose: squatBottom([-40, -112], -66, "forward") },
    ],
  },
  {
    id: "ntc_sumo_squat",
    slug: "sumo-squat",
    title: "Sumo squat",
    view: "front",
    transition: 1.1,
    frames: [
      { hold: 0.5, pose: sumo(-144) },
      { hold: 0.4, pose: sumo(-84) },
    ],
  },
  {
    id: "ntc_squat_pulse",
    slug: "squat-pulses",
    title: "Squat pulses",
    transition: 0.35,
    frames: [
      { hold: 0.05, pose: squatBottom([-54, -84], -62, "forward") },
      { hold: 0.05, pose: squatBottom([-46, -110], -66, "forward") },
    ],
  },
  {
    id: "hf_78",
    slug: "wall-sit",
    title: "Wall Sit",
    props: [WALL],
    transition: 1.2,
    frames: [
      { hold: 0.4, pose: { ...wallSit(-144, 0), feet: { near: [WALL_ANKLE_X + 4, 0], far: [WALL_ANKLE_X, 0] } } },
      { hold: 1.2, pose: wallSit(-88, 0) },
      { hold: 1.2, pose: wallSit(-88, 2) },
    ],
  },
  {
    id: "hf_73",
    slug: "sissy-squat",
    title: "Sissy Squat",
    props: [{ kind: "floor" }],
    transition: 1.2,
    frames: [
      { hold: 0.4, pose: sissy(-78, -96) },
      { hold: 0.4, pose: sissy(-20, -126) },
    ],
  },
  {
    id: "fedb_single_leg_glute_bridge",
    slug: "single-leg-glute-bridge",
    title: "Single Leg Glute Bridge",
    transition: 1,
    frames: [
      { hold: 0.4, pose: singleBridge([-12, -24]) },
      { hold: 0.6, pose: singleBridge([-12, -74]) },
    ],
  },
  {
    id: "ntc_low_lunge",
    slug: "low-lunge",
    title: "Low lunge stretch",
    transition: 1.5,
    frames: [
      { hold: 0.5, pose: lowLunge(-24, -62) },
      { hold: 1.2, pose: lowLunge(10, -64) },
      { hold: 1.2, pose: lowLunge(4, -62) },
    ],
  },
  {
    id: "ntc_lizard",
    slug: "lizard",
    title: "Lizard stretch",
    transition: 1.5,
    frames: [
      { hold: 0.6, pose: lizard(false, -70) },
      { hold: 1.2, pose: lizard(true, -62) },
      { hold: 1.2, pose: lizard(true, -56) },
    ],
  },
];
