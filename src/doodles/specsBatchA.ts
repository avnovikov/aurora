import type { DoodleSpec, Point, Pose, Prop } from "./rig";

/**
 * Batch A: the most-planned bar and bodyweight moves without a doodle
 * (docs/doodles-to-prepare.md, section 1), drawn from their catalogue steps.
 * Floor at y = 0, up is negative, facing +x; lying face up puts the head on the left.
 */

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}

const round = (value: number): number => Math.round(value * 10) / 10;
const angle = (from: Point, to: Point): number => (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;

/** Pelvis to the far end of the straight torso (shoulder) and to the ankle of a straight leg. */
const SHOULDER_REACH = 98;
const LEG_REACH = 173.9;
/** Ankle to shoulder along a straight body. */
const BODY_REACH = LEG_REACH + SHOULDER_REACH;
/** Shoulder to fingertip, arm straight (just short of locked so the elbow stays clean). */
const ARM_REACH = 125.6;

/** Where circles around `a` (radius ra) and `b` (radius rb) meet; `side` 1 or -1 picks the point left/right of a→b. */
function meet(a: Point, ra: number, b: Point, rb: number, side: 1 | -1): Point {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const x = (ra * ra - rb * rb + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, ra * ra - x * x));
  const ux = (b[0] - a[0]) / d;
  const uy = (b[1] - a[1]) / d;
  return [round(a[0] + ux * x - side * uy * h), round(a[1] + uy * x + side * ux * h)];
}

/** A straight body from the ankle: pelvis and chest at `deg`. */
function straightBody(ankle: Point, deg: number): Pick<Pose, "pelvis" | "chest"> {
  return { pelvis: along(ankle, deg, LEG_REACH), chest: along(ankle, deg, LEG_REACH + 80) };
}

// ---------------------------------------------------------------- bear plank

/** All fours on the toes; `hover` lifts the knees off the floor with the back level. */
function bearPlank(hover: boolean): Pose {
  const pelvis: Point = hover ? [-50, -108] : [-50, -92];
  const knee: Point = [-50, pelvis[1] + 88];
  const shin = hover ? 178 : 186;
  const ankle = along(knee, shin, 86);
  // Toes tucked under: the ball of the foot stays on the floor.
  const toe = (Math.asin(Math.min(1, (-2 - ankle[1]) / 20)) * 180) / Math.PI;
  return {
    pelvis,
    hands: { near: [48, 0], far: [44, 0] },
    knees: { near: { at: knee }, far: { at: [knee[0] + 3, knee[1]] } },
    feet: { near: ankle, far: along([knee[0] + 3, knee[1]], shin, 86) },
    toes: { near: round(toe), far: round(toe) },
  };
}

// ---------------------------------------------------------------- pike hold

function pikeHold(pelvisY: number): Pose {
  return {
    pelvis: [-28, pelvisY],
    hands: { near: [66, 0], far: [60, 0] },
    feet: { near: [-78, 0], far: [-74, 0] },
    toes: { near: 0, far: 0 },
  };
}

// ---------------------------------------------------------------- inverted rows

/** Lying face up under the bar, head to the left; the body rises 42° at the top. */
const ROW_TOP_DEG = -138;
/** At the top the bar meets the chest: the hand sits just in front of the chest, the elbow folds behind the back. */
const ROW_SHOULDER_FROM_HAND: Point = along(along([0, 0], ROW_TOP_DEG, 22), ROW_TOP_DEG - 90, 12);
/** Bar height that puts the heels on the floor (ankle at y = -10) at the top. */
const ROW_BAR: Point = [0, round(-10 - along(ROW_SHOULDER_FROM_HAND, ROW_TOP_DEG + 180, BODY_REACH)[1])];
const ROW_BAR_PROP: Prop = { kind: "bar", y: ROW_BAR[1], x1: -16, x2: 16, grips: [0] };
const ROW_HAND: Point = [ROW_BAR[0] - 2, ROW_BAR[1]];
const ROW_TOP_SHOULDER: Point = [ROW_HAND[0] + ROW_SHOULDER_FROM_HAND[0], ROW_HAND[1] + ROW_SHOULDER_FROM_HAND[1]];
const ROW_ANKLE: Point = along(ROW_TOP_SHOULDER, ROW_TOP_DEG + 180, BODY_REACH);

