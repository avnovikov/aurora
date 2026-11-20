import { BONES, deg, SEGMENTS, solvePose, zOut } from "./rig";
import type { DoodleSpec, Keyframe, Point, Pose, Prop, Side, Sideways } from "./rig";
import { add3, dot3, scale3, sub3, type Point3 } from "./rig3d";
import { ARM, chain, CIRCLE_PHASES, dirs, flat, LEG, type LimbSpec, type Plan, REACH, roots, rootsOf, SIDES, type Spine, unit3 } from "./limbs3";
import { TOP_VIEWS, TWO_VIEWS } from "./sideways";
import { along, chestOf, FLOOR_PROP, round, supineTorso } from "./geom";

/**
 * Batch BA (#216): shoulder, arm and chest stretches. Floor at y = 0, up is
 * negative, the side-view figure faces +x; lying face up has the head at -x.
 * Never import ./specs (circular).
 *
 * Where an arm or knee goes out to the side, the move is drawn in two views and
 * the limbs are placed in 3D by `chain` (exact bone lengths); `frame` turns the
 * plans into pins and the keyframe's `sideways` positions.
 *
 * Left out:
 *   wger_1712  Horizontal Shoulder Flexion Stretch: the text describes a wall chest
 *     stretch (hand fixed on the wall, arm out to the side, body turned away), which is
 *     not what the name says (a cross-body arm stretch), and its main motion is the trunk
 *     turning about the vertical axis while the hand stays put. The rig cannot turn the
 *     shoulders about the spine, and no side, front or top view shows that turn, so no
 *     honest picture exists for either reading.
 */

// ---------------------------------------------------------------- 3D limb placement

/** A straight arm from `root` along `d`. */
const straightArm = (root: Point3, d: Point3): Plan => dirs(root, ARM, d, d);

/**
 * The elbow `ARM[0]` from the shoulder along `e`, the forearm folded back `bendDeg` from the upper arm
 * towards `towards` (a direction), so the fingertips land by the shoulder.
 */
function foldedArm(root: Point3, e: Point3, towards: Point3, bendDeg = 154): Plan {
  const u = unit3(e);
  const mid = add3(root, scale3(u, ARM[0]));
  const w = unit3(sub3(towards, scale3(u, dot3(towards, u))));
  const r = deg(bendDeg);
  return { mid, end: add3(mid, scale3(add3(scale3(u, Math.cos(r)), scale3(w, Math.sin(r))), ARM[1])) };
}

interface Limbs {
  arms?: Partial<Record<Side, LimbSpec>>;
  legs?: Partial<Record<Side, LimbSpec>>;
}

/** Arms of a keyframe as hand and elbow pins, with their sideways positions. */
function addArms(pose: Pose, sideways: Sideways, arms: NonNullable<Limbs["arms"]>): void {
  const hands: Partial<Record<Side, Point>> = {};
  const elbows: Partial<Record<Side, { at: Point }>> = {};
  const swHands: Partial<Record<Side, number>> = {};
  const swElbows: Partial<Record<Side, { at: number }>> = {};
  for (const side of SIDES) {
    const arm = arms[side];
    if (!arm) continue;
    hands[side] = flat(arm.plan.end);
    elbows[side] = { at: flat(arm.plan.mid) };
    swHands[side] = round(arm.plan.end[2]);
    swElbows[side] = { at: round(arm.plan.mid[2]) };
  }
  Object.assign(pose, { hands, elbows });
  Object.assign(sideways, { hands: swHands, elbows: swElbows });
}

/** Legs of a keyframe as ankle, knee and foot-angle pins, with their sideways positions. */
function addLegs(pose: Pose, sideways: Sideways, legs: NonNullable<Limbs["legs"]>): void {
  const feet: Partial<Record<Side, Point>> = {};
  const knees: Partial<Record<Side, { at: Point }>> = {};
  const toes: Partial<Record<Side, number>> = {};
  const swFeet: Partial<Record<Side, number>> = {};
  const swKnees: Partial<Record<Side, { at: number }>> = {};
  for (const side of SIDES) {
    const leg = legs[side];
    if (!leg) continue;
    feet[side] = flat(leg.plan.end);
    knees[side] = { at: flat(leg.plan.mid) };
    toes[side] = leg.toe ?? 0;
    swFeet[side] = round(leg.plan.end[2]);
    swKnees[side] = { at: round(leg.plan.mid[2]) };
  }
  Object.assign(pose, { feet, knees, toes });
  Object.assign(sideways, { feet: swFeet, knees: swKnees });
}

