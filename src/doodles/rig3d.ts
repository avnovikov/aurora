/**
 * Dual-view doodles (docs/superpowers/specs/2026-11-18-dual-view-doodles-design.md).
 *
 * The 2D rig still solves the spine and sets the timing. On top of it the four
 * limbs are solved in 3D, using the keyframe's `sideways` positions (z), so
 * every bone keeps its true length while each view draws it at its own,
 * usually shorter, length:
 *
 *   side view   (x, y)   forward × height
 *   front view  (z, y)   sideways × height, near side (z < 0) on the left
 */
import {
  BONES,
  HIP_SIDE,
  SHOULDER_SIDE,
  sampleTimeline,
  solveKeyframes,
  type Bend,
  type DoodleSpec,
  type Pose,
  type Side,
  type Sideways,
  type Solved,
} from "./rig";

export type Point3 = readonly [number, number, number];

export interface Limb3 {
  /** Shoulder or hip. */
  root: Point3;
  /** Elbow or knee. */
  mid: Point3;
  /** Wrist or ankle. */
  joint: Point3;
  /** Hand tip or toe. */
  end: Point3;
}

export interface Pin3 {
  joint: string;
  target: Point3;
  actual: Point3;
}

export interface Figure3 {
  pelvis: Point3;
  waist: Point3;
  chest: Point3;
  neck: Point3;
  head: Point3;
  arms: Record<Side, Limb3>;
  legs: Record<Side, Limb3>;
  pins: Pin3[];
}

const SIDES: Side[] = ["near", "far"];

// ---------------------------------------------------------------- vectors

const add = (a: Point3, b: Point3): Point3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Point3, b: Point3): Point3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: Point3, k: number): Point3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: Point3, b: Point3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Point3, b: Point3): Point3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a: Point3): number => Math.hypot(a[0], a[1], a[2]);
export const dist3 = (a: Point3, b: Point3): number => norm(sub(a, b));
const lerp3 = (a: Point3, b: Point3, t: number): Point3 => add(a, scale(sub(b, a), t));
const deg = (degrees: number): number => (degrees * Math.PI) / 180;
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const Z: Point3 = [0, 0, 1];
const DOWN: Point3 = [0, 1, 0];

function unit(v: Point3, fallback: Point3 = DOWN): Point3 {
  const n = norm(v);
  return n < 1e-9 ? fallback : scale(v, 1 / n);
}

/** `v` with its component along unit `d` removed, normalised. */
function perpendicular(v: Point3, d: Point3, fallback: Point3): Point3 {
  const p = sub(v, scale(d, dot(v, d)));
  if (norm(p) > 1e-6) return unit(p);
  const f = sub(fallback, scale(d, dot(fallback, d)));
  if (norm(f) > 1e-6) return unit(f);
  const axis: Point3 = Math.abs(d[2]) < 0.9 ? Z : [1, 0, 0];
  return unit(cross(d, axis));
}

/** Rodrigues: `v` turned by `angle` about unit `axis`. */
function rotateAbout(v: Point3, axis: Point3, angle: number): Point3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return add(add(scale(v, c), scale(cross(axis, v), s)), scale(axis, dot(axis, v) * (1 - c)));
}

/** Great-circle blend of two unit vectors; opposite vectors turn about z (in the side view's plane). */
export function slerp(a: Point3, b: Point3, t: number): Point3 {
  const omega = Math.acos(clamp(dot(a, b), -1, 1));
  if (omega < 1e-6) return unit(lerp3(a, b, t), a);
  if (Math.PI - omega < 1e-3) return rotateAbout(a, perpendicular(Z, a, [1, 0, 0]), omega * t);
  const s = Math.sin(omega);
  return add(scale(a, Math.sin((1 - t) * omega) / s), scale(b, Math.sin(t * omega) / s));
}

const lift = (p: readonly [number, number], z: number): Point3 => [p[0], p[1], z];
const outward = (side: Side): number => (side === "near" ? -1 : 1);

// ---------------------------------------------------------------- limb solve

