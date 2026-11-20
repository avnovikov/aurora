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
  clamp,
  deg,
  ease,
  FLOOR_CONTACT,
  HIP_SIDE,
  SHOULDER_SIDE,
  sampleTimeline,
  SWING_THRESHOLD,
  zOut,
  type Bend,
  type DoodleSpec,
  type Girdle,
  type Pose,
  type Side,
  type Sideways,
  type Solved,
} from "./rig";
import { tiltHeads } from "./face";

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

interface Pin3 {
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
  /**
   * The chest's sideways direction (unit, near to far) when the shoulders are
   * rolled or moved (`sideways.twist` / `shoulders`); the face turns with it.
   * Absent: the line from the near to the far shoulder.
   */
  across?: Point3;
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

/** Vector helpers for the batch files (same arithmetic as the solver). */
export { add as add3, sub as sub3, scale as scale3, dot as dot3, norm as norm3 };
const lerp3 = (a: Point3, b: Point3, t: number): Point3 => add(a, scale(sub(b, a), t));
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
function slerp(a: Point3, b: Point3, t: number): Point3 {
  const omega = Math.acos(clamp(dot(a, b), -1, 1));
  if (omega < 1e-6) return unit(lerp3(a, b, t), a);
  if (Math.PI - omega < 1e-3) return rotateAbout(a, perpendicular(Z, a, [1, 0, 0]), omega * t);
  const s = Math.sin(omega);
  return add(scale(a, Math.sin((1 - t) * omega) / s), scale(b, Math.sin(t * omega) / s));
}

const lift = (p: readonly [number, number], z: number): Point3 => [p[0], p[1], z];

// ---------------------------------------------------------------- limb solve

/**
 * Bend direction for a limb from `root` towards direction `d`: the 2D rig's
 * bend side in the side view's plane, rolled `out` degrees about `d` towards
 * the limb's own side.
 */
function bendNormal(d: Point3, bend: Bend, out: number, side: Side): Point3 {
  // cross(z, d) is the 2D rig's "+90°" turn of d, so bend +1 matches solveJoint.
  const n = scale(perpendicular(cross(Z, d), d, [0, -1, 0]), bend);
  if (!out) return n;
  const a = rotateAbout(n, d, deg(out));
  const b = rotateAbout(n, d, -deg(out));
  return a[2] * zOut(side) >= b[2] * zOut(side) ? a : b;
}

/** Two-bone solve towards `target`, the middle joint on the `normal` side. */
export function twoBone(root: Point3, target: Point3, l1: number, l2: number, normal: Point3): { mid: Point3; tip: Point3 } {
  const delta = sub(target, root);
  const d = unit(delta);
  const reach = clamp(norm(delta), Math.abs(l1 - l2) + 1e-6, l1 + l2 - 1e-6);
  const cos = clamp((l1 * l1 + reach * reach - l2 * l2) / (2 * l1 * reach), -1, 1);
  const n = perpendicular(normal, d, [0, -1, 0]);
  const mid = add(root, scale(add(scale(d, cos), scale(n, Math.sqrt(1 - cos * cos))), l1));
  return { mid, tip: add(mid, scale(unit(sub(target, mid), d), l2)) };
}

/** The un-angled tail of a limb: the fingertip continues the forearm, the wrist sits `l2` from the elbow. */
const finishLimb = (root: Point3, mid: Point3, tip: Point3, l2: number): Limb3 => ({
  root,
  mid,
  joint: add(mid, scale(unit(sub(tip, mid)), l2)),
  end: tip,
});

type LimbKind = "arms" | "legs";
const KINDS: LimbKind[] = ["arms", "legs"];

/** Per-limb data: bone lengths, the pose / sideways keys it reads, its defaults. */
const LIMBS = {
  arms: {
    l1: BONES.upperArm,
    l2: BONES.forearm,
    l3: BONES.hand,
    rootSide: SHOULDER_SIDE,
    contact: "hands",
    mid: "elbows",
    end: "wrists",
    bend: 1,
    /** Without a wrist angle the fingertip continues the forearm. */
    restEnd: undefined,
  },
  legs: {
    l1: BONES.thigh,
    l2: BONES.shin,
    l3: BONES.foot,
    rootSide: HIP_SIDE,
    contact: "feet",
    mid: "knees",
    end: "toes",
    bend: -1,
    /** Without a toe angle the foot sits square to the shin. */
    restEnd: "squareToShin",
  },
} as const;

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
  /** Degrees the end bone turns out of the xy plane towards +z (`sideways.toes` / `wrists`); angled ends only. */
  endTurn?: number;
}

