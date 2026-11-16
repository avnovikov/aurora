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

// ---------------------------------------------------------------- clamshells (front view, head left)

/**
 * Side-lying in the front view (as ntc_clamshell): the hips stack 16 apart,
 * near = bottom side, far = top side, both legs drawn so the knees and feet read separately.
 */
const CLAM_PELVIS: Point = [0, -24];
const CLAM_BOTTOM_HIP: Point = [CLAM_PELVIS[0], CLAM_PELVIS[1] + 8];
const CLAM_TOP_HIP: Point = [CLAM_PELVIS[0], CLAM_PELVIS[1] - 8];
/** Bottom leg rests on the floor: hips and knees bent, the foot back on the floor. */
const CLAM_KNEE: Point = along(CLAM_BOTTOM_HIP, -40, 88);
const CLAM_FOOT: Point = along(CLAM_KNEE, (Math.asin((-4 - CLAM_KNEE[1]) / 86) * 180) / Math.PI, 86);
/** Top knee resting on the bottom knee. */
const CLAM_KNEE_TOP: Point = along(CLAM_TOP_HIP, angle(CLAM_TOP_HIP, [CLAM_KNEE[0], CLAM_KNEE[1] - 9]), 88);
/** Top foot resting on the bottom foot. */
const CLAM_FOOT_TOP: Point = along(CLAM_KNEE_TOP, angle(CLAM_KNEE_TOP, [CLAM_FOOT[0], CLAM_FOOT[1] - 9]), 86);
const CLAM_SHOULDER_BOTTOM: Point = [-98, -2];
const CLAM_SHOULDER_TOP: Point = [-98, -46];

/**
 * Rest stacks the legs; `footUp` lifts the top foot with the knees together
 * (reverse clamshell). The top shin turns up about the knee and stays clearly bent.
 */
function clam(footUp: boolean): Pose {
  const foot = footUp ? along(CLAM_KNEE_TOP, 24, 86) : CLAM_FOOT_TOP;
  return {
    pelvis: CLAM_PELVIS,
    chest: [-80, CLAM_PELVIS[1]],
    head: [-134, -40],
    spine: { bend: -1 },
    // Bottom arm straight overhead along the floor as a pillow; top arm long along the top side.
    hands: { near: along(CLAM_SHOULDER_BOTTOM, 180, 125.5), far: along(CLAM_SHOULDER_TOP, 3, 125.5) },
    knees: { near: { at: CLAM_KNEE }, far: { at: CLAM_KNEE_TOP } },
    feet: { near: CLAM_FOOT, far: foot },
    toes: { near: 0, far: 0 },
  };
}

// ---------------------------------------------------------------- crow pose

const CROW_HAND: Point = [80, 0];

/**
 * Crow: hands planted, elbows bent over the wrists, both knees on the backs of
 * the upper arms, back near level so the head stays about hip height. `shift`
 * (0 → 1) is the small forward lean that takes the weight off the toes; the
 * feet then fold up behind towards the seat. Both legs move together.
 */
