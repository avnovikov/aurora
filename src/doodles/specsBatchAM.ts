import { BONES, deg, HIP_SIDE, other, SHOULDER_SIDE, solvePose, zOut } from "./rig";
import type { DoodleSpec, Keyframe, Point, Pose, Prop, Side, Sideways } from "./rig";
import { add3, dot3, norm3, scale3, solveKeyframe3, sub3, type Point3 } from "./rig3d";
import { TOP_VIEWS, TWO_VIEWS } from "./sideways";
import { BATCH_AA_SPECS } from "./specsBatchAA";
import { along, round, FLOOR_PROP } from "./geom";

/**
 * Batch AM (#212): core work and twists. Floor at y = 0, up is negative, the
 * side-view figure faces +x; lying face up has the head at -x. Never import
 * ./specs (circular).
 *
 * Every twist is drawn in two views (side + front; the oblique crunch side + top). The rig cannot turn the
 * torso, so a twist is shown by what moves across: an elbow travelling to the
 * opposite knee, hands passing from one side of the hips to the other, a knee or
 * a leg crossing the body, with the near limbs bright over the far ones. The
 * single-leg butt kick stays in side view.
 *
 * Limbs are placed in 3D by `chain` / `dirs` (exact bone lengths); `frame` turns
 * the plans into pins and the keyframe's `sideways` z values, so nothing is typed twice.
 *
 * Left out: hf_170 Side-Lying Thoracic Rotation (see batch AW for why). hf_158
 * 90/90 Hip Switch needs a top view and is drawn in batch AW.
 */

// ---------------------------------------------------------------- 3D limb placement

/** Unit vector; a zero vector stays zero. */
const unit3 = (a: Point3): Point3 => scale3(a, 1 / (norm3(a) || 1));

/** Middle joint and end of a two-bone limb. */
interface Plan {
  mid: Point3;
  end: Point3;
}

const ARM: [number, number] = [BONES.upperArm, BONES.forearm + BONES.hand];
const LEG: [number, number] = [BONES.thigh, BONES.shin];

/**
 * A limb from `root` reaching `end` (pulled in if it is too far) with the middle
 * joint on the `hint` side of the root-end line; both bones keep their lengths.
 */
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

/** A limb given as two directions (each is normalised): the upper bone, then the lower. */
function dirs(root: Point3, [l1, l2]: [number, number], d1: Point3, d2: Point3): Plan {
  const mid = add3(root, scale3(unit3(d1), l1));
  return { mid, end: add3(mid, scale3(unit3(d2), l2)) };
}

/** A straight limb `length` along `d`. */
const straight = (root: Point3, l: [number, number], d: Point3): Plan => dirs(root, l, d, d);

/**
 * An arm with the elbow 60 from the shoulder `toward` a point and the forearm folded back
 * `bendDeg` from the upper arm, swinging round towards `fold` (a point near the head).
 */
function elbowThen(root: Point3, elbowToward: Point3, fold: Point3, bendDeg = 145): Plan {
  const u = unit3(sub3(elbowToward, root));
  const mid = add3(root, scale3(u, ARM[0]));
  const v = sub3(fold, mid);
  const w = unit3(sub3(v, scale3(u, dot3(v, u))));
  const r = (bendDeg * Math.PI) / 180;
  const f = add3(scale3(u, Math.cos(r)), scale3(w, Math.sin(r)));
  return { mid, end: add3(mid, scale3(f, ARM[1])) };
}

interface LimbSpec {
  plan: Plan;
  /** Foot direction (degrees) for a leg. */
  toe?: number;
}

interface Limbs {
  arms?: Partial<Record<Side, LimbSpec>>;
  legs?: Partial<Record<Side, LimbSpec>>;
}

/** Spine pins of a keyframe. */
type Spine = Pick<Pose, "pelvis" | "chest" | "head" | "spine">;

/** Where a limb roots: the solved spine's shoulder and hip, set out sideways about the spine at z = `pz`. */
function roots(spine: Spine, pz: number): { arm: Record<Side, Point3>; leg: Record<Side, Point3> } {
  const solved = solvePose(spine);
  const at = (p: Point, z: number): Point3 => [p[0], p[1], z];
  const sides: Side[] = ["near", "far"];
  const arm = {} as Record<Side, Point3>;
  const leg = {} as Record<Side, Point3>;
  for (const side of sides) {
    arm[side] = at(solved.arms[side].root, pz + zOut(side) * SHOULDER_SIDE);
    leg[side] = at(solved.legs[side].root, pz + zOut(side) * HIP_SIDE);
  }
  return { arm, leg };
}