/** A unit direction at 2D angle `angle` (radians), turned `turn` degrees out of the xy plane towards +z. */
function endDirection(angle: number, turn: number | undefined): Point3 {
  if (!turn) return [Math.cos(angle), Math.sin(angle), 0];
  const [c, s] = [Math.cos(deg(turn)), Math.sin(deg(turn))];
  return [Math.cos(angle) * c, Math.sin(angle) * c, s];
}

function solveLimb3(input: LimbInput, pins: Pin3[]): Limb3 {
  const { root, l1, l2, l3, names } = input;
  const angled = input.endAngle !== undefined;
  const lower = angled ? l2 : l2 + l3;
  let mid: Point3;
  let tip: Point3;
  if (input.midPin) {
    mid = add(root, scale(unit(sub(input.midPin, root)), l1));
    pins.push({ joint: names[0], target: input.midPin, actual: mid });
    tip = input.target
      ? add(mid, scale(unit(sub(input.target, mid)), lower))
      : add(mid, scale(unit(sub(mid, root)), lower));
  } else {
    const goal = input.target ?? add(root, [0, (l1 + lower) * 0.98, 0]);
    const d = unit(sub(goal, root));
    ({ mid, tip } = twoBone(root, goal, l1, lower, bendNormal(d, input.bend, input.out, input.side)));
  }
  if (input.target) pins.push({ joint: names[1], target: input.target, actual: tip });
  if (!angled) return finishLimb(root, mid, tip, l2);
  const angle =
    input.endAngle === "squareToShin"
      ? Math.atan2(tip[1] - mid[1], tip[0] - mid[0]) - Math.PI / 2
      : (input.endAngle as number);
  return { root, mid, joint: tip, end: add(tip, scale(endDirection(angle, input.endTurn), l3)) };
}

// ---------------------------------------------------------------- keyframe

/**
 * Places the 2D side-view spine in 3D at the pelvis z. With a sideways lean
 * (`chestZ` ≠ `pelvisZ`) the lower spine (pelvis → waist → chest) turns rigidly
 * about the pivot until pelvis and chest sit at their z, so bone lengths stay
 * true and the side view sees the leaning spine shorter.
 * - pivot "pelvis": the whole spine turns, the hips stay level and the
 *   shoulders (and head) tilt with it.
 * - pivot "chest": only the lower spine turns; the chest, shoulders, neck and
 *   head keep their side-view place at `chestZ`, so arm pins stay valid.
 */
interface SpineFrame {
  /** A point of the lower spine (pelvis, waist, hips) in 3D. */
  lower: (p: readonly [number, number]) => Point3;
  /** A point of the upper body (chest, neck, head, shoulders) in 3D. */
  upper: (p: readonly [number, number]) => Point3;
  /** Sideways offsets of the shoulders and the hips. */
  shoulders: (dz: number) => Point3;
  hips: (dz: number) => Point3;
}

function spineFrame(spine: Solved, pelvisZ: number, chestZ: number = pelvisZ, pivot: Sideways["pivot"] = "pelvis"): SpineFrame {
  const dz = chestZ - pelvisZ;
  const level = (d: number): Point3 => [0, 0, d];
  if (dz === 0) {
    const flat = (p: readonly [number, number]): Point3 => lift(p, pelvisZ);
    return { lower: flat, upper: flat, shoulders: level, hips: level };
  }
  const toChest: Point3 = [spine.chest[0] - spine.pelvis[0], spine.chest[1] - spine.pelvis[1], 0];
  const u = unit(toChest, [0, -1, 0]);
  // Turning u about cross(u, z) by +angle tips it towards +z.
  const axis = unit(cross(u, Z), [1, 0, 0]);
  const angle = Math.asin(clamp(dz / Math.max(norm(toChest), 1e-9), -1, 1));
  const turned = (d: number): Point3 => rotateAbout([0, 0, d], axis, angle);
  if (pivot === "chest") {
    const chest = lift(spine.chest, chestZ);
    return {
      lower: (p) => add(chest, rotateAbout([p[0] - spine.chest[0], p[1] - spine.chest[1], 0], axis, angle)),
      upper: (p) => lift(p, chestZ),
      shoulders: level,
      hips: turned,
    };
  }
  const pelvis = lift(spine.pelvis, pelvisZ);
  const place = (p: readonly [number, number]): Point3 => add(pelvis, rotateAbout([p[0] - spine.pelvis[0], p[1] - spine.pelvis[1], 0], axis, angle));
  return { lower: place, upper: place, shoulders: turned, hips: level };
}

