import { BONES, HIP_SIDE, SHOULDER_SIDE, solvePose, zOut } from "./rig";
import type { DoodleSpec, Keyframe, Point, Pose, Prop, Side, Sideways } from "./rig";
import { add3, dot3, norm3, scale3, solveKeyframe3, sub3, type Point3 } from "./rig3d";
import { TOP_VIEWS, TWO_VIEWS } from "./sideways";
import { FLOOR_PROP, along, round } from "./geom";
import { plank } from "./specsBatchI";
import { SL_FOOT_BOTTOM, SL_FOOT_TOP, SL_HIP_BOTTOM, SL_HIP_TOP, SL_KNEE_BOTTOM, SL_KNEE_TOP } from "./specsWarmup";

/**
 * Batch BG (#216): spine, back and core mobility. Floor at y = 0, up is
 * negative, the side-view figure faces +x; lying face up has the head at -x,
 * lying face down has the head at +x. Import only from ./rig, ./geom and other
 * batch files, never from ./specs (that would be circular).
 */

const THIGH = BONES.thigh;
const SHIN = BONES.shin;
const REACH = 125.4;
/** Shoulder to fingertip of a straight arm. */
const STRAIGHT = BONES.upperArm + BONES.forearm + BONES.hand - 0.05;

const shoulderAt = (pose: Pose): Point => solvePose(pose).arms.near.root;

/** Where circles around `a` (radius ra) and `b` (radius rb) meet; `pick` chooses between the two points. */
function meet(a: Point, ra: number, b: Point, rb: number, pick: (p: Point, q: Point) => boolean): Point {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const x = (ra * ra - rb * rb + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, ra * ra - x * x));
  const ux = (b[0] - a[0]) / d;
  const uy = (b[1] - a[1]) / d;
  const p: Point = [round(a[0] + ux * x - uy * h), round(a[1] + uy * x + ux * h)];
  const q: Point = [round(a[0] + ux * x + uy * h), round(a[1] + uy * x - ux * h)];
  return pick(p, q) ? p : q;
}


// ---------------------------------------------------------------- 3D limb placement (twists, side bends)

/** Unit vector; a zero vector stays zero. */
const unit3 = (a: Point3): Point3 => scale3(a, 1 / (norm3(a) || 1));
const dir3 = (degrees: number, z = 0): Point3 => [Math.cos((degrees * Math.PI) / 180), Math.sin((degrees * Math.PI) / 180), z];

interface Plan {
  mid: Point3;
  end: Point3;
}

const ARM: [number, number] = [BONES.upperArm, BONES.forearm + BONES.hand];
const LEG: [number, number] = [BONES.thigh, BONES.shin];

/** A limb from `root` reaching `end` (pulled in if too far), the middle joint on the `hint` side of the line. */
function chain(root: Point3, [l1, l2]: [number, number], end: Point3, hint: Point3): Plan {
  const full = sub3(end, root);
  const d = Math.min(Math.max(norm3(full), Math.abs(l1 - l2) + 1), l1 + l2 - 0.3);
  const u = unit3(full);
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const centre = add3(root, scale3(u, a));
  const toHint = sub3(hint, centre);
  let n = sub3(toHint, scale3(u, dot3(toHint, u)));
  if (norm3(n) < 1e-6) n = sub3([0, -1, 0], scale3(u, u[1] * -1));
  return { mid: add3(centre, scale3(unit3(n), h)), end: add3(root, scale3(u, d)) };
}

/** A limb given as two directions: the upper bone, then the lower. */
function dirs(root: Point3, [l1, l2]: [number, number], d1: Point3, d2: Point3): Plan {
  const mid = add3(root, scale3(unit3(d1), l1));
  return { mid, end: add3(mid, scale3(unit3(d2), l2)) };
}

interface LimbSpec {
  plan: Plan;
  toe?: number;
}

type Spine = Pick<Pose, "pelvis" | "chest" | "head" | "spine">;

/** Where limbs root: the solved spine's shoulders and hips, set out sideways about the spine at z = `pz`. */
function roots(spine: Spine, pz = 0): { arm: Record<Side, Point3>; leg: Record<Side, Point3> } {
  const solved = solvePose(spine);
  const arm = {} as Record<Side, Point3>;
  const leg = {} as Record<Side, Point3>;
  for (const side of ["near", "far"] as Side[]) {
    const a = solved.arms[side].root;
    const l = solved.legs[side].root;
    arm[side] = [a[0], a[1], pz + zOut(side) * SHOULDER_SIDE];
    leg[side] = [l[0], l[1], pz + zOut(side) * HIP_SIDE];
  }
  return { arm, leg };
}