const flat = (p: Point3): Point => [round(p[0]), round(p[1])];

const SIDES: Side[] = ["near", "far"];

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

/** A keyframe: the spine, plus 3D limb plans that become pins and `sideways` positions. */
function frame(hold: number, spine: Spine, limbs: Limbs, pz = 0): Keyframe {
  const pose: Pose = { ...spine };
  const sideways: Sideways = { pelvis: pz };
  if (limbs.arms) addArms(pose, sideways, limbs.arms);
  if (limbs.legs) addLegs(pose, sideways, limbs.legs);
  return { hold, pose, sideways };
}

// ---------------------------------------------------------------- lying on the back (head at -x)

const PELVIS: Point = [-8, -20];

/** The torso curled up by `theta` (183 lying, about 210 crunched), chin tucked by `tuck`. */
function torso(theta: number, tuck: number, pelvis: Point = PELVIS): Spine {
  const chest = along(pelvis, theta, 80);
  return { pelvis, chest, head: along(chest, theta + tuck, 56) };
}

/** Back of the head, where the hands rest. */
const behindHead = (spine: Spine, theta: number, z: number): Point3 => {
  const head = spine.head as Point;
  const p = along(head, theta - 90, 24);
  return [p[0], p[1], z];
};

/** Hands lightly behind the head; each elbow wide unless `hints` pull it somewhere. */
function handsBehind(spine: Spine, theta: number, hints: Partial<Record<Side, Point3>> = {}, pz = 0): Limbs["arms"] {
  const { arm } = roots(spine, pz);
  const out = {} as Record<Side, LimbSpec>;
  for (const side of ["near", "far"] as Side[]) {
    const s = arm[side];
    const wide: Point3 = [s[0] - 10, s[1] - 6, pz + zOut(side) * 90];
    out[side] = { plan: chain(s, ARM, behindHead(spine, theta, pz + zOut(side) * 24), hints[side] ?? wide) };
  }
  return out;
}

/** Feet flat on the floor at x, z, knees up. */
function flatFoot(spine: Spine, side: Side, x: number, z: number, pz = 0): LimbSpec {
  const hip = roots(spine, pz).leg[side];
  const foot: Point3 = [x, -2, z];
  return { plan: chain(hip, LEG, foot, [(hip[0] + x) / 2, -150, z]), toe: 0 };
}

/** Leg bent with the foot up off the floor: knee over the hip, shin sloping down forward. */
function tucked(spine: Spine, side: Side, kneeAt: Point, shinDeg: number, z: number, pz = 0): LimbSpec {
  const hip = roots(spine, pz).leg[side];
  const knee: Point3 = [kneeAt[0], kneeAt[1], z];
  const d1 = sub3(knee, hip);
  const plan = dirs(hip, LEG, d1, [Math.cos((shinDeg * Math.PI) / 180), Math.sin((shinDeg * Math.PI) / 180), 0]);
  return { plan, toe: round(shinDeg + 10) };
}

/** A straight leg lifted `elev` degrees above the floor line, z kept at the hip's. */
function reachLeg(spine: Spine, side: Side, elev: number, z: number, pz = 0): LimbSpec {
  const hip = roots(spine, pz).leg[side];
  const d: Point3 = [Math.cos((elev * Math.PI) / 180), -Math.sin((elev * Math.PI) / 180), (z - hip[2]) / 174];
  return { plan: straight(hip, LEG, d), toe: round(-elev + 10) };
}

// ---------------------------------------------------------------- cross-body crunch / elbow to knee / oblique crunch

/**
 * The arm on `side` with its elbow reaching `to` (the knee it meets) and the hand folded
 * back towards the head, which the other arm cups wide as usual.
 */
function armsAcross(spine: Spine, theta: number, side: Side, to: Point3): Limbs["arms"] {
  const arms = handsBehind(spine, theta) as Record<Side, LimbSpec>;
  const head = spine.head as Point;
  const shoulder = roots(spine, 0).arm[side];
  const fold: Point3 = [head[0], head[1] + 20, zOut(side) * 30];
  arms[side] = { plan: elbowThen(shoulder, [to[0] + 10, to[1] - 4, to[2]], fold) };
  return arms;
}