/**
 * A keyframe's spine roll and shoulder girdle (`sideways.twist`, `hipTwist`,
 * `shoulders`), every value filled in so two can be blended.
 */
export interface Turn {
  twist: number;
  hipTwist: number;
  shoulders: Record<Side, Required<Girdle>>;
}

const girdleOf = (g: Girdle | undefined): Required<Girdle> => ({ up: g?.up ?? 0, forward: g?.forward ?? 0 });

export function turnOf(sw: Sideways | undefined): Turn {
  return { twist: sw?.twist ?? 0, hipTwist: sw?.hipTwist ?? 0, shoulders: { near: girdleOf(sw?.shoulders?.near), far: girdleOf(sw?.shoulders?.far) } };
}

/** Linear blend of two turns (so a 90 to 270 roll sweeps through 180). */
export function blendTurn(a: Turn, b: Turn, t: number): Turn {
  const mix = (x: number, y: number): number => x + (y - x) * t;
  const girdle = (side: Side): Required<Girdle> => ({ up: mix(a.shoulders[side].up, b.shoulders[side].up), forward: mix(a.shoulders[side].forward, b.shoulders[side].forward) });
  return { twist: mix(a.twist, b.twist), hipTwist: mix(a.hipTwist, b.hipTwist), shoulders: { near: girdle("near"), far: girdle("far") } };
}

const SQUARE: Turn = turnOf(undefined);
const moved = (g: Required<Girdle>): boolean => g.up !== 0 || g.forward !== 0;
/** Whether the shoulder line is rolled or a shoulder moved off the chest. */
const turnsShoulders = (turn: Turn): boolean => turn.twist !== 0 || moved(turn.shoulders.near) || moved(turn.shoulders.far);

/**
 * The chest's own frame for a roll: `u` up the upper spine, `s` towards the far
 * side and `f` the chest's front, both turned by `twist` about `u` (+ brings
 * the far side forward).
 */
function chestFrame(spine: Solved, frame: SpineFrame, twist: number): { u: Point3; s: Point3; f: Point3 } {
  const u = unit(sub(frame.upper(spine.chest), frame.upper(spine.waist)), [0, -1, 0]);
  const s0 = unit(frame.shoulders(1), Z);
  // cross(s, u) is the front: +x for an upright figure.
  const f0 = cross(s0, u);
  const r = deg(-twist);
  return { u, s: rotateAbout(s0, u, r), f: rotateAbout(f0, u, r) };
}

/**
 * Shoulder and hip roots, set out sideways about the spine (see `SpineFrame`),
 * the shoulder line rolled by `twist` about the upper spine and each shoulder
 * moved by its girdle offset, the hip line rolled by `hipTwist` about the
 * lower spine. Without a turn: the square roots, computed exactly as before.
 */
function roots(spine: Solved, frame: SpineFrame, turn: Turn = SQUARE): Record<LimbKind, Record<Side, Point3>> {
  let shoulder = (side: Side): Point3 => add(frame.upper(spine.arms[side].root), frame.shoulders(zOut(side) * SHOULDER_SIDE));
  let hip = (side: Side): Point3 => add(frame.lower(spine.legs[side].root), frame.hips(zOut(side) * HIP_SIDE));
  if (turnsShoulders(turn)) {
    const { u, s, f } = chestFrame(spine, frame, turn.twist);
    shoulder = (side) => {
      const g = turn.shoulders[side];
      return add(frame.upper(spine.arms[side].root), add(scale(s, zOut(side) * SHOULDER_SIDE), add(scale(u, g.up), scale(f, g.forward))));
    };
  }
  if (turn.hipTwist !== 0) {
    const axis = unit(sub(frame.lower(spine.waist), frame.lower(spine.pelvis)), [0, -1, 0]);
    hip = (side) => add(frame.lower(spine.legs[side].root), rotateAbout(frame.hips(zOut(side) * HIP_SIDE), axis, deg(-turn.hipTwist)));
  }
  return {
    arms: { near: shoulder("near"), far: shoulder("far") },
    legs: { near: hip("near"), far: hip("far") },
  };
}