/**
 * Bend direction for a limb from `root` towards direction `d`: the 2D rig's
 * bend side in the side view's plane, rolled `out` degrees about `d` towards
 * the limb's own side.
 */
export function bendNormal(d: Point3, bend: Bend, out: number, side: Side): Point3 {
  // cross(z, d) is the 2D rig's "+90°" turn of d, so bend +1 matches solveJoint.
  const n = scale(perpendicular(cross(Z, d), d, [0, -1, 0]), bend);
  if (!out) return n;
  const a = rotateAbout(n, d, deg(out));
  const b = rotateAbout(n, d, -deg(out));
  return a[2] * outward(side) >= b[2] * outward(side) ? a : b;
}

/** Two-bone solve towards `target`, the middle joint on the `normal` side. */
function twoBone(root: Point3, target: Point3, l1: number, l2: number, normal: Point3): { mid: Point3; tip: Point3 } {
  const delta = sub(target, root);
  const d = unit(delta);
  const reach = clamp(norm(delta), Math.abs(l1 - l2) + 1e-6, l1 + l2 - 1e-6);
  const cos = clamp((l1 * l1 + reach * reach - l2 * l2) / (2 * l1 * reach), -1, 1);
  const n = perpendicular(normal, d, [0, -1, 0]);
  const mid = add(root, scale(add(scale(d, cos), scale(n, Math.sqrt(1 - cos * cos))), l1));
  return { mid, tip: add(mid, scale(unit(sub(target, mid), d), l2)) };
}

interface LimbInput {
  side: Side;
  root: Point3;
  names: [mid: string, end: string];
  l1: number;
  l2: number;
  l3: number;
  /** Pinned contact (fingertip, or wrist / ankle when `endAngle` is set). */
  target?: Point3;
  midPin?: Point3;
  bend: Bend;
  out: number;
  /** End bone direction (radians, xy plane); undefined: fingertip continues the forearm. */
  endAngle?: number | "squareToShin";
}

function solveLimb3(input: LimbInput, pins: Pin3[]): Limb3 {
  const { root, l1, l2, l3, names } = input;
  const angled = input.endAngle !== undefined;
  const lower = angled ? l2 : l2 + l3;
  const goal = input.target ?? add(root, [0, (l1 + lower) * 0.98, 0]);
  let mid: Point3;
  let tip: Point3;
  if (input.midPin) {
    mid = add(root, scale(unit(sub(input.midPin, root)), l1));
    pins.push({ joint: names[0], target: input.midPin, actual: mid });
    tip = input.target
      ? add(mid, scale(unit(sub(input.target, mid)), lower))
      : add(mid, scale(unit(sub(mid, root)), lower));
  } else {
    const d = unit(sub(goal, root));
    ({ mid, tip } = twoBone(root, goal, l1, lower, bendNormal(d, input.bend, input.out, input.side)));
  }
  if (input.target) pins.push({ joint: names[1], target: input.target, actual: tip });
  if (!angled) return { root, mid, joint: add(mid, scale(unit(sub(tip, mid)), l2)), end: tip };
  const angle =
    input.endAngle === "squareToShin"
      ? Math.atan2(tip[1] - mid[1], tip[0] - mid[0]) - Math.PI / 2
      : (input.endAngle as number);
  return { root, mid, joint: tip, end: add(tip, [Math.cos(angle) * l3, Math.sin(angle) * l3, 0]) };
}

// ---------------------------------------------------------------- keyframe

/** Shoulder and hip roots: the 2D side-view roots, set out sideways about the spine. */
function roots(spine: Solved, z: number): { arms: Record<Side, Point3>; legs: Record<Side, Point3> } {
  const arms = {} as Record<Side, Point3>;
  const legs = {} as Record<Side, Point3>;
  for (const side of SIDES) {
    arms[side] = lift(spine.arms[side].root, z + outward(side) * SHOULDER_SIDE);
    legs[side] = lift(spine.legs[side].root, z + outward(side) * HIP_SIDE);
  }
  return { arms, legs };
}