const flat = (p: Point3): Point => [round(p[0]), round(p[1])];

/** A keyframe: the spine, plus 3D limb plans that become pins and `sideways` positions. */
function frame(hold: number, spine: Spine, limbs: { arms?: Partial<Record<Side, LimbSpec>>; legs?: Partial<Record<Side, LimbSpec>> }): Keyframe {
  const pose: Pose = { ...spine };
  const sideways: Sideways = { pelvis: 0 };
  const hands: Partial<Record<Side, Point>> = {};
  const elbows: Partial<Record<Side, { at: Point }>> = {};
  const swHands: Partial<Record<Side, number>> = {};
  const swElbows: Partial<Record<Side, { at: number }>> = {};
  const feet: Partial<Record<Side, Point>> = {};
  const knees: Partial<Record<Side, { at: Point }>> = {};
  const toes: Partial<Record<Side, number>> = {};
  const swFeet: Partial<Record<Side, number>> = {};
  const swKnees: Partial<Record<Side, { at: number }>> = {};
  for (const side of ["near", "far"] as Side[]) {
    const arm = limbs.arms?.[side];
    if (arm) {
      hands[side] = flat(arm.plan.end);
      elbows[side] = { at: flat(arm.plan.mid) };
      swHands[side] = round(arm.plan.end[2]);
      swElbows[side] = { at: round(arm.plan.mid[2]) };
    }
    const leg = limbs.legs?.[side];
    if (leg) {
      feet[side] = flat(leg.plan.end);
      knees[side] = { at: flat(leg.plan.mid) };
      toes[side] = leg.toe ?? 0;
      swFeet[side] = round(leg.plan.end[2]);
      swKnees[side] = { at: round(leg.plan.mid[2]) };
    }
  }
  if (limbs.arms) {
    Object.assign(pose, { hands, elbows });
    Object.assign(sideways, { hands: swHands, elbows: swElbows });
  }
  if (limbs.legs) {
    Object.assign(pose, { feet, knees, toes });
    Object.assign(sideways, { feet: swFeet, knees: swKnees });
  }
  return { hold, pose, sideways };
}

// ---------------------------------------------------------------- core rotation (seated V, hands touch the floor beside the hips)

const CR_PELVIS: Point = [0, -14];

/**
 * The shoulder line rolls about the leaned-back spine (+ twist turns the chest to the near side) and both
 * hands swing to the floor beside the near hip (`turn` -1), up through the middle, to the far hip (+1).
 * The head turns with the chest.
 */
const CR_TWIST = 65;

function coreRotation(turn: number): Keyframe {
  const pelvis = CR_PELVIS;
  const chest = along(pelvis, 247, 80);
  const spine: Spine = { pelvis, chest, head: along(chest, 247, 56) };
  const { leg } = roots(spine);
  const twist = -CR_TWIST * turn;
  const turned: Sideways = { pelvis: 0, twist };
  const arm = solveKeyframe3(solvePose(spine), spine, turned).arms;
  const legs: { near: LimbSpec; far: LimbSpec } = {
    near: { plan: dirs(leg.near, LEG, dir3(-50), dir3(12)), toe: 40 },
    far: { plan: dirs(leg.far, LEG, dir3(-50), dir3(12)), toe: 40 },
  };
  const side: Side = turn < 0 ? "near" : "far";
  const touch = Math.abs(turn);
  // Both hands go together: down to the floor beside the hip at the end of a turn, up and across in the middle.
  const z = 66 * turn;
  const lift = 1 - touch;
  const target: Point3 = [10 + 16 * lift, -3 - 62 * lift, z];
  const arms = {} as Record<Side, LimbSpec>;
  for (const s of ["near", "far"] as Side[]) {
    const hand: Point3 = [target[0] + (s === side ? 0 : 4), target[1] - (s === side ? 0 : 2), target[2] + zOut(s) * 8];
    const shoulder = arm[s].root;
    const hint: Point3 = [hand[0] - 34, hand[1] - 48, hand[2] + zOut(s) * 30];
    arms[s] = { plan: chain(shoulder, ARM, hand, hint) };
  }
  const k = frame(0.35, spine, { arms, legs });
  return { ...k, face: { turn: 0 }, sideways: { ...k.sideways, twist } };
}