/** Cross-body crunch: hands behind the head, one elbow across to the opposite knee, which comes in to meet it. */
function crossBody(side: Side | null): Keyframe {
  const theta = side ? 214 : 186;
  const spine = torso(theta, side ? 14 : 2);
  const legs: Limbs["legs"] = {
    near: flatFoot(spine, "near", 64, -14),
    far: flatFoot(spine, "far", 60, 14),
  };
  if (!side) return frame(0.4, spine, { arms: handsBehind(spine, theta), legs });
  const kneeSide = other(side);
  legs[kneeSide] = tucked(spine, kneeSide, [-24, -106], 28, zOut(side) * 4);
  const knee = (legs[kneeSide] as LimbSpec).plan.mid;
  return frame(0.5, spine, { arms: armsAcross(spine, theta, side, knee), legs });
}

// ---------------------------------------------------------------- air bike / bicycle crunch

/** Bicycle: one elbow to the opposite knee tucked in, the other leg reaching out low. */
function bike(side: Side): Keyframe {
  const theta = 208;
  const spine = torso(theta, 14);
  const kneeSide = other(side);
  const tuckedLeg = tucked(spine, kneeSide, [-20, -104], 30, zOut(side) * 4);
  const legs: Limbs["legs"] = {
    [kneeSide]: tuckedLeg,
    [side]: reachLeg(spine, side, 24, zOut(side) * 8),
  };
  return frame(0.35, spine, { arms: armsAcross(spine, theta, side, tuckedLeg.plan.mid), legs });
}

/** Hands by the sides along the floor, or reaching `x` / `z` for a heel. */
function armAlong(spine: Spine, side: Side, x: number, z: number, pz: number): LimbSpec {
  const shoulder = roots(spine, pz).arm[side];
  return { plan: chain(shoulder, ARM, [x, -7, z], [x, -90, z]) };
}

// ---------------------------------------------------------------- alternate heel touchers

/** Shoulders lifted, feet wide and flat; the near or far hand reaches its own heel (the body bends that way). */
function heelTouch(side: Side | null): Keyframe {
  const theta = 209;
  const spine = torso(theta, 6);
  const pz = side ? zOut(side) * 22 : 0;
  const foot = { near: [34, -2, -38] as Point3, far: [34, -2, 38] as Point3 };
  const legs: Limbs["legs"] = {};
  const arms: Limbs["arms"] = {};
  for (const s of ["near", "far"] as Side[]) {
    const hip = roots(spine, pz).leg[s];
    legs[s] = { plan: chain(hip, LEG, foot[s], [hip[0] + 20, -150, foot[s][2]]), toe: 0 };
    const reach = s === side;
    arms[s] = armAlong(spine, s, reach ? foot[s][0] - 6 : 14, reach ? foot[s][2] : zOut(s) * 44, pz);
  }
  return frame(side ? 0.35 : 0.3, spine, { arms, legs }, pz);
}

// ---------------------------------------------------------------- elbow to knee (figure-four) / oblique crunch

/** The torso curl shared by both. */
const CRUNCH = { theta: 214, tuck: 14 } as const;

/**
 * Elbow to knee: the `raised` knee is the supporting bent leg, the other ankle sits across it
 * (that knee falls out to the side); the opposite elbow rotates to the raised knee.
 */
function elbowKnee(raised: Side, up: boolean): Keyframe {
  const theta = up ? CRUNCH.theta : 186;
  const spine = torso(theta, up ? CRUNCH.tuck : 2);
  const crossed = other(raised);
  const support = flatFoot(spine, raised, 40, zOut(raised) * 14);
  const knee = support.plan.mid;
  const hip = roots(spine, 0).leg[crossed];
  const ankle: Point3 = [knee[0] - 4, knee[1] - 9, knee[2]];
  const cross: LimbSpec = { plan: chain(hip, LEG, ankle, [(hip[0] + ankle[0]) / 2, ankle[1] + 20, zOut(crossed) * 120]), toe: -10 };
  const legs: Limbs["legs"] = { [raised]: support, [crossed]: cross };
  const arms = handsBehind(spine, theta) as Record<Side, LimbSpec>;
  if (up) {
    // The elbow on the raised-knee side crosses the midline to the crossed knee, which has fallen out to the other side.
    arms[raised] = elbowAcross(spine, raised, crossed);
  }
  return frame(up ? 0.5 : 0.4, spine, { arms, legs });
}