/** A keyframe: the spine, plus limb plans that become pins and `sideways` positions. */
export function frame(hold: number, spine: Spine, limbs: Limbs): Keyframe {
  const pose: Pose = { ...spine };
  const sideways: Sideways = { pelvis: 0 };
  if (limbs.arms) addArms(pose, sideways, limbs.arms);
  if (limbs.legs) addLegs(pose, sideways, limbs.legs);
  return { hold, pose, sideways };
}

// ---------------------------------------------------------------- standing base

const STAND: Spine = { pelvis: [0, -174], chest: [0, -254] };
const STAND_ROOTS = roots(STAND);

/** Straight legs, feet a hip-width apart, flat on the floor. */
function standLegs(spine: Spine): Limbs["legs"] {
  const { leg } = roots(spine);
  const out = {} as Record<Side, LimbSpec>;
  for (const side of SIDES) {
    const hip = leg[side];
    out[side] = { plan: chain(hip, LEG, [hip[0], 0, zOut(side) * 14], [hip[0] + 40, -90, hip[2]]), toe: 0 };
  }
  return out;
}

/** Feet hip-width apart, flat. */
const STAND_FEET: Pose["feet"] = { near: [10, -1], far: [-8, -1] };

// ---------------------------------------------------------------- shoulder rotations and elbow circles (side + front)

/**
 * Elbow direction on a cone of half-angle `half` degrees round the outward axis:
 * `phase` 0 forward, 90 up, 180 back, 270 down. The wider the cone, the nearer the
 * elbow comes to the front of the body (a shoulder roll); the narrower, the more it
 * stays out to the side (an elbow circle at shoulder height).
 */
function elbowDir(side: Side, phase: number, half: number, lift = 0): Point3 {
  const h = deg(half);
  // Strongest over the front-up quarter, none once the elbow is behind the shoulder.
  const up = Math.max(0, Math.sin(deg(phase))) * Math.min(1, Math.max(0, 0.5 + Math.cos(deg(phase))));
  return [Math.sin(h) * Math.cos(deg(phase)) + lift * up, -Math.sin(h) * Math.sin(deg(phase)), zOut(side) * Math.cos(h)];
}

/**
 * Fingertips on the shoulders, the elbows on the cone at `phase`; the forearms stay folded to the shoulders.
 * `lift` tips the upper half of the circle forward, so a raised elbow passes in front of the face, not through the head.
 */
function elbowRound(phase: number, half: number, lift = 0): Keyframe {
  const { arm } = STAND_ROOTS;
  const arms = {} as Record<Side, LimbSpec>;
  for (const side of SIDES) {
    const s = arm[side];
    arms[side] = { plan: foldedArm(s, elbowDir(side, phase, half, lift), [0.8, 0.6, zOut(side) * 0.1]) };
  }
  return frame(0, STAND, { arms, legs: standLegs(STAND) });
}

/**
 * Shoulder rolls: the elbows lead big circles in front of the shoulders. Forward goes back, up, forward, down
 * (phase 180 to 270 to 360). The face looks ahead (nose tick) so forward and backward read apart.
 */
const ROLL_HALF = 68;
const ROLL_LIFT = 1.6;
const rollFrames = (forward: boolean): Keyframe[] =>
  [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ ...elbowRound(180 + (forward ? -1 : 1) * i * 45, ROLL_HALF, ROLL_LIFT), face: { turn: 0 } }));

/** Elbow circles: out at shoulder height, one turn one way, then back the other ("reverse direction partway through"). */
const CIRCLE_HALF = 50;

// ---------------------------------------------------------------- behind head chest stretch (seated, side + front)

