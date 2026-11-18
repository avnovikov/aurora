import type { DoodleSpec, JointHint, Point, Pose, Prop } from "./rig";

/**
 * Batch V: pull-up variations. Front view where grip width or a one-arm hang
 * is what tells the move apart; side view where the
 * lean (Gironda), the legs (L-sit), the push away from the bar (headbanger) or
 * a box behind the hang (top hold, slow negative) is the point. Grip type
 * (overhand, underhand, neutral, mixed) can't be seen on a stick figure.
 * Floor at y = 0, up is negative, the side-view figure faces +x.
 * Import only from ./rig — never from ./specs (that would be circular).
 */

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}

const round = (value: number): number => Math.round(value * 10) / 10;
const angle = (from: Point, to: Point): number => (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;

const BAR_Y = -420;
/** Straight-arm reach from shoulder to fingertip (a hair short of locked). */
const REACH = 125.4;
/** Pelvis to ankle with the knee straight. */
const LEG = 173.6;
/** Shoulder offset from the chest in front view. */
const SHOULDER_SIDE = 22;
const UPPER_ARM = 60;
/** Forearm plus hand: elbow to fingertip with the wrist straight. */
const LOWER_ARM = 66;

/**
 * Elbow for a bent arm: UPPER_ARM from the shoulder and LOWER_ARM from the
 * fingertip. `pick` chooses between the two solutions.
 */
function elbowBetween(shoulder: Point, hand: Point, pick: (a: Point, b: Point) => Point): Point {
  const d = Math.hypot(hand[0] - shoulder[0], hand[1] - shoulder[1]);
  const a = (UPPER_ARM ** 2 - LOWER_ARM ** 2 + d ** 2) / (2 * d);
  const h = Math.sqrt(Math.max(0, UPPER_ARM ** 2 - a ** 2));
  const u: Point = [(hand[0] - shoulder[0]) / d, (hand[1] - shoulder[1]) / d];
  const base: Point = [shoulder[0] + u[0] * a, shoulder[1] + u[1] * a];
  return pick([round(base[0] - u[1] * h), round(base[1] + u[0] * h)], [round(base[0] + u[1] * h), round(base[1] - u[0] * h)]);
}

const lower = (a: Point, b: Point): Point => (a[1] > b[1] ? a : b);
const leftmost = (a: Point, b: Point): Point => (a[0] < b[0] ? a : b);
const rightmost = (a: Point, b: Point): Point => (a[0] > b[0] ? a : b);

/** Knees pinned on the hip→ankle line, so straight legs never kink. */
function straightKnee(hip: Point, ankle: Point): { at: Point } {
  return { at: along(hip, angle(hip, ankle), 88) };
}

// ---------------------------------------------------------------- front view, two hands

/** Pelvis height of a straight-arm hang with the hands at ±`grip`. */
const hangY = (grip: number): number => round(BAR_Y + Math.sqrt(REACH ** 2 - (grip - SHOULDER_SIDE) ** 2) + 98);
/** Pelvis at the top of the pull: chin over the bar. */
const TOP_Y = -310;

/**
 * Front-view hang or pull with the hands at ±`grip`. At the top the elbows are
 * pinned: `tucked` brings them down beside the ribs (neutral grip), otherwise
 * they fold out to the sides.
 */
function frontPull(pelvisY: number, grip: number, elbows: { near: "out" | "tucked"; far: "out" | "tucked" } | null): Pose {
  const pelvis: Point = [0, pelvisY];
  const shoulderY = pelvisY - 98;
  const hands = { near: [-grip, BAR_Y] as Point, far: [grip, BAR_Y] as Point };
  const elbowAt = (side: "near" | "far", style: "out" | "tucked"): Point => {
    const sign = side === "near" ? -1 : 1;
    const shoulder: Point = [sign * SHOULDER_SIDE, shoulderY];
    if (style === "out") return elbowBetween(shoulder, hands[side], sign < 0 ? leftmost : rightmost);
    return elbowBetween(shoulder, hands[side], lower);
  };
  return {
    pelvis,
    chest: [0, pelvisY - 80],
    hands,
    elbows: elbows
      ? { near: { at: elbowAt("near", elbows.near) }, far: { at: elbowAt("far", elbows.far) } }
      : { near: { bend: -1 }, far: { bend: 1 } },
    feet: { near: [-14, pelvisY + 173.9], far: [14, pelvisY + 173.9] },
    toes: { near: 180, far: 0 },
  };
}

const CLOSE_GRIP = 26;
/** Close grip: the shoulders stop a touch lower, or the elbows would fold past their limit. */
const CLOSE_TOP_Y = -298;
const NEUTRAL_GRIP = 50;
const MIXED_GRIP = 98;

/** Side view: the bar runs towards the viewer, so just its end shows. */
const END_BAR: Prop = { kind: "bar", y: BAR_Y, x1: 0, x2: 0, grips: [0] };

// ---------------------------------------------------------------- front view, one arm

/** The working (near, left) hand sits over the body's midline. */
const ONE_HAND: Point = [0, BAR_Y];

/**
 * One-arm hang or pull, front view. The body hangs under the working hand;
 * the free (far) arm hangs relaxed by the side. `shoulderY` sets the height
 * of the working shoulder; `cx` the chest's sideways position.
 */
function oneArm(cx: number, shoulderY: number, headDrop = 0): Pose {
  const pelvisY = shoulderY + 98;
  const shoulder: Point = [cx - SHOULDER_SIDE, shoulderY];
  const freeShoulder: Point = [cx + SHOULDER_SIDE, shoulderY];
  const straight = Math.hypot(ONE_HAND[0] - shoulder[0], ONE_HAND[1] - shoulder[1]) > LOCKED - 1;
  return {
    pelvis: [cx, pelvisY],
    chest: [cx, pelvisY - 80],
    ...(headDrop ? { head: [cx, pelvisY - 136 + headDrop] as Point } : {}),
    hands: { near: ONE_HAND, far: along(freeShoulder, 84, LOCKED) },
    elbows: {
      near: straight ? { bend: -1 } : { at: elbowBetween(shoulder, ONE_HAND, leftmost) },
      far: { at: along(freeShoulder, 84, UPPER_ARM) },
    },
    feet: { near: [cx - 12, pelvisY + 173.9], far: [cx + 12, pelvisY + 173.9] },
    toes: { near: 180, far: 0 },
  };
}

/** Shoulder to fingertip with the elbow fully locked. */
const LOCKED = 125.9;

/** Shoulder height of a straight one-arm hang with the chest at `cx`. */
const oneArmHangShoulder = (cx: number): number => round(BAR_Y + Math.sqrt(LOCKED ** 2 - (cx - SHOULDER_SIDE) ** 2));

// ---------------------------------------------------------------- side view

/** Side view: the bar end-on, both hands on it. */
const SIDE_HANDS = { near: [2, BAR_Y] as Point, far: [-2, BAR_Y] as Point };

/**
 * Side-view pull. `shoulder` is where the shoulder is; `lean` the spine
 * direction from the pelvis (-90 upright, below -90 leaning back); `legDeg` the
 * direction of the straight legs from the pelvis (90 = straight down).
 * The elbows fold down in front of the body (or behind it with `elbowsBack`).
 */
function sidePull(
  shoulder: Point,
  lean: number,
  legDeg: number,
  opts: { headTilt?: number; arch?: boolean; feet?: Pose["feet"]; knees?: Pose["knees"] } = {},
): Pose {
  const pelvis = along(shoulder, lean + 180, 98);
  const chest = along(pelvis, lean, 80);
  const reach = (hand: Point) => Math.hypot(hand[0] - shoulder[0], hand[1] - shoulder[1]);
  const elbow = (hand: Point): JointHint =>
    reach(hand) > REACH - 1
      ? { bend: 1 }
      : { at: elbowBetween(shoulder, hand, lower) };
  const ankleNear = along(pelvis, legDeg, LEG);
  const ankleFar = along(pelvis, legDeg + 1, LEG);
  return {
    pelvis,
    chest,
    // Head tipped back a touch (chest up, eyes on the bar), so it stays behind the arms all the way up.
    head: along(chest, lean + (opts.headTilt ?? -10), 54),
    spine: opts.arch ? { bend: 1 } : undefined,
    hands: SIDE_HANDS,
    elbows: { near: elbow(SIDE_HANDS.near), far: elbow(SIDE_HANDS.far) },
    knees: opts.knees ?? { near: straightKnee(pelvis, ankleNear), far: straightKnee(pelvis, ankleFar) },
    feet: opts.feet ?? { near: ankleNear, far: ankleFar },
    toes: { near: legDeg - 70, far: legDeg - 70 },
  };
}

/** Straight-arm side hang: shoulder an arm's length from the hands, a little behind the bar (chest up). */
const SIDE_HANG_SHOULDER: Point = along(SIDE_HANDS.near, 108, REACH);
/** Top of an upright pull: shoulder behind the bar so the head clears it, chin over. */
const SIDE_TOP_SHOULDER: Point = [-30, -410];

const sideHang = (legDeg = 86): Pose => sidePull(SIDE_HANG_SHOULDER, -95, legDeg);
const sideTop = (legDeg = 86): Pose => sidePull(SIDE_TOP_SHOULDER, -92, legDeg);

// L-sit pull-up: legs straight out level, hips behind the bar to balance them.
const lHang = (): Pose => sidePull(along(SIDE_HANDS.near, 110, REACH), -100, 0);
const lTop = (): Pose => sidePull([-32, -408], -100, 0);

// Headbanger: at the top, pushed back from the bar on half-bent arms, then pulled back in.
const bangAway = (): Pose => sidePull([-104, -396], -95, 84);

// Gironda sternum chin: leaning back, chest up, pulling the lower chest to the bar.
function girondaHang(): Pose {
  const shoulder = along(SIDE_HANDS.near, 102, REACH);
  return sidePull(shoulder, -112, 72);
}

function girondaTop(): Pose {
  // Reclined; the bar meets the front of the lower chest (the spine line runs just under it),
  // shoulders level with the bar and behind it, elbows driven down and back, head back.
  const lean = -140;
  const chest = along([0, BAR_Y], lean + 90 + 180, 22);
  const shoulder = along(chest, lean, 18);
  return sidePull(shoulder, lean, 50, { headTilt: -20, arch: true });
}

// ---------------------------------------------------------------- box behind the hang (top hold, negative)

const BOX_TOP = -150;
const BOX: Prop = { kind: "box", x: -190, y: BOX_TOP, w: 112, h: -BOX_TOP };
/** Ankle on the box, toes forward to its front edge. */
const BOX_ANKLE: Point = [-97, BOX_TOP - 3];

/** Legs from the hips: knees bent forward (pinned) to ankles at `ankle`. */
function legsTo(pose: Pose, ankle: Point, toe: number, bend: 1 | -1 = -1): Pose {
  return { ...pose, knees: { near: { bend }, far: { bend } }, feet: { near: ankle, far: ankle }, toes: { near: toe, far: toe } };
}

/** Top of the pull with the feet standing on the box behind. */
const topOnBox = (): Pose => legsTo(sideTop(), BOX_ANKLE, 0);

/** Top of the pull, feet lifted just off the box (on the way off it or back onto it). */
const topLiftOff = (): Pose => legsTo(sideTop(), [BOX_ANKLE[0] + 8, BOX_TOP - 22], 0);

/** Top of the pull, feet stepped off the box: legs hanging in front of it, knees a little bent. */
function topFeetUp(shoulder: Point = SIDE_TOP_SHOULDER): Pose {
  const pose = sidePull(shoulder, -92, 90);
  const pelvis = pose.pelvis as Point;
  return legsTo(pose, [pelvis[0] - 14, pelvis[1] + 154], 20);
}

/** Shoulder on the way down a slow negative: `t` 0 = top, 1 = straight-arm hang. */
const negativeShoulder = (t: number): Point => [
  round(SIDE_TOP_SHOULDER[0] + (SIDE_HANG_SHOULDER[0] - SIDE_TOP_SHOULDER[0]) * t),
  round(SIDE_TOP_SHOULDER[1] + (SIDE_HANG_SHOULDER[1] - SIDE_TOP_SHOULDER[1]) * t),
];

const negativeAt = (t: number): Pose => topFeetUp(negativeShoulder(t));

/** At the bottom: knees drawn up in front of the box, feet above its top. */
function kneesUp(share = 1): Pose {
  const pose = sideHang();
  const pelvis = pose.pelvis as Point;
  return legsTo(pose, [pelvis[0] - 30 * share + 6 * (1 - share), pelvis[1] + 25 + 120 * (1 - share)], 10 + 40 * (1 - share));
}

/** Rising again on the legs: feet coming back over the box. */
function feetOver(): Pose {
  return legsTo(negativeAt(0.8), [BOX_ANKLE[0] + 2, BOX_TOP - 18], 0);
}

const NEGATIVE_STEPS = [0.15, 0.3, 0.45, 0.6, 0.75, 0.9];

const SIDE_BAR_PROPS: Prop[] = [END_BAR];

export const BATCH_V_SPECS: DoodleSpec[] = [
  {
    id: "hf_46",
    slug: "close-grip-pull-up",
    title: "Close-Grip Pull-Up",
    view: "front",
    props: [{ kind: "bar", y: BAR_Y, x1: -150, x2: 150, grips: [-CLOSE_GRIP, CLOSE_GRIP] }],
    transition: 1,
    frames: [
      { hold: 0.5, pose: frontPull(hangY(CLOSE_GRIP), CLOSE_GRIP, null) },
      { hold: 0.4, pose: frontPull(CLOSE_TOP_Y, CLOSE_GRIP, { near: "out", far: "out" }) },
    ],
  },
  {
    id: "hf_47",
    slug: "neutral-grip-pull-up",
    title: "Neutral-Grip Pull-Up",
    view: "front",
    props: [{ kind: "bar", y: BAR_Y, x1: -150, x2: 150, grips: [-NEUTRAL_GRIP, NEUTRAL_GRIP] }],
    transition: 1,
    frames: [
      { hold: 0.5, pose: frontPull(hangY(NEUTRAL_GRIP), NEUTRAL_GRIP, null) },
      { hold: 0.4, pose: frontPull(TOP_Y, NEUTRAL_GRIP, { near: "tucked", far: "tucked" }) },
    ],
  },
  {
    id: "wger_1738",
    slug: "neutral-grip-pull-ups-trx",
    title: "Neutral-grip pull-ups or TRX rows",
    view: "front",
    props: [{ kind: "bar", y: BAR_Y, x1: -150, x2: 150, grips: [-NEUTRAL_GRIP, NEUTRAL_GRIP] }],
    transition: 1,
    frames: [
      { hold: 0.5, pose: frontPull(hangY(NEUTRAL_GRIP), NEUTRAL_GRIP, null) },
      { hold: 0.4, pose: frontPull(TOP_Y, NEUTRAL_GRIP, { near: "tucked", far: "tucked" }) },
    ],
  },
  {
    id: "fedb_mixed_grip_chin",
    slug: "mixed-grip-chin",
    title: "Mixed Grip Chin",
    view: "front",
    props: [{ kind: "bar", y: BAR_Y, x1: -170, x2: 170, grips: [-MIXED_GRIP, MIXED_GRIP] }],
    transition: 1,
    frames: [
      { hold: 0.5, pose: frontPull(hangY(MIXED_GRIP), MIXED_GRIP, null) },
      // The underhand (near) elbow stays closer to the body.
      { hold: 0.4, pose: frontPull(TOP_Y, MIXED_GRIP, { near: "tucked", far: "out" }) },
    ],
  },
  {
    id: "hf_52",
    slug: "one-arm-pull-up",
    title: "One-Arm Pull-Up",
    view: "front",
    props: [{ kind: "bar", y: BAR_Y, x1: -150, x2: 150, grips: [0] }],
    transition: 1.2,
    frames: [
      { hold: 0.5, pose: oneArm(SHOULDER_SIDE + 4, oneArmHangShoulder(SHOULDER_SIDE + 4)) },
      { hold: 0.4, pose: oneArm(40, -404) },
    ],
  },
  {
    id: "fedb_one_handed_hang",
    slug: "one-handed-hang",
    title: "One Handed Hang",
    view: "front",
    props: [{ kind: "bar", y: BAR_Y, x1: -150, x2: 150, grips: [0] }],
    transition: 1.4,
    frames: [
      // Shoulder relaxed up round the ear (head sunk), then drawn down so the head rises; body still.
      { hold: 1, pose: oneArm(SHOULDER_SIDE + 2, oneArmHangShoulder(SHOULDER_SIDE + 2), 4) },
      { hold: 2, pose: oneArm(SHOULDER_SIDE + 2, oneArmHangShoulder(SHOULDER_SIDE + 2)) },
    ],
  },
  {
    id: "hf_49",
    slug: "l-sit-pull-up",
    title: "L-Sit Pull-Up",
    props: SIDE_BAR_PROPS,
    transition: 1,
    frames: [
      { hold: 0.5, pose: lHang() },
      { hold: 0.4, pose: lTop() },
    ],
  },
  {
    id: "hf_63",
    slug: "headbanger-pull-up",
    title: "Headbanger Pull-Up",
    props: SIDE_BAR_PROPS,
    transition: 0.7,
    frames: [
      { hold: 0.4, pose: sideHang() },
      { hold: 0.2, pose: sideTop() },
      { hold: 0.15, pose: bangAway() },
      { hold: 0.2, pose: sideTop() },
      { hold: 0.15, pose: bangAway() },
      { hold: 0.3, pose: sideTop() },
    ],
  },
  {
    id: "fedb_gironda_sternum_chins",
    slug: "gironda-sternum-chin",
    title: "Gironda Sternum Chins",
    props: SIDE_BAR_PROPS,
    transition: 1.1,
    frames: [
      { hold: 0.5, pose: girondaHang() },
      { hold: 0.5, pose: girondaTop() },
    ],
  },
  {
    id: "wger_2731",
    slug: "pull-up-top-hold",
    title: "Pull-Up Top Position Hold",
    props: [END_BAR, BOX],
    transition: 0.8,
    frames: [
      { hold: 0.5, pose: topOnBox() },
      { hold: 0, pose: topLiftOff() },
      { hold: 2.6, pose: topFeetUp() },
      { hold: 0, pose: topLiftOff() },
    ],
  },
  {
    id: "wger_2730",
    slug: "slow-eccentric-pull-up",
    title: "Slow Eccentric Pull-Up Negative",
    props: [END_BAR, BOX],
    transition: 0.5,
    frames: [
      { hold: 0.3, pose: topOnBox() },
      { hold: 0, pose: topLiftOff() },
      { hold: 0.2, pose: topFeetUp() },
      ...NEGATIVE_STEPS.map((t) => ({ hold: 0, pose: negativeAt(t) })),
      { hold: 0.3, pose: negativeAt(1) },
      // Knees drawn up in front of the box, then the feet set back on it to stand up to the top.
      { hold: 0, pose: kneesUp(0.4) },
      { hold: 0, pose: kneesUp() },
      { hold: 0, pose: feetOver() },
    ],
  },
];