/** The `side` arm with its hand by the ear and its elbow swung across the midline towards the `towards` side. */
function elbowAcross(spine: Spine, side: Side, towards: Side, reach = 52): LimbSpec {
  const shoulder = roots(spine, 0).arm[side];
  const head = spine.head as Point;
  const toward: Point3 = [shoulder[0] + 26, shoulder[1] - 24, shoulder[2] + zOut(towards) * reach];
  return { plan: chain(shoulder, ARM, [head[0] + 6, head[1] + 14, zOut(side) * 34], toward) };
}

/** The bench or chair the feet rest on. */
const BENCH: Prop = { kind: "box", x: 60, y: -80, w: 120, h: 80, frontHalf: 26 };

/** Sideways lean of the chest (towards the opposite knee) as the working shoulder lifts. */
const OBLIQUE_LEAN = 14;

/**
 * Oblique crunch (side + top view): feet on a bench, `working` hand beside the head, the
 * other arm on the floor. Lifting, the chest leans across towards the opposite knee and the
 * working elbow swings over the body to it, so from above the elbow crosses the midline.
 */
function oblique(working: Side, up: boolean): Keyframe {
  const theta = up ? 232 : 186;
  const spine = torso(theta, up ? CRUNCH.tuck : 2);
  const rest = other(working);
  const legs: Limbs["legs"] = {};
  for (const s of ["near", "far"] as Side[]) {
    const hip = roots(spine, 0).leg[s];
    const foot: Point3 = [96, -82, zOut(s) * 18];
    legs[s] = { plan: chain(hip, LEG, foot, [(hip[0] + 96) / 2, -150, zOut(s) * 40]), toe: 0 };
  }
  const chestZ = up ? zOut(rest) * OBLIQUE_LEAN : 0;
  // Shoulders and head after the lean: the arms root there.
  const leaned = solveKeyframe3(solvePose(spine), spine, { chest: chestZ });
  const shoulder = (side: Side): Point3 => leaned.arms[side].root as Point3;
  const head = leaned.head as Point3;
  const arms: Limbs["arms"] = {};
  if (up) {
    // The elbow points across the body at the opposite knee; the forearm folds back to the hand by the ear.
    const knee = (legs[rest] as LimbSpec).plan.mid;
    const s0 = shoulder(working);
    const mid = add3(s0, scale3(unit3(sub3([knee[0], knee[1], knee[2] + zOut(rest) * 45], s0)), ARM[0]));
    const ear: Point3 = [head[0] - 14, head[1] - 4, head[2] + zOut(working) * 40];
    arms[working] = { plan: { mid, end: add3(mid, scale3(unit3(sub3(ear, mid)), ARM[1])) } };
  } else {
    const s0 = shoulder(working);
    arms[working] = { plan: chain(s0, ARM, behindHead(spine, theta, zOut(working) * 24), [s0[0] + 10, s0[1] - 40, zOut(working) * 90]) };
  }
  const sr = shoulder(rest);
  arms[rest] = { plan: chain(sr, ARM, [12, -7, sr[2] + zOut(rest) * 24], [12, -90, sr[2] + zOut(rest) * 24]) };
  const key = frame(up ? 0.5 : 0.4, spine, { arms, legs });
  return { ...key, sideways: { ...key.sideways, chest: chestZ } };
}

// ---------------------------------------------------------------- windmills (lying, arms out, one straight leg across)

/** Lying flat with arms straight out to the sides on the floor; `lifted` is the leg that swings (`phi` degrees from straight up, towards the far side). */
function windmill(lifted: Side, phi: number): Keyframe {
  const spine = torso(184, 2);
  const { arm, leg } = roots(spine, 0);
  const arms: Limbs["arms"] = {};
  for (const s of ["near", "far"] as Side[]) {
    arms[s] = { plan: chain(arm[s], ARM, [arm[s][0] + 12, -9, zOut(s) * (SHOULDER_SIDE + 124)], [arm[s][0], -80, zOut(s) * 60]) };
  }
  const down = reachLeg(spine, other(lifted), 3, zOut(other(lifted)) * HIP_SIDE);
  const r = (phi * Math.PI) / 180;
  const d: Point3 = [0.08, -Math.cos(r), -zOut(lifted) * Math.sin(r)];
  const swing: LimbSpec = { plan: straight(leg[lifted], LEG, d), toe: -90 };
  return frame(0.4, spine, { arms, legs: { [lifted]: swing, [other(lifted)]: down } });
}