// ---------------------------------------------------------------- standing torso twist (hands on hips)

const TW_PELVIS: Point = [0, -172];
const TW_SPINE: Spine = { pelvis: TW_PELVIS, chest: [0, -252], head: [0, -308] };

/** Rotates `p` about the vertical through the pelvis by `degrees` (positive: the chest turns to the near side). */
function turnAbout(p: Point3, degrees: number): Point3 {
  const r = (degrees * Math.PI) / 180;
  return [p[0] * Math.cos(r) - p[2] * Math.sin(r), p[1], p[0] * Math.sin(r) + p[2] * Math.cos(r)];
}

/** Upper body turned `phi` degrees: the hands (on the waist) and the elbows swing round with it. */
function standingTwist(phi: number): Keyframe {
  const { arm, leg } = roots(TW_SPINE);
  const legs = {} as Record<Side, LimbSpec>;
  for (const s of ["near", "far"] as Side[]) {
    const foot: Point3 = [s === "near" ? 4 : -2, -1, zOut(s) * 24];
    legs[s] = { plan: chain(leg[s], LEG, foot, [leg[s][0] + 60, leg[s][1] + 80, foot[2]]), toe: 0 };
  }
  const arms = {} as Record<Side, LimbSpec>;
  for (const s of ["near", "far"] as Side[]) {
    const hand = turnAbout([4, -178, zOut(s) * 40], phi);
    const hint = turnAbout([-34, -218, zOut(s) * 84], phi);
    arms[s] = { plan: chain(arm[s], ARM, hand, hint) };
  }
  return frame(0.4, TW_SPINE, { arms, legs });
}

// ---------------------------------------------------------------- seated side bend on a chair

const CH_PELVIS: Point = [0, -88];
const CH_SEAT_TOP = -76;
const CH_SEAT: Prop = { kind: "box", x: -70, y: CH_SEAT_TOP, w: 110, h: -CH_SEAT_TOP, frontHalf: 30 };

/** Seated tall; the near hand holds the seat, the far arm reaches up and over; the spine leans to the near side by `lean` (z of the chest). */
function chairBend(lean: number): Keyframe {
  const pose0: Pose = { pelvis: CH_PELVIS, chest: [0, CH_PELVIS[1] - 80], head: [0, CH_PELVIS[1] - 80 - 56] };
  const sw0: Sideways = { pelvis: 0, chest: lean };
  const figure = solveKeyframe3(solvePose(pose0), pose0, sw0);
  const shoulderFar = figure.arms.far.root;
  const shoulderNear = figure.arms.near.root;
  // Seated legs: thighs level, shins down, feet a little apart.
  const legs = {} as Record<Side, LimbSpec>;
  const { leg } = roots(pose0);
  for (const s of ["near", "far"] as Side[]) {
    const knee: Point3 = [leg[s][0] + BONES.thigh, leg[s][1], zOut(s) * 16];
    const foot: Point3 = [knee[0], knee[1] + BONES.shin - 0.5, zOut(s) * 16];
    legs[s] = { plan: { mid: knee, end: foot }, toe: 0 };
  }
  // Far arm straight up from the leaned shoulder, tipping over towards the near side as the spine leans.
  const tip = (lean / 80) * 1.15;
  const overUp: Point3 = [shoulderFar[0] + 6, shoulderFar[1] - REACH * Math.cos(tip * 0.9), shoulderFar[2] + REACH * Math.sin(tip * 0.9)];
  const farPlan = dirs(shoulderFar, ARM, sub3(overUp, shoulderFar), sub3(overUp, shoulderFar));
  const grip: Point3 = [2, CH_SEAT_TOP - 3, -36];
  const nearPlan = chain(shoulderNear, ARM, grip, [shoulderNear[0] - 20, shoulderNear[1] + 30, -70]);
  const out = frame(0.5, { pelvis: CH_PELVIS, chest: pose0.chest, head: pose0.head }, { arms: { near: { plan: nearPlan }, far: { plan: farPlan } }, legs });
  return { ...out, sideways: { ...out.sideways, chest: lean, pelvis: 0 } };
}

