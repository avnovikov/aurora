import { BONES, HIP_SIDE, SHOULDER_SIDE, solvePose, zOut } from "./rig";
import type { DoodleSpec, Keyframe, Point, Pose, Prop, Side, Sideways } from "./rig";
import { add3, scale3, solveKeyframe3, type Point3 } from "./rig3d";
import { ARM as ARM_BONES, chain, dirs, flat, LEG as LEG_BONES, LEG_LEN, type LimbSpec, roots, SIDES, type Spine, unit3 } from "./limbs3";
import { FLOOR_PROP, along, angle, lerp, round } from "./geom";
import { lockedY3, TOP_VIEWS, TWO_VIEWS } from "./sideways";
import { pushUp, straightBody } from "./specsBatchC";
import { sideLying } from "./specsWarmup";

/**
 * Batch BI (#216): assorted mobility, stretches and a few training moves.
 * Floor at y = 0, up is negative, the side-view figure faces +x. Never import
 * ./specs (circular).
 */

const ARM = BONES.upperArm + BONES.forearm + BONES.hand - 0.4;

/** The point `r1` from `c1` and `r2` from `c2`; `upper` picks the one with the smaller y (higher on screen). */
function circles(c1: Point, r1: number, c2: Point, r2: number, upper = true): Point {
  const d = Math.hypot(c2[0] - c1[0], c2[1] - c1[1]);
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const ux = (c2[0] - c1[0]) / d;
  const uy = (c2[1] - c1[1]) / d;
  const p1: Point = [c1[0] + ux * a - uy * h, c1[1] + uy * a + ux * h];
  const p2: Point = [c1[0] + ux * a + uy * h, c1[1] + uy * a - ux * h];
  const p1Higher = p1[1] < p2[1];
  const pick = p1Higher === upper ? p1 : p2;
  return [round(pick[0]), round(pick[1])];
}

/** Chest point on the way from `pelvis` to the shoulder `s` (the shoulder sits 98 up the spine). */
const chestTo = (pelvis: Point, s: Point): Point => along(pelvis, angle(pelvis, s), 80);

const key = (pose: Pose, hold = 0, rest: Partial<Keyframe> = {}): Keyframe => ({ hold, pose, ...rest });

// ---------------------------------------------------------------- standing forward fold, knees alternately bent (wger_1391)

/** Feet stay planted a short stride apart; the hips rock over the bent knee, the other leg straightens. */
function fold(bent: Side): Pose {
  const nearFoot: Point = [20, 0];
  const farFoot: Point = [-20, 0];
  const x = bent === "near" ? 26 : -26;
  const straightFoot = bent === "near" ? farFoot : nearFoot;
  const pelvis: Point = [x, round(-Math.sqrt((LEG_LEN - 0.6) ** 2 - (x - straightFoot[0]) ** 2))];
  const shoulder = along(pelvis, 48, 98);
  const chest = along(pelvis, 48, 80);
  return {
    pelvis,
    chest,
    head: along(chest, 82, 56),
    hands: { near: [round(shoulder[0] + 85), -6], far: [round(shoulder[0] + 82), -4] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { bend: -1 }, far: { bend: -1 } },
    feet: { near: nearFoot, far: farFoot },
    toes: { near: 0, far: 0 },
  };
}

// ---------------------------------------------------------------- isometric squat (wger_1733)

function squat(depth: number): Pose {
  // depth 0 standing, 1 thighs parallel: foot under the knee line.
  const knee: Point = [round(lerp(0, 33, depth)), round(lerp(-86, -79.4, depth))];
  const pelvis: Point = depth === 0 ? [0, -172] : [round(knee[0] - 88), knee[1]];
  const lean = lerp(-90, -62, depth);
  const shoulder = along(pelvis, lean, 98);
  const hand: Point = [round(shoulder[0] + lerp(-6, 116, depth)), round(shoulder[1] + lerp(110, 0, depth))];
  return {
    pelvis,
    chest: along(pelvis, lean, 80),
    hands: { near: hand, far: [hand[0] - 3, hand[1] + 1] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { bend: -1 }, far: { bend: -1 } },
    feet: { near: [0, 0], far: [-5, 0] },
    toes: { near: 0, far: 0 },
  };
}