// ---------------------------------------------------------------- standing helpers

const dir2 = (degrees: number, z = 0): Point3 => [Math.cos(deg(degrees)), Math.sin(deg(degrees)), z];

/** Upright (or leaning) spine from the pelvis: `lean` degrees from vertical towards +x. */
function upright(pelvis: Point, lean = 0): Spine {
  return { pelvis, chest: along(pelvis, -90 + lean, 80) };
}

/** Forearms folded with the hands clasped at `hand`, elbows hinted outward and down. */
function claspedArms(spine: Spine, hand: Point3, flare = 30): Limbs["arms"] {
  const { arm } = roots(spine, 0);
  const out = {} as Record<Side, LimbSpec>;
  for (const side of ["near", "far"] as Side[]) {
    out[side] = { plan: chain(arm[side], ARM, hand, [hand[0] - 14, hand[1] + 36, hand[2] + zOut(side) * flare]) };
  }
  return out;
}

// ---------------------------------------------------------------- crossover reverse lunge


/**
 * Reverse lunge, near leg in front (shin upright, thigh level), far leg stepped back with the
 * knee just off the floor. The clasped hands start in front of the chest and the torso rotates
 * over the front leg: the hands swing round to the near side (`turn` degrees, 0 to 85).
 */
function crossoverLunge(down: boolean, turn: number): Keyframe {
  const spine = down ? upright([-58, -88]) : upright([0, -172]);
  const { leg, arm } = roots(spine, 0);
  const legs: Limbs["legs"] = down
    ? {
        near: { plan: chain(leg.near, LEG, [30, -2, -8], [90, -60, -8]), toe: 0 },
        far: { plan: chain(leg.far, LEG, [-200, -22, 8], [-114, -6, 8]), toe: 80 },
      }
    : {
        near: { plan: chain(leg.near, LEG, [4, -2, -9], [60, -90, -9]), toe: 0 },
        far: { plan: chain(leg.far, LEG, [-2, -2, 9], [60, -90, 9]), toe: 0 },
      };
  const shoulder = arm.near;
  const reach = 66;
  const t = deg(turn);
  const hand: Point3 = [shoulder[0] + reach * Math.cos(t) + 4, shoulder[1] + 36, -reach * Math.sin(t)];
  return frame(down ? 0.5 : 0.4, spine, { arms: claspedArms(spine, hand), legs });
}

// ---------------------------------------------------------------- single-leg butt kick

/**
 * Hopping on the near leg with the far knee held up in front. `pelvisY` is the hip height and
 * `kick` folds the jumping leg (0 straight under the hip, 1 heel to the glute).
 */
function buttKick(pelvisY: number, kick: number): Keyframe {
  const spine = upright([0, pelvisY]);
  const { leg, arm } = roots(spine, 0);
  const air = pelvisY < -176;
  let near: LimbSpec;
  if (kick > 0) {
    const knee = dir2(88 - 6 * kick);
    near = { plan: dirs(leg.near, LEG, knee, dir2(232)), toe: 130 };
  } else {
    const ankleY = air ? pelvisY + 168 : -2;
    near = { plan: chain(leg.near, LEG, [0, ankleY, -8], [70, (pelvisY + ankleY) / 2, -8]), toe: air ? 80 : 0 };
  }
  const far: LimbSpec = { plan: dirs(leg.far, LEG, dir2(-14), dir2(92)), toe: 0 };
  const arms: Limbs["arms"] = {
    near: { plan: dirs(arm.near, ARM, dir2(70), dir2(-5)) },
    far: { plan: dirs(arm.far, ARM, dir2(115), dir2(45)) },
  };
  const { hold, pose } = frame(0.3, spine, { arms, legs: { near, far } });
  return { hold, pose };
}

// ---------------------------------------------------------------- Russian twist

/** Seated V, leaning back with the feet lifted and the hands clasped; the hands swing to the near (`turn` < 0) or far side. */
function russianTwist(turn: number): Keyframe {
  const pelvis: Point = [0, -14];
  const spine: Spine = { pelvis, chest: along(pelvis, 235, 80) };
  const { leg } = roots(spine, 0);
  const legs: Limbs["legs"] = {};
  for (const side of ["near", "far"] as Side[]) {
    legs[side] = { plan: dirs(leg[side], LEG, dir2(-50), dir2(12)), toe: 40 };
  }
  const chest = spine.chest as Point;
  const forward = dir2(325);
  const t = deg(turn);
  const hand: Point3 = [chest[0] + 54 * forward[0] * Math.cos(t), chest[1] + 54 * forward[1] * Math.cos(t), 54 * Math.sin(t)];
  return frame(0.45, spine, { arms: claspedArms(spine, hand, 34), legs });
}