// ---------------------------------------------------------------- lying face up (head at -x)

/**
 * Upper back and head on the floor, knees bent and feet flat, arms long by the
 * sides. `chord` is the run of the spine from the pelvis to the chest on the
 * floor: shorter than the 80 spine, so the lower back bows up off the floor;
 * longer, the back flattens.
 */
function supineBent(pelvis: Point, chord: number): Pose {
  const dy = -18 - pelvis[1];
  const chest: Point = [round(pelvis[0] - Math.sqrt(chord ** 2 - dy * dy)), -18];
  const base: Pose = { pelvis, chest, head: [round(chest[0] - 55), -24], spine: { bend: -1 } };
  const shoulder = shoulderAt(base);
  const handY = -6;
  const handX = round(shoulder[0] + Math.sqrt(REACH ** 2 - (shoulder[1] - handY) ** 2));
  return {
    ...base,
    hands: { near: [handX, handY], far: [handX, handY - 1] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { bend: -1 }, far: { bend: -1 } },
    feet: { near: [60, 0], far: [56, 0] },
    toes: { near: 0, far: 0 },
  };
}

/** Pelvis resting; the lower back arches a little off the floor. */
const neutralSpine = (): Pose => supineBent([0, -20], 76.5);
/** Belly drawn in: the lower back settles towards the floor, hips and ribs unmoved. */
const drawnIn = (): Pose => supineBent([0, -20], 79.4);
/** Pelvis tilted: the tail curls up and the lower back presses down. */
const tilted = (): Pose => supineBent([4, -28], 79.4);

// ---------------------------------------------------------------- crunch hold

const CRUNCH_PELVIS: Point = [-8, -20];
const CRUNCH_FEET: Point = [84, -2];

/** Torso at `theta` (183 lying, about 212 curled up) with the chin tucked by `tuck`; hands lightly behind the head, elbows wide. */
function crunch(theta: number, tuck: number): Pose {
  const pelvis = CRUNCH_PELVIS;
  const chest = along(pelvis, theta, 80);
  const head = along(chest, theta + tuck, 56);
  const base: Pose = { pelvis, chest, head };
  const shoulder = shoulderAt(base);
  const face = ((theta + 90) * Math.PI) / 180;
  const facing = (p: Point, q: Point): boolean =>
    (p[0] - shoulder[0]) * Math.cos(face) + (p[1] - shoulder[1]) * Math.sin(face) >
    (q[0] - shoulder[0]) * Math.cos(face) + (q[1] - shoulder[1]) * Math.sin(face);
  const hand = along(head, theta + 75, 22);
  const handFar = along(hand, theta, 3);
  return {
    ...base,
    hands: { near: hand, far: handFar },
    elbows: {
      near: { at: meet(shoulder, 60, hand, 66, facing) },
      far: { at: meet(shoulder, 60, handFar, 66, facing) },
    },
    knees: { near: { bend: -1 }, far: { bend: -1 } },
    feet: { near: CRUNCH_FEET, far: [CRUNCH_FEET[0] - 3, CRUNCH_FEET[1]] },
    toes: { near: 0, far: 0 },
  };
}

// ---------------------------------------------------------------- standing arm swings

const STAND_PELVIS: Point = [0, -172];
const STAND_SHOULDER: Point = [0, -270];

/** Straight arms swung `up` degrees from hanging (0 = by the sides, 90 = level in front, 180 = overhead). */
function armSwing(up: number): Pose {
  const a = 90 - up;
  const hand = along(STAND_SHOULDER, a, STRAIGHT);
  const farHand = along(STAND_SHOULDER, a - 2, STRAIGHT);
  return {
    pelvis: STAND_PELVIS,
    chest: [0, -252],
    hands: { near: hand, far: farHand },
    // Elbows on the shoulder-to-hand line: the arms stay straight.
    elbows: { near: { at: along(STAND_SHOULDER, a, BONES.upperArm) }, far: { at: along(STAND_SHOULDER, a - 2, BONES.upperArm) } },
    feet: { near: [6, 0], far: [0, 0] },
    toes: { near: 0, far: 0 },
  };
}

// ---------------------------------------------------------------- roll down