// ---------------------------------------------------------------- march / jog in place (wger_1584)

function march(up: Side | null): Pose {
  const pelvis: Point = up ? [0, -170] : [0, -172];
  const base: Pose = {
    pelvis,
    chest: [0, pelvis[1] - 80],
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    toes: { near: 0, far: 0 },
  };
  const shoulder: Point = [0, pelvis[1] - 98];
  if (!up) {
    // Passing: both arms hang bent, forearms forward.
    const elbow = along(shoulder, 100, 60);
    const hand = along(elbow, -10, 65.6);
    return {
      ...base,
      hands: { near: hand, far: along(elbow, -13, 65.6) },
      elbows: { near: { at: elbow }, far: { at: elbow } },
      feet: { near: [8, 0], far: [-8, 0] },
    };
  }
  const down: Side = up === "near" ? "far" : "near";
  const knee = along(pelvis, 10, 88);
  const foot = along(knee, 100, 86);
  // Opposite arm forward (elbow bent, hand to chin height), same-side arm back (hand by the hip).
  const fwdElbow = along(shoulder, 50, 60);
  const backElbow = along(shoulder, 125, 60);
  return {
    ...base,
    hands: { [up]: along(backElbow, 70, 65.6), [down]: along(fwdElbow, -25, 65.6) },
    elbows: { [up]: { at: backElbow }, [down]: { at: fwdElbow } },
    knees: { [up]: { at: knee } },
    feet: { [up]: foot, [down]: [0, 0] },
    toes: { [up]: 70, [down]: 0 },
  };
}

// ---------------------------------------------------------------- deep low lunge stretch (wger_1874)