const SEAT_PELVIS: Point = [0, -12];
const SEAT: Spine = { pelvis: SEAT_PELVIS, chest: chestOf(SEAT_PELVIS, -90) };
const SEAT_ROOTS = roots(SEAT);

/** Seated tall, knees a little bent, feet on the floor out front. */
function seatLegs(): Limbs["legs"] {
  const { leg } = SEAT_ROOTS;
  const out = {} as Record<Side, LimbSpec>;
  for (const side of SIDES) {
    const hip = leg[side];
    out[side] = { plan: chain(hip, LEG, [168, -3, zOut(side) * 16], [80, -70, hip[2]]), toe: -80 };
  }
  return out;
}

/** Fingers laced behind the head; the elbows wide and a little forward (`back` 0) or drawn back (1). */
function behindHead(back: number, hold: number): Keyframe {
  const spine: Spine = { ...SEAT, chest: [round(-4 * back), SEAT.chest ? SEAT.chest[1] : -92] };
  const solved = solvePose(spine);
  const { arm } = rootsOf(solved);
  const arms = {} as Record<Side, LimbSpec>;
  for (const side of SIDES) {
    const s = arm[side];
    const hand: Point3 = [solved.head[0] - 20, solved.head[1] + 2, zOut(side) * 9];
    const hint: Point3 = [s[0] + 40 - 120 * back, s[1] - 20, zOut(side) * 100];
    arms[side] = { plan: chain(s, ARM, hand, hint) };
  }
  return frame(hold, spine, { arms, legs: seatLegs() });
}

// ---------------------------------------------------------------- lying knee across (bent-knee iron cross, side + top)

const IC_PELVIS: Point = [-8, -20];
const IC_TORSO = supineTorso(IC_PELVIS, 77);
const IC_SPINE: Spine = { pelvis: IC_TORSO.pelvis, chest: IC_TORSO.chest, head: IC_TORSO.head, spine: IC_TORSO.spine };

type CrossStage = "rest" | "tuck" | "cross";

/**
 * On the back, arms out in a T on the floor. The working leg (`side`) goes from
 * straight to the knee tucked up, then falls across the body to the other side
 * (z towards the opposite side), the shin returning towards the centre; the other
 * leg stays straight on the floor.
 */
function ironCross(working: Side | null, stage: CrossStage, hold: number): Keyframe {
  const { arm, leg } = roots(IC_SPINE);
  const arms = {} as Record<Side, LimbSpec>;
  for (const side of SIDES) {
    const s = arm[side];
    arms[side] = { plan: chain(s, ARM, [s[0], -6, zOut(side) * (Math.abs(s[2]) + REACH)], [s[0] - 20, -30, s[2]]) };
  }
  const legs = {} as Record<Side, LimbSpec>;
  for (const side of SIDES) {
    const hip = leg[side];
    const straightPlan = dirs(hip, LEG, [1, 0.07, 0], [1, 0.07, 0]);
    if (side !== working || stage === "rest") {
      legs[side] = { plan: straightPlan, toe: -82 };
    } else if (stage === "tuck") {
      legs[side] = { plan: dirs(hip, LEG, [-0.3, -0.95, 0], [0.7, 0.7, 0]), toe: 50 };
    } else {
      const across = -zOut(side);
      legs[side] = { plan: dirs(hip, LEG, [0.2, -0.2, across * 0.96], [0.7, 0.35, -across * 0.6]), toe: 10 };
    }
  }
  return frame(hold, IC_SPINE, { arms, legs });
}

// ---------------------------------------------------------------- hands clasped behind the back (side view)

/** Hands clasped behind the back, arms straight; `lift` degrees back from straight down. */
function claspBehind(lift: number, chestBack: number): Pose {
  const chest: Point = [round(-chestBack), -254 + (chestBack > 0 ? 1 : 0)];
  const shoulder = solvePose({ pelvis: STAND.pelvis, chest }).arms.near.root;
  const hand = along(shoulder, 90 + lift, REACH + 0.3);
  return {
    pelvis: STAND.pelvis,
    chest,
    hands: { near: hand, far: hand },
    feet: STAND_FEET,
    toes: { near: 0, far: 0 },
  };
}