const dir = (degrees: number): Point => [Math.cos((degrees * Math.PI) / 180), Math.sin((degrees * Math.PI) / 180)];
const step = (from: Point, degrees: number, length: number): Point => [from[0] + dir(degrees)[0] * length, from[1] + dir(degrees)[1] * length];

const ease = (x: number): number => x * x * (3 - 2 * x);

/**
 * Standing roll-down stage (0 tall, 1 hanging): the chin tucks, then the spine curls one section
 * after another (upper back, lower back), then the hips shift back as the torso hangs. The
 * knees stay soft.
 */
function rollSpine(t: number): Pose {
  const hinge = ease(Math.max(0, Math.min(1, (t - 0.1) / 0.9)));
  const pelvis: Point = [round(-24 * hinge), round(-170 + 5 * hinge)];
  const upper = 34 * Math.max(0, Math.min(1, t * 2.2 - 0.2));
  const lower = 34 * Math.max(0, Math.min(1, t * 2 - 0.5));
  const neckCurl = 14 * Math.min(1, t * 4) + 16 * hinge;
  const a = -90 + 98 * hinge;
  const waist = step(pelvis, a, 40);
  const chest = step(waist, a + lower, 40);
  const neck = step(chest, a + lower + upper, 20);
  const head = step(neck, a + lower + upper + neckCurl, 36);
  return { pelvis, chest: [round(chest[0]), round(chest[1])], head: [round(head[0]), round(head[1])], spine: { bend: -1 } };
}

/** The arm hanging `theta` degrees forward of straight down, from the near shoulder of `base`. */
function hangingHand(base: Pose, theta: number): Point {
  const shoulder = shoulderAt(base);
  const r = (theta * Math.PI) / 180;
  return [round(shoulder[0] + Math.sin(r) * (REACH - 3)), Math.min(round(shoulder[1] + Math.cos(r) * (REACH - 3)), -6)];
}

/**
 * Roll-down stage `u` (0 tall, 1 the bottom of the roll). The arms hang straight down; the roll stops
 * where the head still hangs ahead of them, since a head hanging between the arms would be drawn
 * through them (the rig has no depth to put the arms beside it).
 */
function rollDown(u: number): Pose {
  const base = rollSpine(ROLL_BOTTOM * u);
  const hand = hangingHand(base, -2);
  return {
    ...base,
    hands: { near: hand, far: hand },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { bend: -1 }, far: { bend: -1 } },
    feet: { near: [6, 0], far: [0, 0] },
    toes: { near: 0, far: 0 },
  };
}

const ROLL_BOTTOM = 0.62;

// ---------------------------------------------------------------- face down (head at +x)

const PRONE_PELVIS: Point = [-20, -14];

/** Flat legs on the floor, knees on the hip-to-ankle line. */
function proneLegs(): Pick<Pose, "knees" | "feet" | "toes"> {
  const foot = (deg: number): Point => along(PRONE_PELVIS, deg, THIGH + SHIN - 0.4);
  const knee = (deg: number): Point => along(PRONE_PELVIS, deg, THIGH);
  return {
    knees: { near: { at: knee(182) }, far: { at: knee(181) } },
    feet: { near: foot(182), far: foot(181) },
    toes: { near: 182, far: 181 },
  };
}

/** Chest lifted `lift` (0 flat, 1 high) by the back muscles; arms out to the sides on the floor (top view). */
function backExtension(lift: number): { pose: Pose; handZ: number } {
  const spine = round(-8 - 24 * lift);
  const pelvis = PRONE_PELVIS;
  const chest = along(pelvis, spine, 80);
  const neck = along(chest, spine, 20);
  const head = along(neck, spine + 14, 36);
  const base: Pose = { pelvis, chest, head, spine: { bend: 1 } };
  const shoulder = shoulderAt(base);
  const handZ = 108;
  const handX = round(shoulder[0] + 8);
  const handY = -2;
  return {
    pose: {
      ...base,
      hands: { near: [handX, handY], far: [handX, handY] },
      elbows: { near: { bend: -1 }, far: { bend: -1 } },
      ...proneLegs(),
    },
    handZ,
  };
}

/** A back-extension keyframe for the top view: arms out to the sides on the floor. */
function backExt(lift: number): { pose: Pose; sideways: Sideways } {
  const { pose, handZ } = backExtension(lift);
  return { pose, sideways: { hands: { near: -handZ, far: handZ } } };
}