/** Hands on the floor by the front foot; `sink` 0 hips up and back knee lifted, 1 hips down with the back knee on the floor. */
function lowLunge(sink: number): Pose {
  const front: Point = [60, -4];
  const hand: Point = [44, 0];
  const pelvis: Point = [round(lerp(-44, -30, sink)), round(lerp(-92, -74, sink))];
  const s = circles(pelvis, 98, hand, ARM, true);
  const backKnee: Point = [round(pelvis[0] - Math.sqrt(88 ** 2 - (pelvis[1] + 4) ** 2)), -4];
  const backFoot: Point =
    sink > 0.5
      ? [round(backKnee[0] - Math.sqrt(86 ** 2 - 16)), -8]
      : [round(pelvis[0] - Math.sqrt((LEG_LEN - 0.4) ** 2 - (pelvis[1] + 16) ** 2)), -16];
  return {
    pelvis,
    chest: chestTo(pelvis, s),
    hands: { near: hand, far: [hand[0] - 6, 0] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: sink > 0.5 ? { near: { bend: -1 }, far: { at: backKnee } } : { near: { bend: -1 }, far: { bend: -1 } },
    feet: { near: front, far: backFoot },
    toes: { near: 0, far: sink > 0.5 ? 180 : 55 },
  };
}

// ---------------------------------------------------------------- kneeling bench lat stretch (wger_1710)

const LAT_BENCH: Prop = { kind: "box", x: 171, y: -76, w: 110, h: 76 };
const LAT_ELBOW: Point = [176, -80];

/** Kneeling, elbows on the bench; the hips walk back and the chest sinks below the elbows (`sink` 0..1). */
function latStretch(sink: number): Pose {
  // The shoulder swings round the fixed elbow, from up-and-back to level-and-back (arm 60 long).
  const shoulder = along(LAT_ELBOW, lerp(-113, -195, sink), BONES.upperArm);
  const pelvis: Point = [round(shoulder[0] - Math.sqrt(98 ** 2 - (shoulder[1] + 90) ** 2)), -90];
  const chest = chestTo(pelvis, shoulder);
  const spine = angle(pelvis, shoulder);
  const kneeX = round(pelvis[0] + Math.sqrt(88 ** 2 - (pelvis[1] + 4) ** 2));
  const head = along(chest, spine + lerp(35, 30, (sink - 0.7) / 0.3), 56);
  // The forearm folds back from the elbow towards the head.
  const fold = angle(shoulder, LAT_ELBOW) - 128;
  const hand = along(LAT_ELBOW, fold, 66.2);
  const knee: Point = [kneeX, -4];
  return {
    pelvis,
    chest,
    head,
    hands: { near: hand, far: along(LAT_ELBOW, fold + 3, 66.2) },
    elbows: { near: { at: LAT_ELBOW }, far: { at: LAT_ELBOW } },
    knees: { near: { at: knee }, far: { at: knee } },
    feet: { near: along(knee, 177, 85.9), far: along(knee, 179, 85.9) },
    toes: { near: 180, far: 180 },
  };
}

// ---------------------------------------------------------------- seated chair stretch (fedb_chair_upper_body_stretch)

const CHAIR_SEAT: Prop = { kind: "box", x: -75, y: -80, w: 120, h: 80 };
const CHAIR_BACK: Prop = { kind: "box", x: -75, y: -190, w: 10, h: 110 };
const CHAIR_HAND: Point = [-62, -132];

function chairStretch(lean: boolean): Pose {
  const pelvis: Point = [14, -90];
  const s = lean ? circles(pelvis, 98, CHAIR_HAND, ARM, true) : along(pelvis, -90, 98);
  const chest = chestTo(pelvis, s);
  return {
    pelvis,
    chest,
    hands: { near: CHAIR_HAND, far: [CHAIR_HAND[0] + 2, CHAIR_HAND[1] + 2] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { bend: -1 }, far: { bend: -1 } },
    feet: { near: [112, 0], far: [106, 0] },
    toes: { near: 0, far: 0 },
  };
}

// ---------------------------------------------------------------- cross-body shoulder stretch (wger_2685, front view)

function crossBody(pull: number): Pose {
  // Legs dead straight under the hips (thigh + shin = 174): a front-view knee bend would kink sideways.
  const shoulder: Point = [-22, -272];
  const hand = along(shoulder, lerp(10, -2, pull), ARM - 0.4);
  const elbow = along(shoulder, lerp(10, -2, pull), 60);
  return {
    pelvis: [0, -174],
    chest: [0, -254],
    hands: { near: hand, far: [round(elbow[0] + 12), round(elbow[1] + 2)] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: [-8, 0], far: [8, 0] },
    toes: { near: 180, far: 0 },
  };
}

// ---------------------------------------------------------------- incline archer push-up (ntc_incline_archer_push_up)

const IA_BENCH: Prop = { kind: "box", x: 20, y: -50, w: 120, h: 50, frontHalf: 100 };
const IA_HAND_X = 54;
const IA_HAND_Z = 80;
const IA_FOOT: Point = [-175, -18];
const IA_FOOT_Z = 12;
const IA_SHIFT = -50;
const IA_ELBOW_OUT = 30;

function iaFoot(shift: number, side: Side): Point {
  const hipZ = shift + zOut(side) * HIP_SIDE;
  const across = Math.abs(hipZ - zOut(side) * IA_FOOT_Z);
  const square = Math.abs(HIP_SIDE - IA_FOOT_Z);
  const closer = Math.sqrt(LEG_LEN ** 2 - square ** 2) - Math.sqrt(LEG_LEN ** 2 - across ** 2);
  return [round(IA_FOOT[0] + closer), IA_FOOT[1]];
}

function iaAt(shoulderY: number, shift: number): Pose {
  const { pelvis, chest } = straightBody(IA_FOOT, shoulderY);
  return {
    pelvis,
    chest,
    hands: { near: [IA_HAND_X, -50], far: [IA_HAND_X - 2, -50] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: iaFoot(shift, "near"), far: iaFoot(shift, "far") },
    toes: { near: 62, far: 62 },
  };
}

const iaWide = (pelvis: number, bentNear: boolean): Sideways => ({
  pelvis,
  hands: { near: -IA_HAND_Z, far: IA_HAND_Z },
  feet: { near: -IA_FOOT_Z, far: IA_FOOT_Z },
  ...(bentNear ? { elbows: { near: { out: IA_ELBOW_OUT } } } : {}),
});

const iaLocked = (shift: number, side: Side): number => lockedY3((y) => iaAt(y, shift), iaWide(shift, false), [side], -260, -80);

function inclineArcher(): Keyframe[] {
  const top = iaLocked(0, "near");
  const bottom = iaLocked(IA_SHIFT, "far");
  const mid = Math.round((top + bottom) / 2);
  return [
    { hold: 0.4, pose: iaAt(top, 0), sideways: iaWide(0, false) },
    { hold: 0, pose: iaAt(mid, IA_SHIFT / 2), sideways: iaWide(IA_SHIFT / 2, true) },
    { hold: 0.4, pose: iaAt(bottom, IA_SHIFT), sideways: iaWide(IA_SHIFT, true) },
    { hold: 0, pose: iaAt(mid, IA_SHIFT / 2), sideways: iaWide(IA_SHIFT / 2, true) },
  ];
}


// ---------------------------------------------------------------- 3D limb placement (as in batch AM)

const p3 = (x: number, y: number, z: number): Point3 => [x, y, z];

/** Arms of a keyframe as hand and elbow pins with their sideways z. */
function armPins(arms: Partial<Record<Side, LimbSpec>>, pose: Pose, sideways: Sideways): void {
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

/** Legs of a keyframe as ankle, knee and foot-angle pins with their sideways z. */
function legPins(legs: Partial<Record<Side, LimbSpec>>, pose: Pose, sideways: Sideways): void {
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

/** A keyframe from a spine and 3D limb plans: plans become pins and `sideways` z values. */
function frame3(hold: number, spine: Spine, limbs: { arms?: Partial<Record<Side, LimbSpec>>; legs?: Partial<Record<Side, LimbSpec>> }): Keyframe {
  const pose: Pose = { ...spine };
  const sideways: Sideways = { pelvis: 0 };
  if (limbs.arms) armPins(limbs.arms, pose, sideways);
  if (limbs.legs) legPins(limbs.legs, pose, sideways);
  return { hold, pose, sideways };
}

// ---------------------------------------------------------------- Dancer's stretch (seated twist; side + top)

const SEAT_PELVIS: Point = [0, -10];

/** Sitting tall: pelvis a hand above the floor, torso upright. */
function seatedTall(): Spine {
  const chest = along(SEAT_PELVIS, -88, 80);
  return { pelvis: SEAT_PELVIS, chest, head: along(chest, -88, 56) };
}

/** Shoulder line roll of the Dancer's stretch at full turn: + brings the far shoulder forward, the chest turning to the near (bent-knee) side. */
const DANCER_TWIST = 70;

/**
 * Far leg straight ahead; near leg crossed over it with the knee up and the foot flat on the far side of it.
 * `twist` 0 sits tall, chest square, the far hand resting on the knee; 1 rolls the shoulder line
 * `DANCER_TWIST` towards the bent knee (the head turning with the chest and a little further): the far
 * arm, now forward, hooks across to the outside of that knee and the near hand, now back, props behind on the floor.
 */
function dancers(twist: number): Keyframe {
  const spine = seatedTall();
  const { leg } = roots(spine);
  const roll = DANCER_TWIST * twist;
  const turned: Sideways = { pelvis: 0, twist: roll };
  const arm = solveKeyframe3(solvePose(spine), spine, turned).arms;
  const straight = dirs(leg.far, LEG_BONES, p3(1, 0.045, 0.04), p3(1, 0.045, 0.04));
  const nearLeg = chain(leg.near, LEG_BONES, p3(46, -2, 30), p3(30, -150, 2));
  const knee = nearLeg.mid;
  const farHand: Point3 =
    twist === 0 ? [knee[0] + 4, knee[1] - 4, knee[2] + 2] : [knee[0] + 10, knee[1] + 14, knee[2] - 22];
  const farHint: Point3 = twist === 0 ? [knee[0] - 10, knee[1] - 40, 40] : [knee[0] - 20, knee[1] - 10, knee[2] - 40];
  const nearHand = p3(round(-30 - 34 * twist), -2, round(-30 + 4 * twist));
  const k = frame3(0, spine, {
    arms: {
      far: { plan: chain(arm.far.root, ARM_BONES, farHand, farHint) },
      near: { plan: chain(arm.near.root, ARM_BONES, nearHand, p3(-40, -60, -60)) },
    },
    legs: { far: { plan: straight, toe: -80 }, near: { plan: nearLeg, toe: 0 } },
  });
  return { ...k, face: { turn: round(-25 * twist), nod: 6 }, sideways: { ...k.sideways, twist: roll } };
}


// ---------------------------------------------------------------- plank scorpion kick (wger_1207; side + top)

/**
 * High plank, one leg (near) bent and lifted behind: `phase` 0 the plank, 1 the shin up (foot to the
 * ceiling), 2 the foot swung across to the far side towards the floor, the knee following across.
 */
function scorpionKick(phase: 0 | 1 | 2): Keyframe {
  const base = pushUp("top", 62);
  const spine: Spine = { pelvis: base.pelvis, chest: base.chest };
  if (phase === 0) return { hold: 0, pose: base, sideways: { pelvis: 0 } };
  const hip = roots(spine).leg.near;
  const plan =
    phase === 1
      ? dirs(hip, LEG_BONES, p3(-0.97, -0.2, 0), p3(0.1, -1, 0))
      : dirs(hip, LEG_BONES, p3(-0.9, -0.05, 0.43), p3(0.1, 0.7, 0.7));
  const k = frame3(0, spine, { legs: { near: { plan, toe: phase === 1 ? -40 : 60 } } });
  const kp = k.pose as Pose;
  const pose: Pose = {
    ...base,
    knees: { near: kp.knees?.near },
    feet: { ...base.feet, near: kp.feet?.near },
    toes: { ...base.toes, near: kp.toes?.near },
  };
  return { hold: 0, pose, sideways: { pelvis: 0, feet: k.sideways?.feet, knees: k.sideways?.knees } };
}

// ---------------------------------------------------------------- prone scorpion stretch (hf_168; side + top)

/** Face down, head at +x, forehead on the floor; arms out to the sides, palms down. */
function proneSpine(): Spine {
  return { pelvis: [0, -16], chest: [80, -19], head: [138, -28] };
}

/** Near knee bent; `across` 0 the shin up, 1 the foot swung over to the far side towards the opposite hand. */
function proneScorpion(across: number): Keyframe {
  const spine = proneSpine();
  const { arm, leg } = roots(spine);
  const reachZ = SHOULDER_SIDE + 123;
  const arms = {
    near: { plan: chain(arm.near, ARM_BONES, p3(arm.near[0], -7, -reachZ), p3(arm.near[0] - 20, -20, -80)) },
    far: { plan: chain(arm.far, ARM_BONES, p3(arm.far[0], -7, reachZ), p3(arm.far[0] - 20, -20, 80)) },
  };
  const straight = dirs(leg.far, LEG_BONES, p3(-1, 0.03, 0), p3(-1, 0.03, 0));
  const thigh = unit3(p3(-0.96, -0.03, lerp(0, 0.28, across)));
  const shin = unit3(p3(lerp(0.1, 0.45, across), lerp(-1, -0.25, across), lerp(0, 0.85, across)));
  return frame3(0, spine, { arms, legs: { far: { plan: straight, toe: 170 }, near: { plan: dirs(leg.near, LEG_BONES, thigh, shin), toe: 150 } } });
}

// ---------------------------------------------------------------- prone W-raise (wger_1474; side + top)

/** Prone W: upper arms out and back, forearms up beside the head. `lift` 0 on the floor, 1 raised. */
function wRaise(lift: number): Keyframe {
  const spine = proneSpine();
  const { arm, leg } = roots(spine);
  const arms = {} as Record<Side, LimbSpec>;
  for (const side of SIDES) {
    const s = zOut(side);
    const d1 = p3(-0.72, lerp(0.15, -0.55, lift), 0.66 * -s);
    const d2 = p3(0.75, lerp(0.05, -0.5, lift), 0.66 * -s);
    arms[side] = { plan: dirs(arm[side], ARM_BONES, d1, d2) };
  }
  const straight = (side: Side): LimbSpec => ({ plan: dirs(leg[side], LEG_BONES, p3(-1, 0.03, 0), p3(-1, 0.03, 0)), toe: 170 });
  return frame3(0, spine, { arms, legs: { near: straight("near"), far: straight("far") } });
}

// ---------------------------------------------------------------- seated corkscrew (wger_1477; side + top)

/** Seated, leaning back on straight arms; legs long and lifted, or both knees drawn in and across to `side`. */
function corkscrew(tuck: Side | null): Keyframe {
  const pelvis: Point = [0, -14];
  const chest = along(pelvis, -115, 80);
  const spine: Spine = { pelvis, chest, head: along(chest, -112, 56) };
  const { arm, leg } = roots(spine);
  const arms = {
    near: { plan: chain(arm.near, ARM_BONES, p3(-112, -2, -34), p3(-80, -40, -50)) },
    far: { plan: chain(arm.far, ARM_BONES, p3(-112, -2, 34), p3(-80, -40, 50)) },
  };
  const legs = {} as Record<Side, LimbSpec>;
  for (const side of SIDES) {
    if (!tuck) {
      legs[side] = { plan: dirs(leg[side], LEG_BONES, p3(0.95, -0.31, 0), p3(0.95, -0.31, 0)), toe: -20 };
    } else {
      const z = zOut(tuck) * 56 + (side === tuck ? 0 : zOut(tuck) * -10);
      const foot = p3(74, -46, z * 1.25);
      legs[side] = { plan: chain(leg[side], LEG_BONES, foot, p3(34, -118, z)), toe: 40 };
    }
  }
  return frame3(0, spine, { arms, legs });
}

// ---------------------------------------------------------------- sleeper stretch (wger_1711; side + top)

/**
 * Lying on the near side, belly towards the side camera (head at -x). The bottom (near) arm is out in
 * front at shoulder height, elbow at 90°, the forearm turning from up (`turn` 0) down towards the floor
 * (1) while the top hand presses on its wrist.
 */
function sleeper(turn: number): Keyframe {
  const base = sideLying();
  const spine: Spine = { pelvis: base.pelvis, chest: base.chest, head: base.head, spine: base.spine };
  const { arm } = roots(spine);
  const hipB = p3(0, -30, -HIP_SIDE);
  const hipT = p3(0, -30, HIP_SIDE);
  // Both knees bent forwards (towards the camera), stacked; shins back along the body.
  const legB = dirs(hipB, LEG_BONES, p3(0.04, 0.18, -1), p3(1, 0.02, 0.06));
  const legT = dirs(hipT, LEG_BONES, p3(0.06, -0.1, -1), p3(1, 0.05, 0.06));
  const shoulder = arm.near;
  const elbow = add3(shoulder, p3(0, 0, -BONES.upperArm));
  const fore = (-90 + 104 * turn) * (Math.PI / 180);
  const forearmDir = p3(Math.cos(fore), Math.sin(fore), 0);
  const hand = add3(elbow, scale3(forearmDir, 66));
  const wrist = add3(elbow, add3(scale3(forearmDir, 50), p3(0, 0, 5)));
  const topArm = chain(arm.far, ARM_BONES, wrist, p3(-100, -100, -30));
  const frame = frame3(0, spine, {
    arms: { near: { plan: { mid: elbow, end: hand } }, far: { plan: topArm } },
    legs: { near: { plan: legB, toe: 0 }, far: { plan: legT, toe: 0 } },
  });
  return frame;
}

// ---------------------------------------------------------------- pancake good mornings, the straddle

const PANCAKE_FEET_Z = 84;
const pancakeY = (x: number): number => -round(Math.sqrt(LEG_LEN ** 2 - x * x - (PANCAKE_FEET_Z - 8) ** 2));

/** Wide stance, hands behind the head, elbows out; `hinge` 0 stands tall, 1 hips back with a flat back. */
function standingGoodMorning(hinge: number): Keyframe {
  const x = lerp(0, 34, hinge);
  const pelvis: Point = [-x, pancakeY(x)];
  const spineDeg = lerp(-90, 12, hinge);
  const chest = along(pelvis, spineDeg, 80);
  const head = along(chest, spineDeg + lerp(0, 8, hinge), 56);
  const hand = along(head, spineDeg - 90 - lerp(0, 6, hinge), 24);
  return {
    hold: 0,
    pose: {
      pelvis,
      chest,
      head,
      hands: { near: hand, far: [hand[0] - 2, hand[1]] },
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
      feet: { near: [0, 0], far: [0, 0] },
      toes: { near: 0, far: 0 },
    },
    sideways: {
      feet: { near: -PANCAKE_FEET_Z, far: PANCAKE_FEET_Z },
      hands: { near: -22, far: 22 },
      elbows: { near: { out: 80 }, far: { out: 80 } },
    },
  };
}

const SEAT: Point = [0, -22];
const SLOPE = 4;
const SPLAY = 36;

/** A point `length` down the straddled leg: side-view position and its sideways offset. */
function straddleLeg(length: number): { at: Point; z: number } {
  const slope = (SLOPE * Math.PI) / 180;
  const flatLen = length * Math.cos(slope);
  const splay = (SPLAY * Math.PI) / 180;
  return {
    at: [round(SEAT[0] + flatLen * Math.cos(splay)), round(SEAT[1] + length * Math.sin(slope))],
    z: round(HIP_SIDE + flatLen * Math.sin(splay)),
  };
}
const S_KNEE = straddleLeg(BONES.thigh);
const S_FOOT = straddleLeg(173.9);
const legLineY = (x: number): number => round(SEAT[1] + ((S_FOOT.at[1] - SEAT[1]) * Math.min(x, S_FOOT.at[0])) / S_FOOT.at[0]);

/** Seated in a wide V, toes up, torso `lean` degrees forward of upright. `hands` "floor" or "head". */
function straddle(lean: number, hands: "floor" | "head", handX = 0): Keyframe {
  const spineDeg = -90 + lean;
  const chest = along(SEAT, spineDeg, 80);
  const head = along(chest, spineDeg + lean * 0.15, 56);
  const handY = legLineY(handX);
  const behind = along(head, spineDeg - 90, 24);
  const pose: Pose = {
    pelvis: SEAT,
    chest,
    head,
    hands: hands === "floor" ? { near: [handX, handY], far: [handX - 4, handY] } : { near: behind, far: [behind[0] - 2, behind[1]] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { at: S_KNEE.at }, far: { at: S_KNEE.at } },
    feet: { near: S_FOOT.at, far: S_FOOT.at },
    toes: { near: -80, far: -80 },
  };
  const sideways: Sideways = {
    hands: hands === "floor" ? { near: -30, far: 30 } : { near: -22, far: 22 },
    knees: { near: { at: -S_KNEE.z }, far: { at: S_KNEE.z } },
    feet: { near: -S_FOOT.z, far: S_FOOT.z },
    ...(hands === "head" ? { elbows: { near: { out: 80 }, far: { out: 80 } } } : {}),
  };
  return { hold: 0, pose, sideways };
}

// ---------------------------------------------------------------- specs

export const BATCH_BI_SPECS: DoodleSpec[] = [
  {
    id: "wger_1391",
    slug: "elephant-walks",
    title: "Elephant Walks",
    props: [FLOOR_PROP],
    transition: 0.7,
    frames: [key(fold("near"), 0.2), key(fold("far"), 0.2)],
  },
  {
    id: "wger_1733",
    slug: "isometric-squat-to-failure",
    title: "Isometric Squat to Failure",
    props: [FLOOR_PROP],
    transition: 1.1,
    frames: [key(squat(0), 0.4), key(squat(1), 2)],
  },
  {
    id: "wger_1584",
    slug: "march-or-jog-in-place",
    title: "March or jog in place",
    props: [FLOOR_PROP],
    transition: 0.28,
    frames: [key(march("near")), key(march(null)), key(march("far")), key(march(null))],
  },
  {
    id: "wger_1874",
    slug: "runners-lunge-stretch",
    title: "Runners Lunge Stretch",
    props: [FLOOR_PROP],
    transition: 1.2,
    frames: [key(lowLunge(0), 0.6), key(lowLunge(1), 1.4)],
  },
  {
    id: "wger_1710",
    slug: "butchers-block-stretch",
    title: "Butchers Block Stretch",
    props: [LAT_BENCH, FLOOR_PROP],
    transition: 1.3,
    frames: [key(latStretch(0.7), 0.6), key(latStretch(1), 1.4)],
  },
  {
    id: "fedb_chair_upper_body_stretch",
    slug: "chair-upper-body-stretch",
    title: "Chair Upper Body Stretch",
    props: [CHAIR_SEAT, CHAIR_BACK, FLOOR_PROP],
    transition: 1.2,
    frames: [key(chairStretch(false), 0.6), key(chairStretch(true), 1.4)],
  },
  {
    id: "wger_2685",
    slug: "cross-body-stretch",
    title: "Cross-Body Stretch",
    view: "front",
    props: [FLOOR_PROP],
    transition: 1.2,
    frames: [key(crossBody(0), 0.6), key(crossBody(1), 1.4)],
  },
  {
    id: "fedb_dancers_stretch",
    slug: "dancers-stretch",
    title: "Dancer's Stretch",
    views: TOP_VIEWS,
    props: [FLOOR_PROP],
    transition: 1.3,
    frames: [{ ...dancers(0), hold: 0.6 }, { ...dancers(1), hold: 1.4 }],
  },
  {
    id: "wger_1207",
    slug: "scorpion-kick",
    title: "Scorpion Kick",
    views: TOP_VIEWS,
    props: [FLOOR_PROP],
    transition: 0.8,
    frames: [{ ...scorpionKick(0), hold: 0.3 }, { ...scorpionKick(1), hold: 0.2 }, { ...scorpionKick(2), hold: 0.5 }, { ...scorpionKick(1), hold: 0.1 }],
  },
  {
    id: "hf_168",
    slug: "scorpion-stretch",
    title: "Scorpion Stretch",
    views: TOP_VIEWS,
    props: [FLOOR_PROP],
    transition: 0.9,
    frames: [{ ...proneScorpion(0), hold: 0.3 }, { ...proneScorpion(1), hold: 0.8 }],
  },
  {
    id: "wger_1474",
    slug: "w-raise",
    title: "W-Raise",
    views: TOP_VIEWS,
    props: [FLOOR_PROP],
    transition: 0.8,
    frames: [{ ...wRaise(0), hold: 0.4 }, { ...wRaise(1), hold: 0.8 }],
  },
  {
    id: "wger_1477",
    slug: "seated-corkscrew",
    title: "Seated Corkscrew",
    views: TOP_VIEWS,
    props: [FLOOR_PROP],
    transition: 0.7,
    frames: [corkscrew(null), corkscrew("near"), corkscrew(null), corkscrew("far")],
  },
  {
    id: "wger_1711",
    slug: "sleeper-stretch",
    title: "Sleeper Stretch",
    views: TOP_VIEWS,
    props: [FLOOR_PROP],
    transition: 1.3,
    frames: [{ ...sleeper(0), hold: 0.6 }, { ...sleeper(1), hold: 1.4 }],
  },
  {
    id: "wger_1397",
    slug: "standing-pancake-good-morning",
    title: "Standing Pancake Good Morning",
    views: TWO_VIEWS,
    transition: 1.1,
    frames: [{ ...standingGoodMorning(0), hold: 0.4 }, { ...standingGoodMorning(1), hold: 0.6 }],
  },
  {
    id: "wger_1845",
    slug: "seated-pancake-good-morning",
    title: "Seated Pancake Good Morning",
    views: TWO_VIEWS,
    transition: 1.1,
    frames: [{ ...straddle(4, "head"), hold: 0.4 }, { ...straddle(62, "head"), hold: 0.6 }],
  },
  {
    id: "fedb_the_straddle",
    slug: "the-straddle",
    title: "The Straddle",
    views: TWO_VIEWS,
    transition: 1.2,
    frames: [{ ...straddle(4, "floor", 36), hold: 0.6 }, { ...straddle(30, "floor", 96), hold: 0.2 }, { ...straddle(58, "floor", 140), hold: 1.6 }],
  },
  {
    id: "ntc_incline_archer_push_up",
    slug: "incline-archer-push-up",
    title: "Incline Archer Push-Up",
    views: TWO_VIEWS,
    props: [IA_BENCH, FLOOR_PROP],
    transition: 0.6,
    frames: inclineArcher(),
  },
];