// ---------------------------------------------------------------- quadruped thoracic rotation

/** Hands and knees: hands under the shoulders, knees under the hips, back flat. */
const QUAD_PELVIS: Point = [-92, -93];
const QUAD_SPINE: Spine = { pelvis: QUAD_PELVIS, chest: along(QUAD_PELVIS, -20.3, 80) };

/** The support limbs of the quadruped: both knees on the floor, the far hand planted. */
function quadruped(spine: Spine): { legs: NonNullable<Limbs["legs"]>; far: LimbSpec; shoulder: Point3; head: Point3 } {
  const { arm, leg } = roots(spine, 0);
  const solved = solvePose(spine);
  const legs: NonNullable<Limbs["legs"]> = {};
  for (const side of ["near", "far"] as Side[]) {
    legs[side] = { plan: dirs(leg[side], LEG, [0, 1, zOut(side) * 0.1], [-1, 0, 0]), toe: 180 };
  }
  const far: LimbSpec = { plan: chain(arm.far, ARM, [arm.far[0] + 2, -3, SHOULDER_SIDE], [arm.far[0] + 30, -60, SHOULDER_SIDE]) };
  return { legs, far, shoulder: arm.near, head: [solved.head[0], solved.head[1], 0] };
}

/**
 * Open book from all fours: the near hand stays behind the head while its elbow rotates down
 * towards the far hand (`up` false) and then opens to the ceiling, towards the near side.
 */
function thoracic(up: boolean): Keyframe {
  const { legs, far, shoulder, head } = quadruped(QUAD_SPINE);
  const ear: Point3 = [head[0] + 2, head[1] + 2, -26];
  const hint: Point3 = up ? [shoulder[0], shoulder[1] - 80, -90] : [shoulder[0] + 6, shoulder[1] + 80, 10];
  const near: LimbSpec = { plan: chain(shoulder, ARM, ear, hint) };
  return frame(0.6, QUAD_SPINE, { arms: { near, far }, legs });
}

// ---------------------------------------------------------------- kick-through

/** Bear crawl: hands under the shoulders, feet back, knees hovering just off the floor. */

/**
 * Kick-through: from the crawl the near hand lifts and the hips turn to that side (`turn` 0 to
 * 1), while the far leg threads under the body and out past the near hand, straight at `turn` 1.
 */
function kickThrough(turn: number): Keyframe {
  const rise = 14 * turn;
  const pelvis: Point = [-95 + 8 * turn, -103 - rise];
  const spine: Spine = { pelvis, chest: along(pelvis, -14.7 - 6 * turn, 80) };
  const { arm, leg } = roots(spine, 0);
  const handNear: Point3 = [arm.near[0] + 4 * (1 - turn) + 14 * turn, -3 - 150 * turn, -22 - 40 * turn];
  const arms: Limbs["arms"] = {
    near: { plan: chain(arm.near, ARM, handNear, [arm.near[0] + 20 * (1 - turn) - 10 * turn, arm.near[1] + 40, -22 - 40 * turn]) },
    far: { plan: chain(arm.far, ARM, [arm.far[0] + 2, -3, 22], [arm.far[0] + 30, -60, 22]) },
  };
  const near: LimbSpec = { plan: chain(leg.near, LEG, [-140, -19, -8], [leg.near[0] + 40, -25, -8]), toe: 75 };
  const through: Point3 = [leg.far[0] + 108 * turn - 56 * (1 - turn), -2 - 13 * turn, 8 - 98 * turn];
  const farFoot: Point3 = turn === 0 ? [-140, -19, 8] : through;
  let farToe = 75;
  if (turn > 0.5) farToe = -70;
  else if (turn > 0) farToe = 20;
  const far: LimbSpec = { plan: chain(leg.far, LEG, farFoot, turn === 0 ? [leg.far[0] + 40, -25, 8] : [(leg.far[0] + farFoot[0]) / 2 + 20, -30 - 40 * (1 - turn), 8 - 50 * turn]), toe: farToe };
  return frame(0.5, spine, { arms, legs: { near, far } });
}