// ---------------------------------------------------------------- one-half locust

/**
 * Face down, far hand tucked under its hip, near knee bent with the near hand
 * holding the foot; `lift` raises the foot toward the ceiling and the chest off the floor.
 */
function halfLocust(lift: number): Pose {
  const pelvis = PRONE_PELVIS;
  const spine = round(-12 - 22 * lift);
  const chest = along(pelvis, spine, 80);
  const neck = along(chest, spine, 20);
  const head = along(neck, spine + 8, 36);
  const base: Pose = { pelvis, chest, head, spine: { bend: 1 } };
  // Near thigh stays down; the shin lifts, the foot coming up over the back of the pelvis.
  const knee = along(pelvis, round(181 + 2 * lift), THIGH);
  const foot = along(knee, round(-25 - 25 * lift), SHIN);
  const farFoot = along(pelvis, 181, THIGH + SHIN - 0.4);
  return {
    ...base,
    hands: { near: foot, far: [round(pelvis[0] + 4), -4] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { at: knee }, far: { at: along(pelvis, 181, THIGH) } },
    feet: { near: foot, far: farFoot },
    toes: { near: 180, far: 181 },
  };
}

// ---------------------------------------------------------------- low lunge twist

const LT_KNEE: Point = [-30, -3];

/** Roll of the shoulder line at full open: + brings the far shoulder forward, the chest turning to the front (near) leg. */
const LT_TWIST = 75;

/**
 * Low lunge, the far leg back with its knee on the floor, the near foot forward
 * (knee over the ankle), hips square. The far hand rests on the front thigh; `open`
 * rolls the chest `LT_TWIST` towards the front leg and sends the near arm out along
 * the opening shoulder line (0.5) and up to the ceiling (1); the eyes follow the hand.
 */
function lungeTwist(open: number): Keyframe {
  const px = -6;
  const pelvis: Point = [px, -(round(Math.sqrt(THIGH ** 2 - (px - LT_KNEE[0]) ** 2)) + 3)];
  const frontFoot: Point = [px + 92, 0];
  const frontKnee = meet(pelvis, THIGH, frontFoot, SHIN, (p, q) => p[0] > q[0]);
  const spine = -86;
  const chest = along(pelvis, spine, 80);
  const head = along(chest, spine, 56);
  const twist = round(LT_TWIST * open);
  const base: Pose = {
    pelvis,
    chest,
    head,
    knees: { near: { at: frontKnee }, far: { at: LT_KNEE } },
    feet: { near: frontFoot, far: [-116, -3] },
    toes: { near: 0, far: 180 },
  };
  const arms = solveKeyframe3(solvePose(base), base, { twist }).arms;
  const thigh = along(frontKnee, angle2(frontKnee, pelvis), 30);
  const farHand: Point3 = [thigh[0], thigh[1] - 4, -HIP_SIDE];
  const nearRoot = arms.near.root;
  const farRoot = arms.far.root;
  // Out along the shoulder line (far to near) and up, or up, a little back and out.
  const lineOut = unit3(add3(unit3(sub3(nearRoot, farRoot)), [0, -1, 0]));
  const reach: Record<string, Point3> = {
    "0": [thigh[0] - 4, thigh[1] - 8, -HIP_SIDE - 10],
    "0.5": add3(nearRoot, scale3(lineOut, 124)),
    "1": add3(nearRoot, scale3(unit3([-0.3, -1, -0.25]), 124.5)),
  };
  const nearHand = reach[String(open)];
  return {
    hold: 0,
    face: { turn: round(-35 * open), nod: round(-25 * open) },
    pose: {
      ...base,
      hands: { near: flat(nearHand), far: flat(farHand) },
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
    },
    sideways: { twist, hands: { near: round(nearHand[2]), far: round(farHand[2]) }, elbows: { far: { out: 40 } } },
  };
}

/** Direction from `a` to `b` in degrees. */
const angle2 = (a: Point, b: Point): number => (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;

const ROLL_STEPS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];


// ---------------------------------------------------------------- full sit outs (plank, thread one leg under, reach up)

/**
 * High plank; `lifted` is the side that opens: its arm reaches to the ceiling while the other hand
 * stays planted, and its leg bends under the body to tap the foot down (`t` 0 plank, 1 open).
 */