/** Heels on the floor, body straight; `top` pulls the chest to the bar, otherwise the arms hang straight. */
function invertedRow(top: boolean, oneArm: boolean): Pose {
  const ankle = ROW_ANKLE;
  const shoulder = top ? ROW_TOP_SHOULDER : meet(ankle, BODY_REACH, ROW_HAND, ARM_REACH, -1);
  const deg = angle(ankle, shoulder);
  const body = straightBody(ankle, deg);
  const pelvis = body.pelvis as Point;
  return {
    ...body,
    // One-arm: the free hand rests on the hip.
    hands: oneArm ? { near: ROW_HAND, far: along(pelvis, deg + 90, 6) } : { near: ROW_HAND, far: [ROW_HAND[0] + 1, ROW_HAND[1]] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: ankle, far: [ankle[0] - 3, ankle[1]] },
    toes: { near: -110, far: -110 },
  };
}

// ---------------------------------------------------------------- bodyweight mid row (knees hooked over a high bar)

/** Bar low enough that the hanging head clears the floor by a little (keeps the framing tight). */
const MID_BAR: Point = [0, -168];
const MID_KNEE: Point = [MID_BAR[0] + 2, MID_BAR[1]];
/** Face up, so the head is on the left: the hands grip the bar to the left of the knees. */
const MID_HAND: Point = [MID_BAR[0] - 92, MID_BAR[1]];

/**
 * Hanging face up under the bar from the hands and the hooked knees.
 * Bottom: arms straight down from the bar. Top: elbows bent and driven down, chest up under the bar,
 * the head tipped back below it.
 */
function midRow(top: boolean): Pose {
  // Top: chest at the bar, the shoulders just past the hands so the elbows drive down towards the feet.
  const shoulder: Point = top ? [MID_HAND[0] - 16, MID_BAR[1] + 46] : [MID_HAND[0], round(MID_BAR[1] + ARM_REACH + 0.4)];
  // Thighs hang from the hooked knees; the pelvis sits a torso from the shoulder.
  const pelvis = meet(MID_KNEE, 88, shoulder, SHOULDER_REACH, -1);
  const spine = angle(pelvis, shoulder);
  const chest = along(pelvis, spine, 80);
  // Shins fold back over the bar and hang down behind it.
  const shin = angle(MID_KNEE, pelvis) - 50;
  const farKnee: Point = along(pelvis, angle(pelvis, MID_KNEE) + 2, 88);
  return {
    pelvis,
    chest,
    // Top: the head stays under the bar, tipped back past the hands (the chest, not the chin, comes to the bar).
    head: top ? along(along(chest, spine, 20), spine - 40, 36) : undefined,
    hands: { near: MID_HAND, far: [MID_HAND[0] + 3, MID_HAND[1]] },
    // Bottom: elbows pinned on the hand-shoulder line so the arms hang dead straight.
    elbows: top
      ? { near: { bend: 1 }, far: { bend: 1 } }
      : { near: { at: along(shoulder, -90, 60) }, far: { at: along(shoulder, angle(shoulder, [MID_HAND[0] + 3, MID_HAND[1]]), 60) } },
    knees: { near: { at: MID_KNEE }, far: { at: farKnee } },
    feet: { near: along(MID_KNEE, shin, 86), far: along(farKnee, shin, 86) },
    toes: { near: shin - 60, far: shin - 60 },
  };
}

// ---------------------------------------------------------------- hip thrusts

const THRUST_BENCH: Prop = { kind: "box", x: -300, y: -80, w: 180, h: 80 };
const THRUST_CHEST: Point = [-128, -86];
const THRUST_HEAD: Point = [-156, -128];
const THRUST_ANKLE: Point = [40, 0];