// ---------------------------------------------------------------- dynamic chest stretch (side + front)

/**
 * Arms straight at shoulder height. `open` 0: out in front, hands together;
 * 1: swung out to the sides and a little back as far as is comfortable.
 */
function chestOpen(open: number, hold: number): Keyframe {
  const { arm } = STAND_ROOTS;
  const swing = deg(open * 100);
  const arms = {} as Record<Side, LimbSpec>;
  for (const side of SIDES) {
    const s = arm[side];
    // At 0 the hands come together in front of the chest (each arm slants in from its shoulder).
    const d: Point3 = open === 0 ? [0.985, 0, -zOut(side) * 0.17] : [Math.cos(swing), 0, zOut(side) * Math.sin(swing)];
    arms[side] = { plan: straightArm(s, d) };
  }
  return frame(hold, STAND, { arms, legs: standLegs(STAND) });
}

// ---------------------------------------------------------------- elbows back (hands on the lower back, side + front)

/** Hands on the lower back, fingers down; the elbows out to the sides (`back` 0) or drawn back towards each other (1). */
function elbowsBack(back: number, hold: number): Keyframe {
  const spine: Spine = { pelvis: STAND.pelvis, chest: [round(-5 * back), -254] };
  const { arm } = roots(spine);
  const arms = {} as Record<Side, LimbSpec>;
  for (const side of SIDES) {
    const s = arm[side];
    const hand: Point3 = [-14, -196, zOut(side) * 14];
    const hint: Point3 = [s[0] - 90 * back, s[1] + 30, zOut(side) * (120 - 70 * back)];
    arms[side] = { plan: chain(s, ARM, hand, hint) };
  }
  return frame(hold, spine, { arms, legs: standLegs(spine) });
}

// ---------------------------------------------------------------- elevated prayer stretch (side view)

const PR_BENCH_X = 94;
const PR_BENCH: Prop = { kind: "box", x: PR_BENCH_X, y: -88, w: 120, h: 88 };
const PR_PELVIS: Point = [-53, -91.8];
const PR_KNEE: Point = [-48, -4.3];

/**
 * Neck relaxed: the head as near in line with the spine as it can be while its circle stays in
 * front of the bench (at most touching the front face), between the upper arms, never hanging.
 */
function prayerHead(chest: Point, tilt: number): Point {
  const neck = along(chest, tilt, BONES.chestNeck);
  const maxX = PR_BENCH_X - SEGMENTS.headRadius + 2;
  const clear = (Math.acos(Math.min(1, (maxX - neck[0]) / BONES.neckHead)) * 180) / Math.PI;
  return along(neck, Math.max(tilt + 6, clear), BONES.neckHead);
}

/**
 * Kneeling at a bench, hips over the knees, elbows on the bench with the palms
 * together. `sink` 0: chest high, forearms upright; 1: the chest has sunk and the
 * hands have dropped behind the head towards the shoulder blades.
 */
function prayer(sink: number): Pose {
  const tilt = 6 + 11 * sink;
  const lean = along(PR_PELVIS, tilt, 80);
  const shoulder = along(PR_PELVIS, tilt, 98);
  const elbow: Point = [round(shoulder[0] + Math.sqrt(59.5 ** 2 - (-91 - shoulder[1]) ** 2)), -91];
  const hand = along(elbow, -90 - 70 * sink, BONES.forearm + BONES.hand);
  return {
    pelvis: PR_PELVIS,
    chest: lean,
    head: prayerHead(lean, tilt),
    hands: { near: hand, far: hand },
    elbows: { near: { at: elbow }, far: { at: elbow } },
    knees: { near: { at: PR_KNEE }, far: { at: PR_KNEE } },
    feet: { near: [-134, -4], far: [-134, -4] },
    toes: { near: 180, far: 180 },
  };
}

// ---------------------------------------------------------------- extreme shoulder stretch (side view)