function sitOut(lifted: Side | null, stage: 1 | 2 = 2): Pose {
  const base = plank();
  if (!lifted) return base;
  const planted: Side = lifted === "near" ? "far" : "near";
  const shoulder = solvePose(base).arms.near.root;
  const hip = base.pelvis as Point;
  const foot: Point = stage === 2 ? [round(hip[0] - 46), -3] : [round(hip[0] - 96), -30];
  const knee = meet(hip, THIGH, foot, SHIN, (p, q) => p[0] > q[0]);
  // Opening arm: folded up behind the shoulder on the way, then straight up.
  const elbow = along(shoulder, stage === 2 ? -78 : -140, BONES.upperArm);
  const hand = stage === 2 ? along(shoulder, -78, STRAIGHT) : along(elbow, -205, 66);
  return {
    ...base,
    hands: { [planted]: [62, 0], [lifted]: hand } as Record<Side, Point>,
    elbows: { [planted]: { bend: 1 }, [lifted]: { at: elbow } } as Record<Side, { bend: 1 } | { at: Point }>,
    knees: { [lifted]: { at: knee } },
    feet: { [lifted]: foot, [planted]: [-190, -18] } as Record<Side, Point>,
    toes: { [lifted]: 0, [planted]: 62 } as Record<Side, number>,
  };
}

// ---------------------------------------------------------------- side crunch (side-lying, seen from the front, head left)

const SC_PELVIS: Point = [0, -30];

/** Lying on the side, knees bent and stacked; `lift` raises the head and shoulders towards the top hip (the spine bends sideways). */
function sideCrunch(lift: number): Pose {
  const theta = 180 + 26 * lift;
  const chest = along(SC_PELVIS, theta, 80);
  const head = along(along(chest, theta, 20), theta + 6, 36);
  const base: Pose = { pelvis: SC_PELVIS, chest, head, spine: { bend: -1 } };
  const solved = solvePose(base, { view: "front" });
  const shoulderFar = solved.arms.far.root;
  const shoulderNear = solved.arms.near.root;
  // Top hand lightly behind the head, elbow pointing up; bottom arm across the stomach.
  const hand: Point = [round(head[0] + 8), round(head[1] - 20)];
  const elbow = meet(shoulderFar, 60, hand, 66, (p, q) => p[1] < q[1]);
  const nearHand: Point = [round(shoulderNear[0] + 112), -4];
  const nearElbow = meet(shoulderNear, 60, nearHand, 66, (p, q) => p[1] < q[1]);
  // The hips turn with the lower spine: keep each knee and foot at the same offset from its hip.
  const hipB = solved.legs.near.root;
  const hipT = solved.legs.far.root;
  const off = (p: Point, from: Point, to: Point): Point => [round(p[0] - from[0] + to[0]), round(p[1] - from[1] + to[1])];
  return {
    ...base,
    hands: { near: nearHand, far: hand },
    elbows: { near: { at: nearElbow }, far: { at: elbow } },
    knees: { near: { at: off(SL_KNEE_BOTTOM, SL_HIP_BOTTOM, hipB) }, far: { at: off(SL_KNEE_TOP, SL_HIP_TOP, hipT) } },
    feet: { near: off(SL_FOOT_BOTTOM, SL_HIP_BOTTOM, hipB), far: off(SL_FOOT_TOP, SL_HIP_TOP, hipT) },
    toes: { near: 0, far: 0 },
  };
}