/** Upper back on the bench edge; `top` drives the hips up level with the shoulders, shins vertical. */
function hipThrust(top: boolean, singleLeg: boolean): Pose {
  const pelvis = along(THRUST_CHEST, top ? 0 : 40, 80);
  // Single leg: the free leg is held straight out, foot flexed.
  const freeLeg = top ? -8 : -30;
  return {
    pelvis,
    chest: THRUST_CHEST,
    head: THRUST_HEAD,
    // Arms resting back along the bench.
    hands: { near: [-267, -88], far: [-265, -88] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: singleLeg
      ? { near: THRUST_ANKLE, far: along(pelvis, freeLeg, 172) }
      : { near: THRUST_ANKLE, far: [THRUST_ANKLE[0] - 4, 0] },
    toes: { near: 0, far: singleLeg ? freeLeg - 60 : 0 },
  };
}

// ---------------------------------------------------------------- tibialis raise

/** Body one straight line leaning back 15° from the ankles; only the head and upper back reach the wall. */
const TIB_ANKLE: Point = [0, -6];
const TIB_LEAN = -105;
const TIB_SHOULDER = along(TIB_ANKLE, TIB_LEAN, BODY_REACH);
const TIB_WALL_X = round(TIB_SHOULDER[0] - 14);
const TIB_NECK = along(TIB_ANKLE, TIB_LEAN, LEG_REACH + 100);
/** Head resting on the wall face. */
const TIB_HEAD: Point = [TIB_WALL_X + 26, round(TIB_NECK[1] - Math.sqrt(36 ** 2 - (TIB_WALL_X + 26 - TIB_NECK[0]) ** 2))];
const TIB_WALL: Prop = { kind: "box", x: TIB_WALL_X - 14, y: round(TIB_HEAD[1] - 50), w: 14, h: round(50 - TIB_HEAD[1]) };

/** Legs straight, heels down; `up` pulls the toes hard towards the shins (exaggerated so it reads at phone size). */
function tibialisRaise(up: boolean): Pose {
  // Arms hang along the sides, hands resting on the thighs.
  const arm = TIB_LEAN + 180 - 8;
  return {
    ...straightBody(TIB_ANKLE, TIB_LEAN),
    head: TIB_HEAD,
    hands: { near: along(TIB_SHOULDER, arm, 124), far: along(TIB_SHOULDER, arm + 2, 124) },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: TIB_ANKLE, far: [TIB_ANKLE[0] - 4, TIB_ANKLE[1]] },
    toes: { near: up ? -52 : 0, far: up ? -52 : 0 },
  };
}

// ---------------------------------------------------------------- wall handstand push-up

const HSPU_WALL: Prop = { kind: "box", x: 17, y: -420, w: 14, h: 420 };
/** Hands well out from the wall so the body leans off it and only the heels touch. */
const HSPU_HAND: Point = [140, 0];
const HSPU_HEEL_X = 33;

/** Inverted with the heels on the wall; `down` bends the elbows until the head nearly touches the floor in front of the hands. */
function wallHspu(down: boolean): Pose {
  // At the bottom the forearms stay near vertical and the shoulders travel forward of the hands.
  const shoulder: Point = down ? [HSPU_HAND[0] + 44, -70] : [HSPU_HAND[0], -126];
  // Lean so the heels stay on the wall face.
  const dir = (Math.acos((HSPU_HEEL_X - shoulder[0]) / BODY_REACH) * -180) / Math.PI;
  const pelvis = along(shoulder, dir, SHOULDER_REACH);
  return {
    pelvis,
    chest: along(pelvis, dir + 180, 80),
    head: down ? [HSPU_HAND[0] + 58, -37] : [HSPU_HAND[0] + 23, -97],
    hands: { near: HSPU_HAND, far: [HSPU_HAND[0] - 2, 0] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: along(pelvis, dir, LEG_REACH), far: along(pelvis, dir, LEG_REACH) },
    // Feet flexed, heels against the wall, toes pointing away from it.
    toes: { near: -60, far: -60 },
  };
}

// ---------------------------------------------------------------- chin-up hold (front)

function frontBarHang(pelvisY: number, grip: number, legLength: number, elbows?: Pose["elbows"]): Pose {
  return {
    pelvis: [0, pelvisY],
    chest: [0, pelvisY - 80],
    hands: { near: [-grip, -420], far: [grip, -420] },
    elbows,
    feet: { near: [-14, pelvisY + legLength - 1], far: [14, pelvisY + legLength - 1] },
    toes: { near: 180, far: 0 },
  };
}

// ---------------------------------------------------------------- dragon flag

const FLAG_BENCH: Prop = { kind: "box", x: -210, y: -70, w: 260, h: 70 };
const FLAG_POST: Prop = { kind: "box", x: -240, y: -250, w: 14, h: 250 };
const FLAG_SHOULDER: Point = [-160, -77];