function spineOf(spine: Solved, z: number): Pick<Figure3, "pelvis" | "waist" | "chest" | "neck" | "head"> {
  return {
    pelvis: lift(spine.pelvis, z),
    waist: lift(spine.waist, z),
    chest: lift(spine.chest, z),
    neck: lift(spine.neck, z),
    head: lift(spine.head, z),
  };
}

/**
 * Solve one keyframe in 3D. `spine` is the 2D side-view solve of the same pose
 * (it supplies the spine and the shoulder / hip positions).
 */
export function solveKeyframe3(spine: Solved, pose: Pose, sideways: Sideways | undefined): Figure3 {
  const z = sideways?.pelvis ?? 0;
  const root = roots(spine, z);
  const pins: Pin3[] = [];
  const arms = {} as Record<Side, Limb3>;
  const legs = {} as Record<Side, Limb3>;
  for (const side of SIDES) {
    arms[side] = solveLimb3(armInput(pose, sideways, side, root.arms[side]), pins);
    legs[side] = solveLimb3(legInput(pose, sideways, side, root.legs[side]), pins);
  }
  return { ...spineOf(spine, z), arms, legs, pins };
}

/** The keyframe's sideways positions for one limb. */
function sideHints(sideways: Sideways | undefined, side: Side, limb: "arm" | "leg") {
  const s = sideways ?? {};
  const contact = limb === "arm" ? s.hands : s.feet;
  const mid = (limb === "arm" ? s.elbows : s.knees)?.[side];
  return { contactZ: contact?.[side], midZ: mid?.at, out: mid?.out ?? 0 };
}

/** A pinned 2D point lifted to its sideways position (default: the limb root's z). */
const placed = (p: readonly [number, number] | undefined, z: number | undefined, root: Point3): Point3 | undefined =>
  p && lift(p, z ?? root[2]);

function armInput(pose: Pose, sideways: Sideways | undefined, side: Side, root: Point3): LimbInput {
  const hints = sideHints(sideways, side, "arm");
  const elbow = pose.elbows?.[side];
  const wrist = pose.wrists?.[side];
  return {
    side,
    root,
    names: [`elbows.${side}`, `hands.${side}`],
    l1: BONES.upperArm,
    l2: BONES.forearm,
    l3: BONES.hand,
    target: placed(pose.hands?.[side], hints.contactZ, root),
    midPin: placed(elbow?.at, hints.midZ, root),
    bend: elbow?.bend ?? 1,
    out: hints.out,
    endAngle: wrist === undefined ? undefined : deg(wrist),
  };
}

function legInput(pose: Pose, sideways: Sideways | undefined, side: Side, root: Point3): LimbInput {
  const hints = sideHints(sideways, side, "leg");
  const knee = pose.knees?.[side];
  const toe = pose.toes?.[side];
  return {
    side,
    root,
    names: [`knees.${side}`, `feet.${side}`],
    l1: BONES.thigh,
    l2: BONES.shin,
    l3: BONES.foot,
    target: placed(pose.feet?.[side], hints.contactZ, root),
    midPin: placed(knee?.at, hints.midZ, root),
    bend: knee?.bend ?? -1,
    out: hints.out,
    endAngle: toe === undefined ? "squareToShin" : deg(toe),
  };
}

// ---------------------------------------------------------------- timeline

/** Same rules as the 2D rig: ends that move further than this swing, floor contacts slide. */
const SWING_THRESHOLD = 24;
const FLOOR_CONTACT = 10;
const ease = (t: number): number => 0.5 - Math.cos(Math.PI * t) / 2;

export interface Timeline3 {
  duration: number;
  keyTimes: number[];
  poses: Figure3[];
  /** Index into `poses` of each keyframe. */
  keyframeIndex: number[];
}

/** Bend-plane normal of a solved limb (towards the middle joint). */
function normalOf(limb: Limb3, contact: Point3): Point3 {
  const d = unit(sub(contact, limb.root));
  return perpendicular(sub(limb.mid, limb.root), d, [0, -1, 0]);
}

