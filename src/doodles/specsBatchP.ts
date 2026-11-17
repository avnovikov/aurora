import type { DoodleSpec, Point, Pose, Prop } from "./rig";

/**
 * Batch P: standing leg moves (lunges, lateral lunges, step-up, hip abduction).
 * Floor at y = 0, up is negative, the side-view figure faces +x. Front views
 * put the near side at -x and the far side at +x (shoulders ±22, hips ±8).
 * Import only from ./rig (./specs imports this).
 */

const round = (value: number): number => Math.round(value * 10) / 10;

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}

const angle = (from: Point, to: Point): number => (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;

/** Shoulder of a straight spine (pelvis → chest is 80, shoulder 18 further). */
const shoulderAt = (pelvis: Point, spine: number): Point => along(pelvis, spine, 98);

type Legs = "near" | "far";
const other = (leg: Legs): Legs => (leg === "near" ? "far" : "near");

/** Side view: hands on the hips, elbows back. */
function handsOnHips(pelvis: Point): Pick<Pose, "hands" | "elbows"> {
  return {
    hands: { near: [pelvis[0] + 4, pelvis[1] - 16], far: [pelvis[0], pelvis[1] - 16] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
  };
}

/** Feet for two legs, keyed by which leg is which. */
function legs(a: Legs, footA: Point, toeA: number, footB: Point, toeB: number): Pick<Pose, "feet" | "toes"> {
  const b = other(a);
  return {
    feet: { [a]: footA, [b]: footB } as Pose["feet"],
    toes: { [a]: toeA, [b]: toeB } as Pose["toes"],
  };
}

// ---------------------------------------------------------------- front-view arms

/** Front view, upright torso: elbows down and out, hands clasped in front of the chest. */
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

/** Front view, upright torso: hands on the hips, elbows pointing out. */
function frontHandsOnHips(pelvis: Point): Pick<Pose, "hands" | "elbows"> {
  const shoulderY = pelvis[1] - 98;
  const elbowNear = along([pelvis[0] - 22, shoulderY], 128, 60);
  const elbowFar = along([pelvis[0] + 22, shoulderY], 52, 60);
  const handNear: Point = [pelvis[0] - 18, pelvis[1] - 12];
  const handFar: Point = [pelvis[0] + 18, pelvis[1] - 12];
  return {
    hands: { near: along(elbowNear, angle(elbowNear, handNear), 66), far: along(elbowFar, angle(elbowFar, handFar), 66) },
    elbows: { near: { at: elbowNear }, far: { at: elbowFar } },
  };
}

// ---------------------------------------------------------------- forward lunge (bodyweight lunge)

function standTall(pelvis: Point = [0, -172]): Pose {
  return {
    pelvis,
    chest: along(pelvis, -90, 80),
    ...handsOnHips(pelvis),
    feet: { near: [pelvis[0] + 6, 0], far: [pelvis[0], 0] },
    toes: { near: 0, far: 0 },
  };
}

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

const forwardDown = (): Pose => splitStance([76, -96], "near", 142, 12);

// ---------------------------------------------------------------- step-up with knee drive

const STEP_BOX: Prop = { kind: "box", x: 40, y: -72, w: 150, h: 72 };

/** Arms hanging by the sides from a straight spine. */
function hangingHands(pelvis: Point, spine: number): { near: Point; far: Point } {
  const s = shoulderAt(pelvis, spine);
  return { near: [s[0] + 6, s[1] + 124], far: [s[0] + 2, s[1] + 124] };
}

function stepStart(): Pose {
  const pelvis: Point = [-6, -164];
  return {
    pelvis,
    chest: along(pelvis, -80, 80),
    hands: hangingHands(pelvis, -80),
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: [62, -73], far: [-34, 0] },
    toes: { near: 0, far: 0 },
  };
}

function stepRise(): Pose {
  const pelvis: Point = [44, -226];
  return {
    pelvis,
    chest: along(pelvis, -84, 80),
    hands: hangingHands(pelvis, -84),
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { far: { bend: -1 } },
    feet: { near: [62, -73], far: [8, -100] },
    toes: { near: 0, far: 20 },
  };
}

/** Tall on the box, the far knee driven to hip height, the near (opposite) arm swung forward. */
function stepKneeDrive(): Pose {
  const pelvis: Point = [60, -245];
  const s = shoulderAt(pelvis, -90);
  const knee = along(pelvis, -4, 88);
  const elbowNear = along(s, 62, 60);
  const elbowFar = along(s, 120, 60);
  return {
    pelvis,
    chest: along(pelvis, -90, 80),
    hands: { near: along(elbowNear, -40, 66), far: along(elbowFar, 80, 66) },
    elbows: { near: { at: elbowNear }, far: { at: elbowFar } },
    knees: { far: { at: knee } },
    feet: { near: [62, -73], far: along(knee, 96, 86) },
    toes: { near: 0, far: 30 },
  };
}

// ---------------------------------------------------------------- prisoner squat (front view)

/**
 * Front view so the elbows read wide: fingers at the back of the head (hands
 * just touching its sides), elbows out level with the ears. Feet a little wider
 * than the hips, knees pushed out over the toes as the hips drop.
 */
function prisonerSquat(pelvisY: number): Pose {
  const pelvis: Point = [0, pelvisY];
  const shoulderY = pelvisY - 98;
  const headY = pelvisY - 136;
  const elbowNear = along([-22, shoulderY], -158, 60);
  const elbowFar = along([22, shoulderY], -22, 60);
  return {
    pelvis,
    chest: [0, pelvisY - 80],
    // Wrists at the sides of the head, hands turned in behind it.
    hands: {
      near: along(elbowNear, angle(elbowNear, [-26, headY - 10]), 58),
      far: along(elbowFar, angle(elbowFar, [26, headY - 10]), 58),
    },
    wrists: { near: -10, far: -170 },
    elbows: { near: { at: elbowNear }, far: { at: elbowFar } },
    knees: { near: { bend: 1 }, far: { bend: -1 } },
    feet: { near: [-36, 0], far: [36, 0] },
    toes: { near: 180, far: 0 },
  };
}

// ---------------------------------------------------------------- arabesque (single-leg hinge)

function arabesque(hinge: boolean): Pose {
  const pelvis: Point = hinge ? [-4, -168] : [0, -172];
  const spine = hinge ? -10 : -90;
  return {
    pelvis,
    chest: along(pelvis, spine, 80),
    ...handsOnHips(pelvis),
    ...(hinge ? { knees: { far: { at: along(pelvis, 170, 88) } } } : {}),
    // Free leg straight back, in line with the torso at the bottom.
    feet: { near: [0, 0], far: hinge ? along(pelvis, 170, 174) : [-10, -30] },
    toes: { near: 0, far: hinge ? 95 : 60 },
  };
}

// ---------------------------------------------------------------- lateral lunge (front view)

/** The planted (far) foot for the lateral lunge; the near foot steps out to -x. */
const LATERAL_FAR: Point = [44, 0];

function lateralStand(): Pose {
  const pelvis: Point = [30, -172];
  return {
    pelvis,
    chest: [pelvis[0], pelvis[1] - 80],
    ...chestHands(pelvis),
    knees: { near: { bend: 1 }, far: { bend: -1 } },
    feet: { near: [16, 0], far: LATERAL_FAR },
    toes: { near: 180, far: 0 },
  };
}

function lateralStep(): Pose {
  const pelvis: Point = [-6, -168];
  return {
    pelvis,
    chest: [pelvis[0], pelvis[1] - 80],
    ...chestHands(pelvis),
    knees: { near: { bend: 1 }, far: { bend: -1 } },
    feet: { near: [-70, -26], far: LATERAL_FAR },
    toes: { near: 160, far: 0 },
  };
}

/** Sat into the near leg; the far leg long and straight. */
function lateralDown(): Pose {
  const pelvis: Point = [-84, -104];
  return {
    pelvis,
    chest: [pelvis[0], pelvis[1] - 80],
    ...chestHands(pelvis),
    knees: { near: { bend: 1 }, far: { bend: -1 } },
    feet: { near: [-150, 0], far: LATERAL_FAR },
    toes: { near: 180, far: 0 },
  };
}

// ---------------------------------------------------------------- side split squat (front view)

/** Wide stance; `shift` -1 sits into the near leg, 1 into the far leg, 0 is centred. */
function sideSplit(shift: -1 | 0 | 1): Pose {
  const pelvis: Point = shift === 0 ? [0, -128] : [shift * 38, -94];
  return {
    pelvis,
    chest: [pelvis[0], pelvis[1] - 80],
    ...chestHands(pelvis),
    knees: { near: { bend: 1 }, far: { bend: -1 } },
    feet: { near: [-112, 0], far: [112, 0] },
    toes: { near: 180, far: 0 },
  };
}

// ---------------------------------------------------------------- standing abduction (front view)

/** Standing on the far leg; the near leg lifts straight out to the side by `lift` degrees. */
function abduction(lift: number): Pose {
  const pelvis: Point = [6, -172];
  const hip: Point = [pelvis[0] - 8, pelvis[1]];
  const legAngle = 90 + lift;
  return {
    pelvis,
    chest: [pelvis[0], pelvis[1] - 80],
    ...frontHandsOnHips(pelvis),
    knees: { near: { at: along(hip, legAngle, 88) }, far: { bend: -1 } },
    feet: { near: along(hip, legAngle, 174), far: [16, 0] },
    toes: { near: legAngle + 90, far: 0 },
  };
}

// ---------------------------------------------------------------- lateral walk (front view)

const WALK_Y = -156;

/** Half squat, hands on the hips, feet at `nearX` / `farX`; `lift` raises the stepping foot. */
function lateralWalk(nearX: number, farX: number, lift?: Legs): Pose {
  const x = (nearX + farX) / 2;
  const pelvis: Point = [x, WALK_Y - (lift ? 4 : 0)];
  return {
    pelvis,
    chest: [x, pelvis[1] - 80],
    ...frontHandsOnHips(pelvis),
    knees: { near: { bend: 1 }, far: { bend: -1 } },
    feet: { near: [nearX, lift === "near" ? -30 : 0], far: [farX, lift === "far" ? -30 : 0] },
    toes: { near: 180, far: 0 },
  };
}

// ---------------------------------------------------------------- curtsy lunge (front view)

/** Knee between `hip` and `ankle` (thigh 88, shin 86), on the -x side of the line between them. */
function outerKnee(hip: Point, ankle: Point): Point {
  const d = Math.hypot(ankle[0] - hip[0], ankle[1] - hip[1]);
  const a = (88 * 88 - 86 * 86 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, 88 * 88 - a * a));
  const ux = (ankle[0] - hip[0]) / d;
  const uy = (ankle[1] - hip[1]) / d;
  const mid: Point = [hip[0] + ux * a, hip[1] + uy * a];
  const k1: Point = [round(mid[0] - uy * h), round(mid[1] + ux * h)];
  const k2: Point = [round(mid[0] + uy * h), round(mid[1] - ux * h)];
  return k1[0] < k2[0] ? k1 : k2;
}

