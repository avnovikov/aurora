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

const MID_BAR: Point = [0, -210];

/** Hanging face up under the bar from the hands and the hooked knees; `top` pulls the chest up to the bar. */
function midRow(top: boolean): Pose {
  const knee: Point = [MID_BAR[0] - 2, MID_BAR[1]];
  const pelvis = along(knee, top ? 82 : 90, 88);
  const chest = along(pelvis, top ? -142 : -170, 80);
  const thigh = angle(pelvis, knee);
  return {
    pelvis,
    chest,
    hands: { near: [MID_BAR[0] + 4, MID_BAR[1]], far: [MID_BAR[0], MID_BAR[1]] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { at: knee }, far: { at: [knee[0] - 3, knee[1]] } },
    feet: { near: along(knee, thigh + 125, 86), far: along([knee[0] - 3, knee[1]], thigh + 125, 86) },
    toes: { near: thigh + 160, far: thigh + 160 },
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

const TIB_WALL_X = -30;
const TIB_WALL: Prop = { kind: "box", x: TIB_WALL_X - 14, y: -360, w: 14, h: 360 };

/** Back against the wall, legs straight with the feet a step forward; `up` lifts the toes, heels down. */
function tibialisRaise(up: boolean): Pose {
  const pelvis: Point = [TIB_WALL_X + 12, -172.5];
  const ankle: Point = [round(pelvis[0] + 50), round(pelvis[1] + Math.sqrt(LEG_REACH ** 2 - 50 ** 2))];
  return {
    pelvis,
    chest: [TIB_WALL_X + 18, pelvis[1] - 80],
    head: [TIB_WALL_X + 25, pelvis[1] - 134],
    hands: { near: [TIB_WALL_X + 30, -150], far: [TIB_WALL_X + 26, -150] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: ankle, far: [ankle[0] - 4, ankle[1]] },
    toes: { near: up ? -38 : 0, far: up ? -38 : 0 },
  };
}

// ---------------------------------------------------------------- wall handstand push-up

const HSPU_WALL: Prop = { kind: "box", x: 17, y: -440, w: 14, h: 440 };
const HSPU_HAND: Point = [64, 0];
const HSPU_HEEL_X = 32.5;

/** Inverted with the heels on the wall; `down` bends the elbows until the head nearly touches the floor in front of the hands. */
function wallHspu(down: boolean): Pose {
  // At the bottom the forearms stay near vertical and the shoulders travel forward of the hands.
  const shoulder: Point = down ? [108, -70] : [64, -126];
  // Lean so the heels stay on the wall face.
  const dir = (Math.acos((HSPU_HEEL_X - shoulder[0]) / BODY_REACH) * -180) / Math.PI;
  const pelvis = along(shoulder, dir, SHOULDER_REACH);
  return {
    pelvis,
    chest: along(pelvis, dir + 180, 80),
    head: down ? [122, -37] : [87, -97],
    hands: { near: HSPU_HAND, far: [HSPU_HAND[0] - 2, 0] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: along(pelvis, dir, LEG_REACH), far: along(pelvis, dir, LEG_REACH) },
    toes: { near: -75, far: -75 },
  };
}

// ---------------------------------------------------------------- archer push-up (seen from above)

/** Top-down plank, head to the right; `shift` moves the chest over the near (+1) or far (-1) hand. */
const ARCHER_FEET: Point = [-230, -170];
const ARCHER_HANDS: Record<"near" | "far", Point> = { near: [42, -296], far: [42, -44] };

function archer(shift: -1 | 0 | 1): Pose {
  const deg = shift * -9;
  const body = straightBody(ARCHER_FEET, deg);
  const pelvis = body.pelvis as Point;
  const shoulder = along(ARCHER_FEET, deg, BODY_REACH);
  // The straight arm slides out to stay long; the working arm bends.
  const slide = (side: "near" | "far"): Point => {
    const hand = ARCHER_HANDS[side];
    const straight = (side === "near" && shift === -1) || (side === "far" && shift === 1) || shift === 0;
    if (!straight) return hand;
    const sideShoulder: Point = [shoulder[0], shoulder[1] + (side === "near" ? -22 : 22)];
    return along(sideShoulder, side === "near" ? -90 : 90, ARM_REACH);
  };
  return {
    ...body,
    hands: { near: slide("near"), far: slide("far") },
    elbows: { near: { bend: -1 }, far: { bend: 1 } },
    // Feet stay under the hips (spread 8 either side of the spine).
    feet: { near: along(along(pelvis, deg - 90, 8), deg + 180, LEG_REACH), far: along(along(pelvis, deg + 90, 8), deg + 180, LEG_REACH) },
    toes: { near: 180, far: 180 },
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

// ---------------------------------------------------------------- towel dead hang

const TOWEL_BAR = -490;

function towelHang(sway: number): Pose {
  const pelvis: Point = [sway, -196];
  return {
    pelvis,
    head: [34 + sway, -318],
    hands: { near: [4, -420], far: [0, -420] },
    feet: { near: along(pelvis, 88, 173.6), far: along(pelvis, 87, 173.4) },
    toes: { near: 75, far: 75 },
  };
}

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
    props: [{ kind: "bar", y: MID_BAR[1], x1: -40, x2: 40, grips: [MID_BAR[0]] }],
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
    id: "hf_6",
    slug: "archer-push-up",
    title: "Archer Push-Up",
    view: "front",
    transition: 1,
    frames: [
      { hold: 0.3, pose: archer(0) },
      { hold: 0.5, pose: archer(1) },
      { hold: 0.3, pose: archer(0) },
      { hold: 0.5, pose: archer(-1) },
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
    props: [
      { kind: "bar", y: TOWEL_BAR, x1: -110, x2: 110 },
      { kind: "box", x: -4, y: TOWEL_BAR, w: 10, h: 70 },
    ],
    transition: 1.6,
    frames: [
      { hold: 1.2, pose: towelHang(0) },
      { hold: 1.2, pose: towelHang(2) },
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