/** The rolled chest's sideways direction, for a figure whose shoulders turn (see `Figure3.across`). */
const acrossOf = (spine: Solved, frame: SpineFrame, turn: Turn): Pick<Figure3, "across"> =>
  turnsShoulders(turn) ? { across: chestFrame(spine, frame, turn.twist).s } : {};

function spineOf(spine: Solved, frame: SpineFrame): Pick<Figure3, "pelvis" | "waist" | "chest" | "neck" | "head"> {
  return {
    pelvis: frame.lower(spine.pelvis),
    waist: frame.lower(spine.waist),
    chest: frame.upper(spine.chest),
    neck: frame.upper(spine.neck),
    head: frame.upper(spine.head),
  };
}

/**
 * Solve one keyframe in 3D. `spine` is the 2D side-view solve of the same pose
 * (it supplies the spine and the shoulder / hip positions).
 */
export function solveKeyframe3(spine: Solved, pose: Pose, sideways: Sideways | undefined): Figure3 {
  const z = sideways?.pelvis ?? 0;
  const frame = spineFrame(spine, z, sideways?.chest, sideways?.pivot);
  const turn = turnOf(sideways);
  const root = roots(spine, frame, turn);
  const pins: Pin3[] = [];
  const limbs = { arms: {}, legs: {} } as Record<LimbKind, Record<Side, Limb3>>;
  for (const side of SIDES) {
    for (const kind of KINDS) limbs[kind][side] = solveLimb3(limbInput(kind, pose, sideways, side, root[kind][side]), pins);
  }
  return { ...spineOf(spine, frame), ...limbs, pins, ...acrossOf(spine, frame, turn) };
}

/** A pinned 2D point lifted to its sideways position (default: the limb root's z). */
const placed = (p: readonly [number, number] | undefined, z: number | undefined, root: Point3): Point3 | undefined =>
  p && lift(p, z ?? root[2]);

/** One limb's solve input: its pose pins, lifted to the keyframe's sideways positions. */
function limbInput(kind: LimbKind, pose: Pose, sideways: Sideways | undefined, side: Side, root: Point3): LimbInput {
  const limb = LIMBS[kind];
  const sw = sideways ?? {};
  const of = <T>(record: Partial<Record<Side, T>> | undefined): T | undefined => record?.[side];
  const midHint = of(sw[limb.mid]);
  const midPose = of(pose[limb.mid]);
  const endAngle = of(pose[limb.end]);
  return {
    side,
    root,
    names: [`${limb.mid}.${side}`, `${limb.contact}.${side}`],
    l1: limb.l1,
    l2: limb.l2,
    l3: limb.l3,
    target: placed(of(pose[limb.contact]), of(sw[limb.contact]), root),
    midPin: placed(midPose?.at, midHint?.at, root),
    bend: midPose?.bend ?? limb.bend,
    out: midHint?.out ?? 0,
    endAngle: endAngle === undefined ? limb.restEnd : deg(endAngle),
    endTurn: of(sw[limb.end]),
  };
}

// ---------------------------------------------------------------- timeline

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

/** An arm re-solved so its hand tip reaches `target` (a partner's hold), keeping its bend plane; short of it when out of reach. */
export function reachArm3(arm: Limb3, target: Point3): Limb3 {
  const { mid, tip } = twoBone(arm.root, target, BONES.upperArm, BONES.forearm + BONES.hand, normalOf(arm, arm.end));
  return finishLimb(arm.root, mid, tip, BONES.forearm);
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

/** Same rules as the 2D rig: ends that move further than SWING_THRESHOLD swing, floor contacts slide. */
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
  if (!angled) return finishLimb(root, mid, tip, l2);
  const endDir = slerp(unit(sub(a.end, a.joint)), unit(sub(b.end, b.joint)), t);
  return { root, mid, joint: tip, end: add(tip, scale(endDir, l3)) };
}