function curtsyStand(): Pose {
  const pelvis: Point = [-14, -172];
  return {
    pelvis,
    chest: [pelvis[0], pelvis[1] - 80],
    ...frontHandsOnHips(pelvis),
    knees: { near: { bend: 1 }, far: { bend: -1 } },
    feet: { near: [-36, 0], far: [8, 0] },
    toes: { near: 180, far: 0 },
  };
}

/**
 * The far foot crosses behind the near foot onto its ball; `depth` 1 is the
 * bottom, with the back knee dropped low behind the front shin.
 */
function curtsy(depth: 0 | 1): Pose {
  const pelvis: Point = depth ? [-2, -126] : [-8, -162];
  const hip: Point = [pelvis[0] + 8, pelvis[1]];
  const backKnee = along(hip, angle(hip, depth ? [-8, -38] : [-22, -76]), 88);
  // Front knee bends out over the little-toe side of the front foot (front-view convention).
  const front: Point = [-36, 0];
  const frontKnee = outerKnee([pelvis[0] - 8, pelvis[1]], front);
  return {
    pelvis,
    chest: [pelvis[0], pelvis[1] - 80],
    ...frontHandsOnHips(pelvis),
    knees: { near: { at: frontKnee }, far: { at: backKnee } },
    feet: { near: front, far: along(backKnee, depth ? 172 : 150, 86) },
    toes: { near: 180, far: depth ? 100 : 110 },
  };
}