export const BATCH_BG_SPECS: DoodleSpec[] = [
  {
    id: "wger_1828",
    slug: "abdominal-draw-in",
    title: "Abdominal Draw-In",
    props: [FLOOR_PROP],
    transition: 1.1,
    frames: [
      { hold: 0.5, pose: neutralSpine() },
      { hold: 1, pose: drawnIn() },
    ],
  },
  {
    id: "wger_2488",
    slug: "posterior-pelvic-tilt",
    title: "Posterior Pelvic Tilt",
    props: [FLOOR_PROP],
    transition: 0.9,
    frames: [
      { hold: 0.5, pose: neutralSpine() },
      { hold: 1, pose: tilted() },
    ],
  },
  {
    id: "wger_1478",
    slug: "levitation-crunch",
    title: "Levitation Crunch",
    props: [FLOOR_PROP],
    transition: 0.7,
    frames: [
      { hold: 0.4, pose: crunch(183, 2) },
      { hold: 1.1, pose: crunch(212, 12) },
    ],
  },
  {
    id: "fedb_dynamic_back_stretch",
    slug: "dynamic-back-stretch",
    title: "Dynamic Back Stretch",
    props: [FLOOR_PROP],
    transition: 0.6,
    frames: [
      { hold: 0.1, pose: armSwing(0) },
      { hold: 0.1, pose: armSwing(70) },
      { hold: 0.1, pose: armSwing(0) },
      { hold: 0.1, pose: armSwing(125) },
      { hold: 0.1, pose: armSwing(0) },
      { hold: 0.5, pose: armSwing(142) },
    ],
  },
  {
    id: "wger_1399",
    slug: "roll-down",
    title: "Roll Down",
    props: [FLOOR_PROP],
    transition: 0.2,
    frames: [
      { hold: 0.4, pose: rollDown(0) },
      ...ROLL_STEPS.map((t) => ({ hold: 0, pose: rollDown(t) })),
      { hold: 0.6, pose: rollDown(1) },
      ...[...ROLL_STEPS].reverse().map((t) => ({ hold: 0, pose: rollDown(t) })),
    ],
  },
  {
    id: "fedb_one_half_locust",
    slug: "one-half-locust",
    title: "One Half Locust",
    props: [FLOOR_PROP],
    transition: 1.3,
    frames: [
      { hold: 0.4, pose: halfLocust(0) },
      { hold: 1.2, pose: halfLocust(1) },
    ],
  },
  {
    id: "wger_1868",
    slug: "lunge-with-twist-stretch",
    title: "Lunge with Twist Stretch",
    views: TWO_VIEWS,
    props: [FLOOR_PROP],
    transition: 0.8,
    frames: [
      { ...lungeTwist(0), hold: 0.4 },
      { ...lungeTwist(0.5), hold: 0 },
      { ...lungeTwist(1), hold: 1.2 },
      { ...lungeTwist(0.5), hold: 0 },
    ],
  },
  {
    id: "wger_260",
    slug: "full-sit-outs",
    title: "Full Sit Outs",
    props: [FLOOR_PROP],
    transition: 0.45,
    frames: [
      { hold: 0.3, pose: sitOut(null) },
      { hold: 0, pose: sitOut("near", 1) },
      { hold: 0.7, pose: sitOut("near", 2) },
      { hold: 0, pose: sitOut("near", 1) },
      { hold: 0.3, pose: sitOut(null) },
      { hold: 0, pose: sitOut("far", 1) },
      { hold: 0.7, pose: sitOut("far", 2) },
      { hold: 0, pose: sitOut("far", 1) },
    ],
  },
  {
    id: "wger_576",
    slug: "side-crunch",
    title: "Side Crunch",
    view: "front",
    props: [FLOOR_PROP],
    transition: 0.8,
    frames: [
      { hold: 0.4, pose: sideCrunch(0) },
      { hold: 0.9, pose: sideCrunch(1) },
    ],
  },
  {
    id: "fedb_lower_back_curl",
    slug: "lower-back-curl",
    title: "Lower Back Curl",
    views: TOP_VIEWS,
    props: [FLOOR_PROP],
    transition: 1.2,
    frames: [
      { hold: 0.4, ...backExt(0.15) },
      { hold: 1.4, ...backExt(1) },
    ],
  },
  {
    id: "wger_1912",
    slug: "core-rotation",
    title: "Core Rotation",
    views: TOP_VIEWS,
    props: [FLOOR_PROP],
    transition: 0.6,
    frames: [coreRotation(-1), coreRotation(0), coreRotation(1), coreRotation(0)],
  },
  {
    id: "fedb_middle_back_stretch",
    slug: "middle-back-stretch",
    title: "Middle Back Stretch",
    views: TWO_VIEWS,
    props: [FLOOR_PROP],
    transition: 1.1,
    frames: [standingTwist(0), standingTwist(48), standingTwist(0), standingTwist(-48)],
  },
  {
    id: "fedb_chair_lower_back_stretch",
    slug: "chair-lower-back-stretch",
    title: "Chair Lower Back Stretch",
    views: TWO_VIEWS,
    props: [CH_SEAT],
    transition: 1.2,
    frames: [chairBend(0), chairBend(-46)],
  },
];