/** Archer push-up hold: the archer push-up's own keyframes, with a long hold at the bottom. */
function archerHold(): Keyframe[] {
  const archerPushUp = BATCH_AA_SPECS.find((spec) => spec.id === "hf_6");
  if (!archerPushUp) throw new Error("specsBatchAM: archer push-up hf_6 missing from batch AA");
  return archerPushUp.frames.map((f, i) => (i === 2 ? { ...f, hold: 2 } : f));
}

/** The bicycle crunch is the air bike under another name (hf_115 reuses it). */
const AIR_BIKE: DoodleSpec = {
  id: "fedb_air_bike",
  slug: "air-bike",
  title: "Air Bike",
  views: TWO_VIEWS,
  transition: 0.7,
  frames: [bike("near"), bike("far")],
};

export const BATCH_AM_SPECS: DoodleSpec[] = [
  {
    id: "fedb_cross_body_crunch",
    slug: "cross-body-crunch",
    title: "Cross-Body Crunch",
    views: TWO_VIEWS,
    transition: 0.7,
    frames: [crossBody(null), crossBody("near"), crossBody(null), crossBody("far")],
  },
  AIR_BIKE,
  { ...AIR_BIKE, id: "hf_115", slug: "bicycle-crunch", title: "Bicycle Crunch" },
  {
    id: "fedb_alternate_heel_touchers",
    slug: "alternate-heel-touchers",
    title: "Alternate Heel Touchers",
    views: TWO_VIEWS,
    transition: 0.5,
    frames: [heelTouch("near"), heelTouch(null), heelTouch("far"), heelTouch(null)],
  },
  {
    id: "fedb_elbow_to_knee",
    slug: "elbow-to-knee",
    title: "Elbow to Knee",
    views: TWO_VIEWS,
    transition: 0.7,
    frames: [elbowKnee("near", false), elbowKnee("near", true), elbowKnee("far", false), elbowKnee("far", true)],
  },
  {
    id: "fedb_oblique_crunches",
    slug: "oblique-crunches",
    title: "Oblique Crunches",
    views: TOP_VIEWS,
    props: [BENCH],
    transition: 0.7,
    frames: [oblique("near", false), oblique("near", true), oblique("far", false), oblique("far", true)],
  },
  {
    id: "fedb_windmills",
    slug: "windmills",
    title: "Windmills",
    views: TWO_VIEWS,
    transition: 0.8,
    frames: [windmill("near", 0), windmill("near", 72), windmill("near", 0), windmill("far", 0), windmill("far", 72), windmill("far", 0)],
  },
  {
    id: "fedb_crossover_reverse_lunge",
    slug: "crossover-reverse-lunge",
    title: "Crossover Reverse Lunge",
    views: TWO_VIEWS,
    props: [FLOOR_PROP],
    transition: 0.6,
    frames: [crossoverLunge(false, 0), crossoverLunge(true, 0), crossoverLunge(true, 80), crossoverLunge(true, 0)],
  },
  {
    id: "fedb_single_leg_butt_kick",
    slug: "single-leg-butt-kick",
    title: "Single Leg Butt Kick",
    props: [FLOOR_PROP],
    transition: 0.25,
    frames: [buttKick(-170, 0), buttKick(-138, 0), buttKick(-205, 0), buttKick(-224, 1), buttKick(-150, 0)],
  },
  {
    id: "hf_114",
    slug: "russian-twist",
    title: "Russian Twist",
    views: TWO_VIEWS,
    props: [FLOOR_PROP],
    transition: 0.7,
    frames: [russianTwist(-80), russianTwist(0), russianTwist(80), russianTwist(0)],
  },
  {
    id: "hf_155",
    slug: "quadruped-thoracic-rotation",
    title: "Quadruped Thoracic Rotation",
    views: TWO_VIEWS,
    props: [FLOOR_PROP],
    transition: 0.9,
    frames: [thoracic(false), thoracic(true)],
  },
  {
    id: "hf_144",
    slug: "front-kickthrough",
    title: "Front Kickthrough",
    views: TWO_VIEWS,
    props: [FLOOR_PROP],
    transition: 0.6,
    frames: [kickThrough(0), kickThrough(0.5), kickThrough(1), kickThrough(0.5)],
  },
  {
    id: "ntc_archer_push_up_hold",
    slug: "archer-push-up-hold",
    title: "Archer Push-Up Hold",
    views: TWO_VIEWS,
    transition: 0.6,
    frames: archerHold(),
  },
];