export const BATCH_P_SPECS: DoodleSpec[] = [
  {
    id: "hf_81",
    slug: "curtsy-lunge",
    title: "Curtsy Lunge",
    view: "front",
    transition: 0.7,
    frames: [
      { hold: 0.4, pose: curtsyStand() },
      { hold: 0, pose: curtsy(0) },
      { hold: 0.5, pose: curtsy(1) },
      { hold: 0, pose: curtsy(0) },
    ],
  },
  {
    id: "hf_82",
    slug: "lateral-lunge",
    title: "Lateral Lunge",
    view: "front",
    transition: 0.6,
    frames: [
      { hold: 0.4, pose: lateralStand() },
      { hold: 0, pose: lateralStep() },
      { hold: 0.5, pose: lateralDown() },
      { hold: 0, pose: lateralStep() },
    ],
  },
  {
    id: "hf_90",
    slug: "step-up-with-knee-drive",
    title: "Step-Up with Knee Drive",
    props: [STEP_BOX],
    transition: 0.55,
    frames: [
      { hold: 0.4, pose: stepStart() },
      { hold: 0, pose: stepRise() },
      { hold: 0.5, pose: stepKneeDrive() },
      { hold: 0, pose: stepRise() },
    ],
  },
  {
    id: "wger_1324",
    slug: "bodyweight-lunge",
    title: "Bodyweight lunge",
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
    id: "wger_1907",
    slug: "unilateral-lunges",
    title: "Unilateral Lunges",
    transition: 0.9,
    frames: [
      { hold: 0.1, pose: splitStance([0, -150], "near", 62, -80) },
      { hold: 0.1, pose: splitStance([0, -96], "near", 62, -80) },
    ],
  },
  {
    id: "wger_986",
    slug: "side-split-squats",
    title: "Side split squats",
    view: "front",
    transition: 0.9,
    frames: [
      { hold: 0.2, pose: sideSplit(0) },
      { hold: 0.4, pose: sideSplit(-1) },
      { hold: 0.2, pose: sideSplit(0) },
      { hold: 0.4, pose: sideSplit(1) },
    ],
  },
  {
    id: "wger_1208",
    slug: "prisoner-squat",
    title: "Prisoner Squat",
    view: "front",
    transition: 1.1,
    frames: [
      { hold: 0.5, pose: prisonerSquat(-170) },
      { hold: 0.4, pose: prisonerSquat(-104) },
    ],
  },
  {
    id: "wger_1096",
    slug: "abduction-while-standing",
    title: "Abduction while standing",
    view: "front",
    transition: 0.8,
    frames: [
      { hold: 0.2, pose: abduction(6) },
      { hold: 0.5, pose: abduction(40) },
    ],
  },
  {
    id: "wger_1141",
    slug: "arabesque",
    title: "Arabesque",
    transition: 1.2,
    frames: [
      { hold: 0.5, pose: arabesque(false) },
      { hold: 0.6, pose: arabesque(true) },
    ],
  },
  {
    id: "wger_1514",
    slug: "lateral-walk",
    title: "Lateral Walk",
    view: "front",
    transition: 0.32,
    frames: [
      { hold: 0.1, pose: lateralWalk(-30, 30) },
      { hold: 0, pose: lateralWalk(-30, 75, "far") },
      { hold: 0.1, pose: lateralWalk(-30, 120) },
      { hold: 0, pose: lateralWalk(15, 120, "near") },
      { hold: 0.1, pose: lateralWalk(60, 120) },
      { hold: 0, pose: lateralWalk(60, 165, "far") },
      { hold: 0.1, pose: lateralWalk(60, 210) },
      { hold: 0, pose: lateralWalk(105, 210, "near") },
      { hold: 0.2, pose: lateralWalk(150, 210) },
      { hold: 0, pose: lateralWalk(105, 210, "near") },
      { hold: 0.1, pose: lateralWalk(60, 210) },
      { hold: 0, pose: lateralWalk(60, 165, "far") },
      { hold: 0.1, pose: lateralWalk(60, 120) },
      { hold: 0, pose: lateralWalk(15, 120, "near") },
      { hold: 0.1, pose: lateralWalk(-30, 120) },
      { hold: 0, pose: lateralWalk(-30, 75, "far") },
    ],
  },
];