/**
 * On the upper back, body one straight line from the shoulders at `deg`
 * (-70 nearly vertical, -12 hovering over the bench); hands grip a post behind the head.
 * The neck curls so the head stays on the bench end.
 */
function dragonFlag(deg: number, neck: [number, number]): Pose {
  const pelvis = along(FLAG_SHOULDER, deg, SHOULDER_REACH);
  const chest = along(FLAG_SHOULDER, deg, 18);
  const neckPoint = along(chest, deg + 180 + neck[0], 20);
  return {
    pelvis,
    chest,
    head: along(neckPoint, deg + 180 + neck[0] + neck[1], 36),
    hands: { near: [-225, -180], far: [-225, -176] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: along(pelvis, deg, LEG_REACH), far: along(pelvis, deg, LEG_REACH) },
    toes: { near: deg, far: deg },
  };
}

// ---------------------------------------------------------------- incline push-up, close grip

const CLOSE_FOOT: Point = [-112, -19];

/** Hands together on a ledge, body straight; elbows tucked back along the ribs. */
function inclineClose(shoulderY: number): Pose {
  const deg = angle(CLOSE_FOOT, [CLOSE_FOOT[0] + Math.sqrt(BODY_REACH ** 2 - (shoulderY - CLOSE_FOOT[1]) ** 2), shoulderY]);
  return {
    ...straightBody(CLOSE_FOOT, deg),
    hands: { near: [82, -92], far: [80, -92] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: CLOSE_FOOT, far: CLOSE_FOOT },
    toes: { near: 62, far: 62 },
  };
}

// ---------------------------------------------------------------- towel dead hang (front)

/** Bar above the grip; a towel strip hangs from it to each hand. */
const TOWEL_BAR = -500;
const TOWEL_GRIP = 56;
const TOWEL_W = 14;
const towelStrip = (x: number): Prop => ({ kind: "box", x: x - TOWEL_W / 2, y: TOWEL_BAR, w: TOWEL_W, h: -420 - TOWEL_BAR });

// ---------------------------------------------------------------- wall push-up

const WALL_PUSH_FACE = 196;
const WALL_PUSH: Prop = { kind: "box", x: WALL_PUSH_FACE, y: -380, w: 14, h: 380 };
const WALL_PUSH_ANKLE: Point = [0, -4];

/** Standing lean with the hands on the wall at shoulder height; `deg` is the body's lean (-90 upright). */
function wallPushUp(deg: number): Pose {
  return {
    ...straightBody(WALL_PUSH_ANKLE, deg),
    hands: { near: [WALL_PUSH_FACE, -262], far: [WALL_PUSH_FACE - 1, -263] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: WALL_PUSH_ANKLE, far: WALL_PUSH_ANKLE },
    toes: { near: 0, far: 0 },
  };
}