function crow(shift: number): Pose {
  // Forearm + hand (66) up from the planted hand, leaning back a little less once the weight shifts.
  const forearm = -110 + 5 * shift;
  const elbow = along(CROW_HAND, forearm, 65.6);
  const shoulder = along(elbow, -66 + 6 * shift, 60);
  // Hips high behind the shoulders.
  const pelvis = along(shoulder, 214 - 2 * shift, 98);
  // Knee resting on the back of the upper arm, a little above the elbow.
  const knee = toward(pelvis, along(elbow, -66 + 6 * shift, 18), 88);
  const kneeAt: Point = [round(knee[0]), round(knee[1])];
  // On the toes with the ankles ~14 up, or folded up behind towards the seat.
  const ankle: Point =
    shift < 1
      ? [round(kneeAt[0] - Math.sqrt(86 ** 2 - (kneeAt[1] + 14) ** 2)), -14]
      : along(kneeAt, angle(pelvis, kneeAt) + 157, 86);
  const chest = toward(pelvis, shoulder, 80);
  return {
    pelvis,
    chest,
    // Gaze slightly ahead: the head stays up, about level with the hips.
    head: along(chest, angle(pelvis, shoulder) - 30, 54),
    // Both sides together (side view): the far limbs sit behind the near ones.
    hands: { near: CROW_HAND, far: CROW_HAND },
    elbows: { near: { at: elbow }, far: { at: elbow } },
    knees: { near: { at: kneeAt }, far: { at: kneeAt } },
    feet: { near: ankle, far: ankle },
    // On the balls of the feet, then pointed back once tucked.
    toes: shift < 1 ? { near: 34, far: 34 } : { near: 150, far: 150 },
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

/** Explosive push: body rising, arms locked, hands just leaving the floor under the shoulders. */
function clapLaunch(): Pose {
  const { shoulder } = straightBody(PUSH_ANKLE, -140);
  const hand = along(shoulder, 87, 125.8);
  return pushUp(PUSH_ANKLE, -140, CLAP_HANDS, { near: hand, far: hand });
}

/** Peak: chest high, both hands off the floor and pressed together under the chest (side view: they overlap). */
function clapAir(): Pose {
  const { shoulder } = straightBody(PUSH_ANKLE, -168);
  const clap: Point = [round(shoulder[0] + 22), round(shoulder[1] + 62)];
  return pushUp(PUSH_ANKLE, -168, CLAP_HANDS, { near: clap, far: clap });
}

const DECLINE_BOX = { kind: "box" as const, x: -250, y: -50, w: 90, h: 50 };
const DECLINE_ANKLE: Point = [-206, -69];
const DECLINE_TOP = -125.5;
const DECLINE_BOTTOM = -46;
/**
 * Shoulder heights between top and bottom, eased: short steps keep the hips on the
 * feet-to-shoulder line (a long blend shortens the hip-ankle chord and kinks the knees).
 */
const DECLINE_STEPS = Array.from({ length: 11 }, (_, i) => (1 - Math.cos((Math.PI * (i + 1)) / 12)) / 2).map((f) =>
  round(DECLINE_TOP + (DECLINE_BOTTOM - DECLINE_TOP) * f),
);
const declineAt = (shoulderY: number): Pose => pushUp(DECLINE_ANKLE, shoulderY, 60);

// ---------------------------------------------------------------- specs

export const BATCH_B_SPECS: DoodleSpec[] = [
  {
    id: "wger_2448",
    slug: "reverse-clamshell",
    title: "Reverse Clamshell",
    view: "front",
    transition: 0.9,
    frames: [
      { hold: 0.4, pose: clam(false) },
      { hold: 0.5, pose: clam(true) },
    ],
  },
  {
    id: "hf_129",
    slug: "crow-pose",
    title: "Crow Pose",
    transition: 0.7,
    frames: [
      { hold: 0.6, pose: crow(0) },
      { hold: 1.8, pose: crow(1) },
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
      { hold: 0, pose: clapLaunch() },
      { hold: 0.25, pose: clapAir() },
      // Land on soft elbows, then press back to the top.
      { hold: 0.1, pose: pushUp(PUSH_ANKLE, -100, CLAP_HANDS) },
    ],
  },
  {
    id: "hf_5",
    slug: "decline-push-up",
    title: "Decline Push-Up",
    props: [DECLINE_BOX],
    transition: 0.1,
    frames: [
      { hold: 0.4, pose: declineAt(DECLINE_TOP) },
      ...DECLINE_STEPS.map((y) => ({ hold: 0, pose: declineAt(y) })),
      { hold: 0.3, pose: declineAt(DECLINE_BOTTOM) },
      ...[...DECLINE_STEPS].reverse().map((y) => ({ hold: 0, pose: declineAt(y) })),
    ],
  },
];