/**
 * Held stick or towel (two hands on one object): between keyframes each hand
 * keeps to a plane of constant sideways offset from its shoulder (blended
 * linearly), turning round the shoulder in the side view's plane at a blended
 * distance, so the hands stay the object's width apart instead of bulging
 * outwards along a great circle. The arm is re-solved onto that hand.
 */
function heldArm(a: Limb3, b: Limb3, blended: Limb3, t: number): Limb3 {
  const va = sub(a.end, a.root);
  const vb = sub(b.end, b.root);
  const lerp = (x: number, y: number): number => x + (y - x) * t;
  const [ta, tb] = [Math.atan2(va[1], va[0]), Math.atan2(vb[1], vb[0])];
  let turn = tb - ta;
  while (turn > Math.PI) turn -= 2 * Math.PI;
  while (turn < -Math.PI) turn += 2 * Math.PI;
  const angle = ta + turn * t;
  const z = lerp(va[2], vb[2]);
  const reach = lerp(norm(va), norm(vb));
  const flat = Math.sqrt(Math.max(0, reach * reach - z * z));
  return reachArm3(blended, add(blended.root, [Math.cos(angle) * flat, Math.sin(angle) * flat, z]));
}

/** The blended limbs, with the arms kept on a held stick or towel (see `heldArm`). */
function holdObject(spec: DoodleSpec, a: Figure3, b: Figure3, limbs: Record<LimbKind, Record<Side, Limb3>>, t: number): Record<LimbKind, Record<Side, Limb3>> {
  if (!spec.stick && !spec.towel) return limbs;
  const arms = { near: heldArm(a.arms.near, b.arms.near, limbs.arms.near, t), far: heldArm(a.arms.far, b.arms.far, limbs.arms.far, t) };
  return { ...limbs, arms };
}

/** A keyframe's chest z (default: its pelvis z). */
const chestZ = (spec: DoodleSpec, index: number): number => {
  const sw = spec.frames[index].sideways;
  return sw?.chest ?? sw?.pelvis ?? 0;
};

/** The spine frame between keyframes `from` and `to`: pelvis and chest z blended, the first pivot given. */
function blendFrame(spec: DoodleSpec, spine: Solved, [from, to]: [number, number], [a, b]: [Figure3, Figure3], t: number): SpineFrame {
  const z = a.pelvis[2] + (b.pelvis[2] - a.pelvis[2]) * t;
  const [ca, cb] = [chestZ(spec, from), chestZ(spec, to)];
  const pivot = spec.frames[from].sideways?.pivot ?? spec.frames[to].sideways?.pivot;
  return spineFrame(spine, z, ca === cb ? ca : ca + (cb - ca) * t, pivot);
}

/** Sample the loop: the 2D timeline's timing and spine, limbs blended in 3D. */
export function sampleTimeline3(spec: DoodleSpec, stepsPerTransition = 14): Timeline3 {
  const flat = sampleTimeline(spec, stepsPerTransition);
  const { keys } = flat;
  const solved = keys.map((key, i) => solveKeyframe3(key.solved, key.pose, spec.frames[i].sideways));
  const turns = spec.frames.map((frame) => turnOf(frame.sideways));
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
      const frame = blendFrame(spec, spine, [index, next], [a, b], t);
      const turn = blendTurn(turns[index], turns[next], t);
      const root = roots(spine, frame, turn);
      const limbs = { arms: {}, legs: {} } as Record<LimbKind, Record<Side, Limb3>>;
      for (const side of SIDES) {
        for (const kind of KINDS) {
          const limb = LIMBS[kind];
          limbs[kind][side] = blendLimb({
            a: a[kind][side],
            b: b[kind][side],
            root: root[kind][side],
            t,
            pinned: [Boolean(pa[limb.contact]?.[side]), Boolean(pb[limb.contact]?.[side])],
            l1: limb.l1,
            l2: limb.l2,
            l3: limb.l3,
            angled: limb.restEnd !== undefined || pa[limb.end]?.[side] !== undefined || pb[limb.end]?.[side] !== undefined,
          });
        }
      }
      poses.push({ ...spineOf(spine, frame), ...holdObject(spec, a, b, limbs, t), pins: [], ...acrossOf(spine, frame, turn) });
    }
  });
  poses.push(solved[0]);
  return { duration: flat.duration, keyTimes: flat.keyTimes, poses: tiltHeads(spec, poses), keyframeIndex: flat.keyframeIndex };
}