export const BATCH_A_SPECS: DoodleSpec[] = [
  {
    id: "ntc_bear_plank",
    slug: "bear-plank",
    title: "Bear plank hold",
    transition: 1,
    frames: [
      { hold: 0.6, pose: bearPlank(false) },
      { hold: 2, pose: bearPlank(true) },
    ],
  },
  {
    id: "wger_2691",
    slug: "pike-hold",
    title: "Pike Hold (Floor)",
    transition: 1.6,
    frames: [
      { hold: 1.2, pose: pikeHold(-166) },
      { hold: 1.2, pose: pikeHold(-163) },
    ],
  },
  {
    id: "fedb_bodyweight_mid_row",
    slug: "bodyweight-mid-row",
    title: "Bodyweight Mid Row",
    props: [{ kind: "bar", y: MID_BAR[1], x1: MID_HAND[0] - 30, x2: 40, grips: [MID_BAR[0], MID_HAND[0]] }],
    transition: 1,
    frames: [
      { hold: 0.5, pose: midRow(false) },
      { hold: 0.4, pose: midRow(true) },
    ],
  },
  {
    id: "hf_42",
    slug: "one-arm-inverted-row",
    title: "One-Arm Inverted Row",
    props: [ROW_BAR_PROP],
    transition: 1,
    frames: [
      { hold: 0.5, pose: invertedRow(false, true) },
      { hold: 0.4, pose: invertedRow(true, true) },
    ],
  },
  {
    id: "hf_87",
    slug: "hip-thrust",
    title: "Hip Thrust",
    props: [THRUST_BENCH],
    transition: 1,
    frames: [
      { hold: 0.4, pose: hipThrust(false, false) },
      { hold: 0.6, pose: hipThrust(true, false) },
    ],
  },
  {
    id: "hf_93",
    slug: "tibialis-raise",
    title: "Tibialis Raise",
    props: [TIB_WALL],
    transition: 0.7,
    frames: [
      { hold: 0.4, pose: tibialisRaise(false) },
      { hold: 0.5, pose: tibialisRaise(true) },
    ],
  },
  {
    id: "wger_1913",
    slug: "unilateral-hip-thrust",
    title: "Unilateral Hip Thrust",
    props: [THRUST_BENCH],
    transition: 1,
    frames: [
      { hold: 0.4, pose: hipThrust(false, true) },
      { hold: 0.6, pose: hipThrust(true, true) },
    ],
  },
  {
    id: "hf_20",
    slug: "wall-handstand-push-up",
    title: "Wall Handstand Push-Up",
    props: [HSPU_WALL],
    transition: 1.3,
    frames: [
      { hold: 0.5, pose: wallHspu(false) },
      { hold: 0.3, pose: wallHspu(true) },
    ],
  },
  {
    id: "hf_40",
    slug: "wide-grip-inverted-row",
    title: "Wide-Grip Inverted Row",
    props: [ROW_BAR_PROP],
    transition: 1,
    frames: [
      { hold: 0.5, pose: invertedRow(false, false) },
      { hold: 0.4, pose: invertedRow(true, false) },
    ],
  },
  {
    id: "wger_1282",
    slug: "chin-up-hold",
    title: "Chin-up Isometric Hold",
    view: "front",
    props: [{ kind: "bar", y: -420, x1: -150, x2: 150, grips: [-70, 70] }],
    transition: 1.2,
    frames: [
      { hold: 2.5, pose: { ...frontBarHang(-310, 70, 172), elbows: { near: { bend: -1 }, far: { bend: 1 } } } },
      { hold: 0.4, pose: frontBarHang(-210.5, 70, 172, { near: { bend: -1 }, far: { bend: 1 } }) },
    ],
  },
  {
    id: "hf_108",
    slug: "dragon-flag",
    title: "Dragon Flag",
    props: [FLAG_BENCH, FLAG_POST],
    transition: 0.8,
    frames: [
      { hold: 0.4, pose: dragonFlag(-70, [32, 58]) },
      { hold: 0, pose: dragonFlag(-41, [22, 42]) },
      { hold: 0.5, pose: dragonFlag(-12, [10, 25]) },
      { hold: 0, pose: dragonFlag(-41, [22, 42]) },
    ],
  },
  {
    id: "fedb_incline_push_up_close_grip",
    slug: "incline-push-up-close-grip",
    title: "Incline Push-Up Close-Grip",
    props: [{ kind: "box", x: 60, y: -90, w: 90, h: 90 }],
    transition: 0.9,
    frames: [
      { hold: 0.4, pose: inclineClose(-217) },
      { hold: 0.4, pose: inclineClose(-170) },
    ],
  },
  {
    id: "wger_2732",
    slug: "towel-grip-dead-hang",
    title: "Towel Grip Dead Hang",
    view: "front",
    props: [{ kind: "bar", y: TOWEL_BAR, x1: -150, x2: 150 }, towelStrip(-TOWEL_GRIP), towelStrip(TOWEL_GRIP)],
    transition: 1.8,
    frames: [
      // Dead hang from the towel ends, arms long; the straight legs drift together a little.
      { hold: 1.6, pose: frontBarHang(-201, TOWEL_GRIP, 174.9) },
      { hold: 1.6, pose: { ...frontBarHang(-201, TOWEL_GRIP, 174.9), feet: { near: [-11, -27.2], far: [11, -27.2] } } },
    ],
  },
  {
    id: "hf_1",
    slug: "wall-push-up",
    title: "Wall Push-Up",
    props: [WALL_PUSH],
    transition: 0.5,
    frames: [
      // Mid frames keep the legs straight while the body pivots on the ankles.
      { hold: 0.4, pose: wallPushUp(-75) },
      { hold: 0, pose: wallPushUp(-66) },
      { hold: 0.4, pose: wallPushUp(-58) },
      { hold: 0, pose: wallPushUp(-66) },
    ],
  },
];