interface BlendLimb {
  a: Limb3;
  b: Limb3;
  root: Point3;
  t: number;
  pinned: [boolean, boolean];
  l1: number;
  l2: number;
  l3: number;
  /** Feet, and hands with a bent wrist: the contact is the joint and the end bone blends by direction. */
  angled: boolean;
}

function blendLimb({ a, b, root, t, pinned, l1, l2, l3, angled }: BlendLimb): Limb3 {
  const contactA = angled ? a.joint : a.end;
  const contactB = angled ? b.joint : b.end;
  const lower = angled ? l2 : l2 + l3;
  const onFloor = contactA[1] > -FLOOR_CONTACT && contactB[1] > -FLOOR_CONTACT;
  const planted = pinned[0] && pinned[1] && (dist3(contactA, contactB) < SWING_THRESHOLD || onFloor);
  let mid: Point3;
  let tip: Point3;
  if (planted) {
    const normal = slerp(normalOf(a, contactA), normalOf(b, contactB), t);
    ({ mid, tip } = twoBone(root, lerp3(contactA, contactB, t), l1, lower, normal));
  } else {
    const upper = slerp(unit(sub(a.mid, a.root)), unit(sub(b.mid, b.root)), t);
    const fore = slerp(unit(sub(contactA, a.mid)), unit(sub(contactB, b.mid)), t);
    mid = add(root, scale(upper, l1));
    tip = add(mid, scale(fore, lower));
  }
  if (!angled) return { root, mid, joint: add(mid, scale(unit(sub(tip, mid)), l2)), end: tip };
  const endDir = slerp(unit(sub(a.end, a.joint)), unit(sub(b.end, b.joint)), t);
  return { root, mid, joint: tip, end: add(tip, scale(endDir, l3)) };
}

/** Sample the loop: the 2D timeline's timing and spine, limbs blended in 3D. */
export function sampleTimeline3(spec: DoodleSpec, stepsPerTransition = 14): Timeline3 {
  const flat = sampleTimeline(spec, stepsPerTransition);
  const keys = solveKeyframes(spec);
  const zs = spec.frames.map((frame) => frame.sideways?.pelvis ?? 0);
  const solved = keys.map((key, i) => solveKeyframe3(key.solved, key.pose, spec.frames[i].sideways));
  const poses: Figure3[] = [];
  spec.frames.forEach((_, index) => {
    const next = (index + 1) % keys.length;
    const [pa, pb] = [keys[index].pose, keys[next].pose];
    const [a, b] = [solved[index], solved[next]];
    // Keyframe, then the transition samples (step 0 is the keyframe again, as in the 2D timeline).
    poses.push(a, a);
    for (let step = 1; step < stepsPerTransition; step += 1) {
      const t = ease(step / stepsPerTransition);
      const spine = flat.poses[flat.keyframeIndex[index] + 1 + step];
      const z = zs[index] + (zs[next] - zs[index]) * t;
      const root = roots(spine, z);
      const arms = {} as Record<Side, Limb3>;
      const legs = {} as Record<Side, Limb3>;
      for (const side of SIDES) {
        const wristed = pa.wrists?.[side] !== undefined || pb.wrists?.[side] !== undefined;
        arms[side] = blendLimb({
          a: a.arms[side],
          b: b.arms[side],
          root: root.arms[side],
          t,
          pinned: [Boolean(pa.hands?.[side]), Boolean(pb.hands?.[side])],
          l1: BONES.upperArm,
          l2: BONES.forearm,
          l3: BONES.hand,
          angled: wristed,
        });
        legs[side] = blendLimb({
          a: a.legs[side],
          b: b.legs[side],
          root: root.legs[side],
          t,
          pinned: [Boolean(pa.feet?.[side]), Boolean(pb.feet?.[side])],
          l1: BONES.thigh,
          l2: BONES.shin,
          l3: BONES.foot,
          angled: true,
        });
      }
      poses.push({ ...spineOf(spine, z), arms, legs, pins: [] });
    }
  });
  poses.push(solved[0]);
  return { duration: flat.duration, keyTimes: flat.keyTimes, poses, keyframeIndex: flat.keyframeIndex };
}