/** Seated, hands on the floor behind with the fingers pointing away; the hips walk forward away from the hands. */
function reverseSeat(pelvisX: number, pelvisY: number): Pose {
  return {
    pelvis: [pelvisX, pelvisY],
    hands: { near: [-70, -4], far: [-70, -4] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: [108, -2], far: [96, -2] },
    toes: { near: -80, far: -80 },
  };
}

export const BATCH_BA_SPECS: DoodleSpec[] = [
  {
    id: "wger_1004",
    slug: "forward-shoulder-rotation",
    title: "Forward shoulder rotation",
    views: TWO_VIEWS,
    props: [FLOOR_PROP],
    transition: 0.3,
    frames: rollFrames(true),
  },
  {
    id: "wger_1005",
    slug: "backward-shoulder-rotation",
    title: "Backward shoulder rotation",
    views: TWO_VIEWS,
    props: [FLOOR_PROP],
    transition: 0.3,
    frames: rollFrames(false),
  },
  {
    id: "fedb_elbow_circles",
    slug: "elbow-circles",
    title: "Elbow Circles",
    views: TWO_VIEWS,
    props: [FLOOR_PROP],
    transition: 0.3,
    frames: CIRCLE_PHASES.map((p) => elbowRound(p, CIRCLE_HALF)),
  },
  {
    id: "fedb_behind_head_chest_stretch",
    slug: "behind-head-chest-stretch",
    title: "Behind Head Chest Stretch",
    views: TWO_VIEWS,
    props: [FLOOR_PROP],
    transition: 1.2,
    frames: [behindHead(0, 0.5), behindHead(1, 1.2), behindHead(0.85, 1)],
  },
  {
    id: "wger_1953",
    slug: "bent-knee-iron-cross",
    title: "Bent-knee Iron Cross",
    views: TOP_VIEWS,
    transition: 0.9,
    frames: [
      ironCross(null, "rest", 0.4),
      ironCross("near", "tuck", 0.2),
      ironCross("near", "cross", 1),
      ironCross("near", "tuck", 0.2),
      ironCross("far", "tuck", 0.2),
      ironCross("far", "cross", 1),
      ironCross("far", "tuck", 0.2),
    ],
  },
  {
    id: "wger_1536",
    slug: "delt-stretch",
    title: "Delt Stretch",
    props: [FLOOR_PROP],
    transition: 1.3,
    frames: [
      { hold: 0.5, pose: claspBehind(18, 0) },
      { hold: 1.2, pose: claspBehind(48, 4) },
      { hold: 1, pose: claspBehind(44, 4) },
    ],
  },
  {
    id: "fedb_dynamic_chest_stretch",
    slug: "dynamic-chest-stretch",
    title: "Dynamic Chest Stretch",
    views: TWO_VIEWS,
    props: [FLOOR_PROP],
    transition: 0.7,
    frames: [chestOpen(0, 0.2), chestOpen(1, 0.2)],
  },
  {
    id: "fedb_elbows_back",
    slug: "elbows-back",
    title: "Elbows Back",
    views: TWO_VIEWS,
    props: [FLOOR_PROP],
    transition: 1.2,
    frames: [elbowsBack(0, 0.5), elbowsBack(1, 1.2), elbowsBack(0.85, 1)],
  },
  {
    id: "wger_1027",
    slug: "elevated-prayer-stretch",
    title: "Elevated prayer stretch",
    props: [FLOOR_PROP, PR_BENCH],
    transition: 1.5,
    frames: [
      { hold: 0.5, pose: prayer(0) },
      { hold: 1.4, pose: prayer(1) },
      { hold: 1, pose: prayer(0.85) },
    ],
  },
  {
    id: "wger_1920",
    slug: "extreme-shoulder-stretch",
    title: "Extreme Shoulder Stretch",
    props: [FLOOR_PROP],
    transition: 1.5,
    frames: [
      { hold: 0.5, pose: reverseSeat(-8, -12) },
      { hold: 1.3, pose: reverseSeat(44, -30) },
      { hold: 1, pose: reverseSeat(40, -28) },
    ],
  },
];
