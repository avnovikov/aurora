import { solveJoint } from "./rig";
import type { DoodleSpec, Point, Pose } from "./rig";

/**
 * Batch B: bar and bodyweight moves from section 2 of docs/doodles-to-prepare.md,
 * posed from their catalogue descriptions. Floor at y = 0, up is negative, facing +x.
 * Import only from ./rig — never from ./specs (that would be circular).
 */

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}

const round = (value: number): number => Math.round(value * 10) / 10;
const angle = (from: Point, to: Point): number => (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;
const distance = (a: Point, b: Point): number => Math.hypot(a[0] - b[0], a[1] - b[1]);
const chestToward = (pelvis: Point, shoulder: Point): Point => along(pelvis, angle(pelvis, shoulder), 80);

/** Rotate `p` about `c` by `degrees` (clockwise on screen). */
function rotateAbout(p: Point, c: Point, degrees: number): Point {
  const r = (degrees * Math.PI) / 180;
  const dx = p[0] - c[0];
  const dy = p[1] - c[1];
  return [round(c[0] + dx * Math.cos(r) - dy * Math.sin(r)), round(c[1] + dx * Math.sin(r) + dy * Math.cos(r))];
}

/** Point `length` from `from` towards `to` (unrounded, so pinned spines stay exactly straight). */
function toward(from: Point, to: Point, length: number): Point {
  const d = distance(from, to);
  return [from[0] + ((to[0] - from[0]) / d) * length, from[1] + ((to[1] - from[1]) / d) * length];
}

/** Shoulder-to-ankle length of a straight body (98 + 174). */
const BODY = 272;

/**
 * Straight body from a fixed ankle up to a shoulder at height `shoulderY`
 * (shoulder ahead of the ankle): pelvis and chest on the line.
 */
function straightBody(ankle: Point, shoulderY: number): { pelvis: Point; chest: Point; shoulder: Point } {
  const dy = shoulderY - ankle[1];
  const shoulder: Point = [round(ankle[0] + Math.sqrt(BODY ** 2 - dy * dy)), shoulderY];
  return { pelvis: toward(ankle, shoulder, 174), chest: toward(ankle, shoulder, 254), shoulder };
}

// ---------------------------------------------------------------- clamshells (side lying, head left)

const SL_PELVIS: Point = [0, -18];

function sideLying(extra: Pose): Pose {
  return {
    pelvis: SL_PELVIS,
    chest: [-80, -18],
    // Head resting on the bottom arm, which reaches overhead along the floor.
    head: [-129, -40],
    spine: { bend: -1 },
    // Top arm lies along the body, hand on the thigh.
    hands: { near: along([-98, -18], 175, 125.5), far: along([-98, -18], -4, 125.5) },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    ...extra,
  };
}

/** Bottom leg: hips and knees bent, resting on the floor. */
const CLAM_KNEE: Point = along(SL_PELVIS, -28, 88);
const CLAM_FOOT: Point = along(CLAM_KNEE, 42, 86);
/** Top leg at rest: stacked just above the bottom one, hovering. */
const CLAM_KNEE_TOP: Point = along(SL_PELVIS, -31, 88);
const CLAM_FOOT_TOP: Point = along(CLAM_KNEE_TOP, 40, 86);

/** `knee` = top knee opening angle (thigh angle), `foot` = top shin angle about the knee. */
function clam(mode: "rest" | "open" | "footUp"): Pose {
  let knee = CLAM_KNEE_TOP;
  let foot = CLAM_FOOT_TOP;
  if (mode === "open") {
    // Knee opens upward; the foot stays as close to the bottom foot as the leg allows.
    knee = along(SL_PELVIS, -50, 88);
    foot = toward(knee, CLAM_FOOT_TOP, 86);
  }
  if (mode === "footUp") {
    // Knees stay together; the top foot lifts by turning the hip inward.
    foot = along(CLAM_KNEE_TOP, -2, 86);
  }
  return sideLying({
    knees: { near: { at: CLAM_KNEE }, far: { at: knee } },
    feet: { near: CLAM_FOOT, far: foot },
    toes: { near: 0, far: mode === "footUp" ? -20 : 0 },
  });
}

// ---------------------------------------------------------------- crow pose

const CROW_HANDS: Pose["hands"] = { near: [80, 0], far: [77, 0] };

function crow(balanced: boolean): Pose {
  if (!balanced) {
    // Deep squat, hands planted ahead, knees against the backs of the upper arms, feet on the floor.
    const pelvis: Point = [-34, -48];
    return {
      pelvis,
      chest: chestToward(pelvis, [75, -110]),
      hands: CROW_HANDS,
      feet: { near: [4, -4], far: [2, -4] },
      toes: { near: 0, far: 0 },
    };
  }
  // Weight forward over the hands, hips high, feet tucked up off the floor.
  const pelvis: Point = [16, -158];
  const knee = toward(pelvis, [76, -86], 88);
  return {
    pelvis,
    chest: chestToward(pelvis, [96, -104]),
    head: [130, -98],
    hands: CROW_HANDS,
    knees: { near: { at: knee }, far: { at: knee } },
    // Knees folded tight, feet tucked up behind towards the seat.
    feet: { near: along(knee, 204, 86), far: along(knee, 202, 86) },
    toes: { near: 215, far: 215 },
  };
}

// ---------------------------------------------------------------- ab wheel rollout

const WHEEL_KNEE: Point = [-50, -4];

/** `t` 0 = kneeling with the wheel under the shoulders, 1 = rolled out with knees to shoulders in one line. */
function abWheel(t: number): Pose {
  const end = -21.8;
  const hip = -90 + (end + 90) * t;
  const spine = -20 + (end + 20) * t;
  const pelvis = along(WHEEL_KNEE, hip, 88);
  const shoulder = along(pelvis, spine, 98);
  // Arms stay straight: hands on the floor a full arm from the shoulder.
  const handX = shoulder[0] + Math.sqrt(125.9 ** 2 - (shoulder[1] + 2) ** 2);
  return {
    pelvis,
    chest: along(pelvis, spine, 80),
    hands: { near: [handX, -2], far: [handX - 2, -2] },
    knees: { near: { at: WHEEL_KNEE }, far: { at: WHEEL_KNEE } },
    feet: { near: [-136, -4], far: [-136, -4] },
    toes: { near: 180, far: 180 },
  };
}

// ---------------------------------------------------------------- good morning

const GM_FEET: Pose["feet"] = { near: [6, 0], far: [0, 0] };
const GM_STAND: Point = [0, -172];
/** Hands on the hips, elbows out behind: offsets from the pelvis when standing. */
const GM_ELBOW: Point = [-30, -218];
const GM_HAND: Point = along(GM_ELBOW, angle(GM_ELBOW, [12, -168]), 66);

function goodMorning(hinged: boolean): Pose {
  const pelvis: Point = hinged ? [-46, -164] : GM_STAND;
  const tilt = hinged ? 76 : 0;
  const place = (p: Point): Point =>
    rotateAbout([p[0] + pelvis[0] - GM_STAND[0], p[1] + pelvis[1] - GM_STAND[1]], pelvis, tilt);
  return {
    pelvis,
    chest: along(pelvis, -90 + tilt, 80),
    hands: { near: place(GM_HAND), far: place([GM_HAND[0] - 3, GM_HAND[1]]) },
    elbows: { near: { at: place(GM_ELBOW) }, far: { bend: 1 } },
    feet: GM_FEET,
    toes: { near: 0, far: 0 },
  };
}

// ---------------------------------------------------------------- reverse hyperextension (bench)

const RH_BENCH = { kind: "box" as const, x: 10, y: -130, w: 200, h: 130 };
const RH_PELVIS: Point = [4, -142];
/** Arms straight along the bench, hands gripping its far end. */
const RH_HAND: Point = along([102, -142], -2, 125.5);

function reverseHyper(lifted: boolean): Pose {
  const foot = lifted ? along(RH_PELVIS, 178, 172) : along(RH_PELVIS, 133, 172);
  return {
    pelvis: RH_PELVIS,
    chest: [84, -142],
    head: [132, -167],
    // Gripping the far end of the bench.
    hands: { near: RH_HAND, far: RH_HAND },
    feet: { near: foot, far: [foot[0] + 2, foot[1] + 1] },
    toes: { near: lifted ? 178 : 155, far: lifted ? 178 : 155 },
  };
}

// ---------------------------------------------------------------- side planks (head left, feet right)

const SP_FOOT: Point = [207.6, -19.3];

/** Forearm side plank (as the warm-up side plank); `pelvisY` raises or drops the hips. */
function sidePlank(pelvisY: number): { pose: Pose; shoulder: Point } {
  const pelvis: Point = [round(SP_FOOT[0] - Math.sqrt(173.9 ** 2 - (pelvisY - SP_FOOT[1]) ** 2)), pelvisY];
  const dy = -64 - pelvisY;
  const shoulder: Point = [round(pelvis[0] - Math.sqrt(98 * 98 - dy * dy)), -64];
  return {
    shoulder,
    pose: {
      pelvis,
      chest: chestToward(pelvis, shoulder),
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
      hands: { near: [shoulder[0] + 66, -4] },
      feet: { near: SP_FOOT, far: SP_FOOT },
      toes: { near: 62, far: 62 },
    },
  };
}

/** Top hand on the hip, elbow pointing up. */
function hipLift(pelvisY: number): Pose {
  const { pose, shoulder } = sidePlank(pelvisY);
  const pelvis = pose.pelvis as Point;
  return {
    ...pose,
    // Top arm lies along the body, hand on the hip.
    hands: { ...pose.hands, far: toward(shoulder, pelvis, 125.5) },
  };
}

function rotationPlank(threaded: boolean): Pose {
  const { pose, shoulder } = sidePlank(-54);
  return {
    ...pose,
    hands: {
      ...pose.hands,
      // Top arm to the ceiling, or threaded under the body towards the feet.
      far: threaded ? [shoulder[0] + 104, -26] : [shoulder[0] + 6, -186],
    },
  };
}

// ---------------------------------------------------------------- horizontal traction isometry (low bar)

const ROW_BAR = -150;
const ROW_HAND: Point = [0, ROW_BAR];
const ROW_ANKLE_Y = -10;

/** Top of the inverted row: forearm up to the bar, upper arm alongside the body, chest just under the bar. */
const ROW_TOP_ELBOW: Point = along(ROW_HAND, 75, 66);
const ROW_TOP_SHOULDER: Point = along(ROW_TOP_ELBOW, 219, 60);
/** Heels stay planted where the straight body from the top shoulder meets the floor. */
const ROW_ANKLE: Point = along(
  ROW_TOP_SHOULDER,
  (Math.asin((ROW_ANKLE_Y - ROW_TOP_SHOULDER[1]) / BODY) * 180) / Math.PI,
  BODY,
);
const ROW_TOP_REACH = distance(ROW_TOP_SHOULDER, ROW_HAND);
const ROW_STEPS = [115, 104, 92, 80, 68, 56, 46];

/**
 * Inverted row with the shoulder `reach` from the hand (125.5 = arms straight):
 * the straight body pivots on the heels, the elbow folds towards the feet.
 */
function row(reach: number): Pose {
  // Shoulder where the arm circle about the hand meets the body circle about the ankle (lower solution).
  const d = distance(ROW_HAND, ROW_ANKLE);
  const a = (reach ** 2 - BODY ** 2 + d * d) / (2 * d);
  const h = Math.sqrt(reach ** 2 - a * a);
  const ux = (ROW_ANKLE[0] - ROW_HAND[0]) / d;
  const uy = (ROW_ANKLE[1] - ROW_HAND[1]) / d;
  const shoulder: Point = [ROW_HAND[0] + a * ux - h * uy, ROW_HAND[1] + a * uy + h * ux];
  const elbow = solveJoint(shoulder, ROW_HAND, 60, 66, 1);
  return rowPose(shoulder, ROW_ANKLE, { elbows: { near: { at: elbow }, far: { at: elbow } } });
}

function rowPose(shoulder: Point, ankle: Point, extra: Pose): Pose {
  return {
    pelvis: toward(shoulder, ankle, 98),
    chest: toward(shoulder, ankle, 18),
    hands: { near: ROW_HAND, far: ROW_HAND },
    feet: { near: ankle, far: ankle },
    toes: { near: -60, far: -60 },
    ...extra,
  };
}

// ---------------------------------------------------------------- archer pull-up (front)

const ARCHER_GRIP = 100;
const ARCHER_LEGS = 173.5;

function archerHang(): Pose {
  const shoulderY = round(-420 + Math.sqrt(125.8 ** 2 - (ARCHER_GRIP - 22) ** 2));
  const pelvis: Point = [0, shoulderY + 98];
  return {
    pelvis,
    chest: [0, shoulderY + 18],
    hands: { near: [-ARCHER_GRIP, -420], far: [ARCHER_GRIP, -420] },
    elbows: { near: { bend: -1 }, far: { bend: 1 } },
    feet: { near: [-14, pelvis[1] + ARCHER_LEGS], far: [14, pelvis[1] + ARCHER_LEGS] },
    toes: { near: 180, far: 0 },
  };
}

/** Pulled towards one hand (`side` -1 = near/left); the other arm stays straight. */
function archerTop(side: -1 | 1): Pose {
  const shoulderY = -370;
  // The straight arm's shoulder sits a full arm from its hand.
  const straightShoulderX = -side * (ARCHER_GRIP - Math.sqrt(125.5 ** 2 - (shoulderY + 420) ** 2));
  const cx = round(straightShoulderX + side * 22);
  const pelvis: Point = [cx, shoulderY + 98];
  return {
    pelvis,
    chest: [cx, shoulderY + 18],
    head: [cx + side * 10, shoulderY - 36],
    hands: { near: [-ARCHER_GRIP, -420], far: [ARCHER_GRIP, -420] },
    elbows: { near: { bend: -1 }, far: { bend: 1 } },
    feet: { near: [cx - 14, pelvis[1] + ARCHER_LEGS], far: [cx + 14, pelvis[1] + ARCHER_LEGS] },
    toes: { near: 180, far: 0 },
  };
}

// ---------------------------------------------------------------- body saw (forearm plank, feet sliding)

const SAW_ELBOW: Point = [60, -4];

/** `upper` is the upper-arm angle at the elbow (-90 = shoulder straight above it). */
function bodySaw(upper: number): Pose {
  const shoulder = along(SAW_ELBOW, upper, 60);
  const dy = -19.3 - shoulder[1];
  const ankle: Point = [round(shoulder[0] - Math.sqrt(BODY ** 2 - dy * dy)), -19.3];
  return {
    pelvis: toward(shoulder, ankle, 98),
    chest: toward(shoulder, ankle, 18),
    elbows: { near: { at: SAW_ELBOW }, far: { at: SAW_ELBOW } },
    hands: { near: [SAW_ELBOW[0] + 66, -4], far: [SAW_ELBOW[0] + 66, -4] },
    feet: { near: ankle, far: ankle },
    toes: { near: 62, far: 62 },
  };
}

// ---------------------------------------------------------------- push-ups

const PUSH_ANKLE: Point = [-190, -19];

/** Straight plank pivoting on the toes; hands on the floor at `handX` unless given. */
function pushUp(ankle: Point, shoulderY: number, handX: number, hands?: Pose["hands"]): Pose {
  const { pelvis, chest } = straightBody(ankle, shoulderY);
  return {
    pelvis,
    chest,
    hands: hands ?? { near: [handX, 0], far: [handX - 1, 0] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: ankle, far: ankle },
    toes: { near: 62, far: 62 },
  };
}

const CLAP_HANDS = 60;

function clapAir(): Pose {
  const { shoulder } = straightBody(PUSH_ANKLE, -152);
  const clap: Point = [round(shoulder[0] + 44), round(shoulder[1] + 78)];
  return pushUp(PUSH_ANKLE, -152, CLAP_HANDS, { near: clap, far: [clap[0] - 1, clap[1]] });
}

const DECLINE_BOX = { kind: "box" as const, x: -250, y: -50, w: 90, h: 50 };
const DECLINE_ANKLE: Point = [-206, -69];

// ---------------------------------------------------------------- specs

export const BATCH_B_SPECS: DoodleSpec[] = [
  {
    id: "wger_2449",
    slug: "clamshell-to-reverse-clamshell",
    title: "Clamshell to Reverse Clamshell",
    transition: 0.9,
    frames: [
      { hold: 0.3, pose: clam("rest") },
      { hold: 0.5, pose: clam("open") },
      { hold: 0.3, pose: clam("rest") },
      { hold: 0.5, pose: clam("footUp") },
    ],
  },
  {
    id: "wger_2448",
    slug: "reverse-clamshell",
    title: "Reverse Clamshell",
    transition: 0.9,
    frames: [
      { hold: 0.4, pose: clam("rest") },
      { hold: 0.5, pose: clam("footUp") },
    ],
  },
  {
    id: "hf_129",
    slug: "crow-pose",
    title: "Crow Pose",
    transition: 1.1,
    frames: [
      { hold: 0.5, pose: crow(false) },
      { hold: 1.6, pose: crow(true) },
    ],
  },
  {
    id: "hf_113",
    slug: "ab-wheel-rollout",
    title: "Ab Wheel Rollout",
    transition: 1.4,
    frames: [
      { hold: 0.4, pose: abWheel(0) },
      { hold: 0, pose: abWheel(0.5) },
      { hold: 0.4, pose: abWheel(1) },
      { hold: 0, pose: abWheel(0.5) },
    ],
  },
  {
    id: "wger_1392",
    slug: "good-morning",
    title: "Good Morning",
    transition: 1.2,
    frames: [
      { hold: 0.4, pose: goodMorning(false) },
      { hold: 0.4, pose: goodMorning(true) },
    ],
  },
  {
    id: "wger_1809",
    slug: "reverse-hyperextension",
    title: "Reverse Hyperextension",
    props: [RH_BENCH],
    transition: 1.1,
    frames: [
      { hold: 0.4, pose: reverseHyper(false) },
      { hold: 0.5, pose: reverseHyper(true) },
    ],
  },
  {
    id: "ntc_side_plank_hip_lift",
    slug: "side-plank-hip-lift",
    title: "Side plank hip lifts",
    transition: 1,
    frames: [
      { hold: 0.4, pose: hipLift(-54) },
      { hold: 0.3, pose: hipLift(-14) },
    ],
  },
  {
    id: "hf_101",
    slug: "side-plank-with-rotation",
    title: "Side Plank with Rotation",
    transition: 1.3,
    frames: [
      { hold: 0.6, pose: rotationPlank(false) },
      { hold: 0.6, pose: rotationPlank(true) },
    ],
  },
  {
    id: "wger_1101",
    slug: "horizontal-traction-isometry",
    title: "Horizontal traction isometry",
    props: [{ kind: "bar", y: ROW_BAR, x1: -80, x2: 80, grips: [0] }],
    // Short steps keep the body straight while it pivots on the heels.
    transition: 0.16,
    frames: [
      { hold: 0.4, pose: row(125.5) },
      ...ROW_STEPS.map((reach) => ({ hold: 0, pose: row(reach) })),
      { hold: 2, pose: row(ROW_TOP_REACH) },
      ...[...ROW_STEPS].reverse().map((reach) => ({ hold: 0.05, pose: row(reach) })),
    ],
  },
  {
    id: "hf_50",
    slug: "archer-pull-up",
    title: "Archer Pull-Up",
    view: "front",
    props: [{ kind: "bar", y: -420, x1: -170, x2: 170, grips: [-ARCHER_GRIP, ARCHER_GRIP] }],
    transition: 1,
    frames: [
      { hold: 0.4, pose: archerHang() },
      { hold: 0.5, pose: archerTop(-1) },
      { hold: 0.4, pose: archerHang() },
      { hold: 0.5, pose: archerTop(1) },
    ],
  },
  {
    id: "hf_125",
    slug: "body-saw",
    title: "Body Saw",
    transition: 1.2,
    frames: [
      { hold: 0.4, pose: bodySaw(-80) },
      { hold: 0.4, pose: bodySaw(-140) },
    ],
  },
  {
    id: "hf_17",
    slug: "clap-push-up",
    title: "Clap Push-Up",
    transition: 0.4,
    frames: [
      { hold: 0.4, pose: pushUp(PUSH_ANKLE, -125.5, CLAP_HANDS) },
      { hold: 0.15, pose: pushUp(PUSH_ANKLE, -50, CLAP_HANDS) },
      { hold: 0.15, pose: clapAir() },
    ],
  },
  {
    id: "hf_5",
    slug: "decline-push-up",
    title: "Decline Push-Up",
    props: [DECLINE_BOX],
    transition: 1,
    frames: [
      { hold: 0.4, pose: pushUp(DECLINE_ANKLE, -125.5, 60) },
      { hold: 0.3, pose: pushUp(DECLINE_ANKLE, -46, 60) },
    ],
  },
];
