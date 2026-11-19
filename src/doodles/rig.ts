/**
 * Doodle rig v2: joint-based stick figures (see
 * docs/superpowers/specs/2026-11-15-doodle-rig-v2.md).
 *
 * The full skeleton is always present. A keyframe pins the joints that define
 * the move; everything else is solved with FABRIK per chain so every bone keeps
 * its length exactly:
 *
 *   spine  pelvis → waist → chest → neck → head
 *   arms   chest → shoulder → elbow → wrist → hand
 *   legs   pelvis → hip → knee → ankle → toe
 *
 * Coordinates: floor at y = 0, up is negative y, the figure faces +x.
 */

export type Point = readonly [number, number];
export type Side = "near" | "far";
export type Bend = 1 | -1;

export interface JointHint {
  /** Which way the joint folds (+1 clockwise on screen, -1 anticlockwise). */
  bend?: Bend;
  /** Pins the joint itself. */
  at?: Point;
}

/** A knee given by direction (resolved by `resolveSideways`): the thigh points `dir` degrees from the hip (0 = +x, 90 = down). */
export interface KneeHint extends JointHint {
  dir?: number;
  /** Thigh length to use (default BONES.thigh). */
  length?: number;
}

/**
 * A foot given by direction: from the knee along `dir` (a shin, default
 * BONES.shin) when the knee is pinned, otherwise a straight leg from the pelvis
 * (default BONES.thigh + BONES.shin).
 */
export interface FootHint {
  dir: number;
  length?: number;
}

/** v2 authoring surface: pin only the joints the move needs. */
export interface Pose {
  /** Root. Defaults to the previous keyframe's pelvis. */
  pelvis?: Point;
  /** Pins the upper spine (otherwise solved from head / hands / previous frame). */
  chest?: Point;
  /** Pins the head centre (otherwise the neck continues the spine). */
  head?: Point;
  /** Which way the spine bows when chest/head pull it shorter: +1 arch, -1 round (default). */
  spine?: { bend?: Bend };
  /** Hand (fingertip end) targets. */
  hands?: Partial<Record<Side, Point>>;
  /** Ankle targets. */
  feet?: Partial<Record<Side, Point>>;
  elbows?: Partial<Record<Side, JointHint>>;
  knees?: Partial<Record<Side, JointHint>>;
  /** Foot direction in degrees (0 = +x, 90 = down). */
  toes?: Partial<Record<Side, number>>;
  /**
   * Hand direction in degrees (0 = +x, 90 = down) for a bent wrist. When set,
   * `hands` pins the wrist rather than the fingertip.
   */
  wrists?: Partial<Record<Side, number>>;
}

/** v1 limb (kept for backward compatibility). */
export interface Limb {
  end: Point;
  bend?: Bend;
  mid?: Point;
  toe?: number;
}

/** v1 pose (kept for backward compatibility; mapped onto the v2 model). */
export interface LegacyPose {
  hip: Point;
  shoulder: Point;
  headTilt?: number;
  head?: Point;
  armNear: Limb;
  armFar: Limb;
  legNear: Limb;
  legFar: Limb;
}

export interface Keyframe {
  pose: AuthoredPose | LegacyPose;
  /** Seconds to hold this pose. */
  hold: number;
  /**
   * Side view only: draw this keyframe reflected about x = `mirror`, so the
   * figure faces -x. Author the pose facing +x as usual. Between a mirrored and
   * an unmirrored keyframe the figure turns round: every joint slides straight
   * across, so the figure narrows to front-on halfway (those in-between samples
   * are foreshortened on purpose and skip the bone-length and joint-range checks).
   */
  mirror?: number;
  /** Dual-view specs only: sideways (z) positions for this keyframe; see `Sideways`. */
  sideways?: Sideways;
}

/** Sideways position of a knee or elbow pin, and how far its bend plane rolls outward. */
export interface SidewaysHint {
  /** z of a pinned knee / elbow (`knees.at` / `elbows.at`); defaults to the hip / shoulder z. */
  at?: number;
  /** Degrees the bend plane rolls outward from the forward plane (90: the joint points out to the side). */
  out?: number;
}

/**
 * Dual-view specs: absolute sideways positions (z). Near side is negative, far
 * side positive; the front panel draws near on the viewer's left. Anything not
 * given keeps its chain's natural width (shoulders ±22, hips ±8, spine at the pelvis z).
 */
export interface Sideways {
  /** Shifts the whole spine sideways. */
  pelvis?: number;
  hands?: Partial<Record<Side, number>>;
  feet?: Partial<Record<Side, number>>;
  elbows?: Partial<Record<Side, SidewaysHint>>;
  knees?: Partial<Record<Side, SidewaysHint>>;
}

/** What keyframes hold: a `Pose` whose knees and feet may be direction hints, resolved against the keyframe's `sideways`. */
export type AuthoredPose = Omit<Pose, "knees" | "feet"> & {
  knees?: Partial<Record<Side, KneeHint>>;
  feet?: Partial<Record<Side, FootPin>>;
  /** Planted feet (points) slide in so straight legs keep their 2D length with their sideways z. */
  spreadFeet?: boolean;
};

/**
 * A joint `length` from `root` (3D: x, y and z) heading along the 2D angle
 * `degrees` (0 = +x, 90 = down) while it sits `dz` sideways from the root: the
 * 2D point is foreshortened so the 3D bone keeps its length.
 */
export function reach3(root: Point, degrees: number, length: number, dz: number): Point {
  const flat = Math.sqrt(Math.max(0, length * length - dz * dz));
  const r = (degrees * Math.PI) / 180;
  return [Math.round((root[0] + Math.cos(r) * flat) * 1000) / 1000, Math.round((root[1] + Math.sin(r) * flat) * 1000) / 1000];
}

type FootPin = Point | FootHint;

const isPoint = (foot: FootPin | undefined): foot is Point => Array.isArray(foot);

function hasHints(pose: AuthoredPose): boolean {
  if (pose.spreadFeet) return true;
  return (["near", "far"] as Side[]).some(
    (side) => pose.knees?.[side]?.dir !== undefined || (pose.feet?.[side] !== undefined && !isPoint(pose.feet[side])),
  );
}

/** Planted (point) feet slide along the floor towards the hip so the 3D leg keeps its 2D length. */
function spreadPlanted(
  pelvis: Point,
  feet: Partial<Record<Side, FootPin>>,
  sw: Sideways,
): Partial<Record<Side, FootPin>> {
  const out = { ...feet };
  for (const side of ["near", "far"] as Side[]) {
    const foot = feet[side];
    if (!foot || !isPoint(foot)) continue;
    const hipZ = (sw.pelvis ?? 0) + zOut(side) * HIP_SIDE;
    const dz = (sw.feet?.[side] ?? hipZ) - hipZ;
    const leg = Math.hypot(foot[0] - pelvis[0], foot[1] - pelvis[1]) - 0.2;
    const flat = Math.sqrt(Math.max(0, leg * leg - dz * dz - (foot[1] - pelvis[1]) ** 2));
    out[side] = [Math.round((pelvis[0] - flat) * 100) / 100, foot[1]];
  }
  return out;
}

/** A knee hint with its direction resolved to a pin. */
function resolveKnee(pelvis: Point, hipZ: number, kneeZ: number, hint: KneeHint): JointHint {
  const { dir, length, ...joint } = hint;
  const at = dir === undefined ? hint.at : reach3(pelvis, dir, length ?? BONES.thigh, kneeZ - hipZ);
  return at ? { ...joint, at } : joint;
}

/** A foot as a point: points pass through, hints resolve from the knee pin when there is one, else straight from the pelvis. */
function resolveFoot(
  pelvis: Point,
  hipZ: number,
  kneeZ: number,
  knee: Point | undefined,
  foot: FootPin | undefined,
  footZ: number,
): Point | undefined {
  if (!foot) return undefined;
  if (isPoint(foot)) return foot;
  if (knee) return reach3(knee, foot.dir, foot.length ?? BONES.shin, footZ - kneeZ);
  return reach3(pelvis, foot.dir, foot.length ?? BONES.thigh + BONES.shin, footZ - hipZ);
}

/** One leg's hints resolved: the knee pin (if any) and the foot point (if any). */
function resolveLeg(
  pelvis: Point,
  side: Side,
  sw: Sideways,
  hint: KneeHint | undefined,
  foot: FootPin | undefined,
): { knee?: JointHint; foot?: Point } {
  const hipZ = (sw.pelvis ?? 0) + zOut(side) * HIP_SIDE;
  const kneeZ = sw.knees?.[side]?.at ?? hipZ;
  const knee = hint && resolveKnee(pelvis, hipZ, kneeZ, hint);
  return { knee, foot: resolveFoot(pelvis, hipZ, kneeZ, knee?.at, foot, sw.feet?.[side] ?? hipZ) };
}

/** Per-side knee pins and foot points gathered from resolved legs. */
function collectLegs(legs: readonly (readonly [Side, { knee?: JointHint; foot?: Point }])[]): {
  knees: Partial<Record<Side, JointHint>>;
  feet: Partial<Record<Side, Point>>;
} {
  const knees: Partial<Record<Side, JointHint>> = {};
  const feet: Partial<Record<Side, Point>> = {};
  for (const [side, leg] of legs) {
    if (leg.knee) knees[side] = leg.knee;
    if (leg.foot) feet[side] = leg.foot;
  }
  return { knees, feet };
}

/**
 * Turns an authored pose's sideways hints into plain pins (see `AuthoredPose`),
 * foreshortening each by its joint's z from `sideways`: hips at
 * `pelvis +/- HIP_SIDE`, a knee or foot without its own z at its hip's z (as the
 * 3D solve defaults). A pose without hints comes back as the same object.
 */
export function resolveSideways(pose: AuthoredPose, sideways: Sideways = {}): Pose {
  if (!hasHints(pose)) return pose as Pose;
  const pelvis = pose.pelvis;
  if (!pelvis) throw new Error("sideways hints (knee/foot dir, spreadFeet) need an explicit pelvis");
  const { spreadFeet: spread, knees: kneeHints, feet: footHints, ...rest } = pose;
  const planted = spread ? spreadPlanted(pelvis, footHints ?? {}, sideways) : { ...footHints };
  const legs = (["near", "far"] as Side[]).map((side) => [side, resolveLeg(pelvis, side, sideways, kneeHints?.[side], planted[side])] as const);
  const { knees, feet } = collectLegs(legs);
  return {
    ...rest,
    ...(kneeHints ? { knees } : {}),
    ...(footHints ? { feet } : {}),
  };
}

export type Prop =
  | { kind: "bar"; y: number; x1: number; x2: number; grips?: number[] }
  | {
      kind: "box";
      x: number;
      y: number;
      w: number;
      h: number;
      /** Two views: half-width seen from the front (default 60), e.g. a seat narrower than spread knees. */
      frontHalf?: number;
    }
  /** The ground line at y = 0, sized by the renderer to the figure (and props on the floor) over the loop. */
  | { kind: "floor" }
  /** A straight sloped plank from `from` to `to`; `posts` (default true) stand a little in from each end down to the floor. */
  | { kind: "board"; from: Point; to: Point; posts?: boolean }
  | { kind: "parallelBars"; y: number; x1: number; x2: number }
  | { kind: "parallettes"; y: number; xs: number[] };

export interface DoodleSpec {
  id: string;
  slug: string;
  title: string;
  /** "front" draws both sides at full strength and spreads shoulders/hips. */
  view?: "side" | "front";
  props?: Prop[];
  frames: Keyframe[];
  /** Seconds per transition between keyframes. */
  transition?: number;
  /** Replace an existing hand-drawn doodle (e.g. one that shows the wrong move). */
  replaces?: boolean;
  /**
   * A resistance band looped round both thighs: drawn joining the near and far
   * thighs at this share of the way from hip to knee (e.g. 0.8 = just above the knees).
   */
  band?: number;
  /**
   * An ab wheel of this radius held in the hands: a circle centred on the near
   * hand that rolls with it. Pin the hands at y = -radius so it sits on the floor.
   */
  wheel?: number;
  /**
   * Draw the move twice, side view and front view next to each other, from one
   * 3D-solved figure (keyframe `sideways`). Only when a reviewer asks for it (ADD VIEW).
   */
  views?: readonly ["side", "front"];
}

export const BONES = {
  pelvisWaist: 40,
  waistChest: 40,
  chestNeck: 20,
  neckHead: 36,
  upperArm: 60,
  forearm: 58,
  hand: 8,
  thigh: 88,
  shin: 86,
  foot: 20,
} as const;

export const TORSO = BONES.pelvisWaist + BONES.waistChest + BONES.chestNeck;

export const SEGMENTS = { ...BONES, headRadius: 24 } as const;

/** Shoulder offset from the chest: along the chest segment, and sideways (front view only). */
const SHOULDER_ALONG = 18;
export const SHOULDER_SIDE = 22;
export const HIP_SIDE = 8;

/** Sideways sign of a side: near is -z (the front view's left), far is +z. */
export const zOut = (side: Side): number => (side === "near" ? -1 : 1);
export const other = (side: Side): Side => (side === "near" ? "far" : "near");

// ---------------------------------------------------------------- vectors

const add = (a: Point, b: Point): Point => [a[0] + b[0], a[1] + b[1]];
const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
const scale = (a: Point, k: number): Point => [a[0] * k, a[1] * k];
export const dist = (a: Point, b: Point): number => Math.hypot(a[0] - b[0], a[1] - b[1]);
const fromAngle = (radians: number): Point => [Math.cos(radians), Math.sin(radians)];
const angleOf = (a: Point, b: Point): number => Math.atan2(b[1] - a[1], b[0] - a[0]);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const lerpPoint = (a: Point, b: Point, t: number): Point => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
export const deg = (degrees: number): number => (degrees * Math.PI) / 180;
export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const cross = (a: Point, b: Point): number => a[0] * b[1] - a[1] * b[0];

function unit(v: Point, fallback: Point = [0, -1]): Point {
  const n = Math.hypot(v[0], v[1]);
  return n < 1e-9 ? fallback : [v[0] / n, v[1] / n];
}

function shortestAngle(from: number, to: number): number {
  let delta = to - from;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  return delta;
}

const lerpAngle = (a: number, b: number, t: number): number => a + shortestAngle(a, b) * t;

// ---------------------------------------------------------------- solver core

/** Two-bone IK: the middle joint for a chain from `root` towards `target`. */
export function solveJoint(root: Point, target: Point, l1: number, l2: number, bend: Bend): Point {
  const delta = sub(target, root);
  const reach = Math.min(Math.max(Math.hypot(delta[0], delta[1]), Math.abs(l1 - l2) + 1e-6), l1 + l2 - 1e-6);
  const base = Math.atan2(delta[1], delta[0]);
  const cos = (l1 * l1 + reach * reach - l2 * l2) / (2 * l1 * reach);
  const angle = base + bend * Math.acos(Math.min(1, Math.max(-1, cos)));
  return add(root, scale(fromAngle(angle), l1));
}

/**
 * FABRIK with the root fixed. `seed` sets the initial shape (and so the bend
 * side); the result always has exact bone lengths. Unreachable targets are
 * approached in a straight line.
 */
export function fabrik(seed: Point[], lengths: number[], target: Point, iterations = 24): Point[] {
  const points = seed.map((p): Point => [p[0], p[1]]);
  const root = points[0];
  const total = lengths.reduce((a, b) => a + b, 0);
  const forward = () => {
    for (let i = 0; i < lengths.length; i += 1) {
      points[i + 1] = add(points[i], scale(unit(sub(points[i + 1], points[i]), unit(sub(target, root))), lengths[i]));
    }
  };
  if (dist(root, target) >= total) {
    const direction = unit(sub(target, root));
    for (let i = 0; i < lengths.length; i += 1) points[i + 1] = add(points[i], scale(direction, lengths[i]));
    return points;
  }
  forward(); // normalise the seed
  for (let k = 0; k < iterations && dist(points[points.length - 1], target) > 1e-4; k += 1) {
    points[points.length - 1] = target;
    for (let i = lengths.length - 1; i >= 0; i -= 1) {
      points[i] = add(points[i + 1], scale(unit(sub(points[i], points[i + 1])), lengths[i]));
    }
    points[0] = root;
    forward();
  }
  return points;
}

// ---------------------------------------------------------------- solved figure

export interface SolvedLimb {
  /** Shoulder or hip. */
  root: Point;
  /** Elbow or knee. */
  mid: Point;
  /** Wrist or ankle. */
  joint: Point;
  /** Hand tip or toe. */
  end: Point;
}

export interface Pin {
  joint: string;
  target: Point;
  actual: Point;
}

export interface Solved {
  pelvis: Point;
  waist: Point;
  chest: Point;
  neck: Point;
  head: Point;
  arms: Record<Side, SolvedLimb>;
  legs: Record<Side, SolvedLimb>;
  pins: Pin[];
}

const SIDES: Side[] = ["near", "far"];

export function isLegacyPose(pose: AuthoredPose | Pose | LegacyPose): pose is LegacyPose {
  return "hip" in pose && "shoulder" in pose;
}

/** Map a v1 pose onto the v2 joints (old shoulder ≈ new neck). */
export function fromLegacy(pose: LegacyPose): Pose {
  const direction = unit(sub(pose.shoulder, pose.hip));
  const neck = add(pose.hip, scale(direction, TORSO));
  const tilt = deg(pose.headTilt ?? 0);
  const headDirection: Point = [
    direction[0] * Math.cos(tilt) - direction[1] * Math.sin(tilt),
    direction[0] * Math.sin(tilt) + direction[1] * Math.cos(tilt),
  ];
  const limbHint = (limb: Limb): JointHint => ({ bend: limb.bend, at: limb.mid });
  return {
    pelvis: pose.hip,
    chest: add(pose.hip, scale(direction, BONES.pelvisWaist + BONES.waistChest)),
    head: pose.head ?? (pose.headTilt ? add(neck, scale(headDirection, BONES.neckHead)) : undefined),
    hands: { near: pose.armNear.end, far: pose.armFar.end },
    feet: { near: pose.legNear.end, far: pose.legFar.end },
    elbows: { near: limbHint(pose.armNear), far: limbHint(pose.armFar) },
    knees: { near: limbHint(pose.legNear), far: limbHint(pose.legFar) },
    toes: { near: pose.legNear.toe, far: pose.legFar.toe },
  };
}

export const toPose = (pose: Pose | LegacyPose): Pose => (isLegacyPose(pose) ? fromLegacy(pose) : pose);

/** A keyframe's pose as a plain `Pose`: legacy poses converted, sideways hints resolved. */
const resolveFramePose = (pose: AuthoredPose | LegacyPose, sideways?: Sideways): Pose =>
  isLegacyPose(pose) ? fromLegacy(pose) : resolveSideways(pose, sideways);

export interface SolveContext {
  view?: "side" | "front";
  /** Pelvis used when the pose does not pin one. */
  pelvis?: Point;
  /** Spine direction (radians) preferred when nothing pins the chest. */
  spineAngle?: number;
}

const ARM_REACH = BONES.upperArm + BONES.forearm + BONES.hand;
const SHOULDER_FROM_PELVIS = BONES.pelvisWaist + BONES.waistChest + SHOULDER_ALONG;

function straightSpine(pelvis: Point, angle: number): Point[] {
  const u = fromAngle(angle);
  const lengths = [BONES.pelvisWaist, BONES.waistChest, BONES.chestNeck, BONES.neckHead];
  const points: Point[] = [pelvis];
  for (const l of lengths) points.push(add(points[points.length - 1], scale(u, l)));
  return points;
}

/** Spine direction that puts the shoulders a comfortable arm's length from the pinned hands. */
function spineAngleFromHands(pelvis: Point, hands: Point[], prior: number): number {
  const hand = hands.reduce((a, b) => lerpPoint(a, b, 0.5));
  const d = dist(pelvis, hand);
  const r1 = SHOULDER_FROM_PELVIS;
  // Nearly locked arms: any shorter and the elbow visibly kinks.
  const r2 = ARM_REACH - 0.2;
  const base = angleOf(pelvis, hand);
  if (d >= r1 + r2) return base;
  if (d <= Math.abs(r1 - r2)) return prior;
  const offset = Math.acos((r1 * r1 + d * d - r2 * r2) / (2 * r1 * d));
  const candidates = [base + offset, base - offset];
  return candidates.reduce(
    (best, c) => (Math.abs(shortestAngle(prior, c)) < Math.abs(shortestAngle(prior, best)) ? c : best),
    candidates[0],
  );
}

const pinnedHands = (pose: Pose): Point[] =>
  SIDES.map((side) => pose.hands?.[side]).filter((p): p is Point => !!p);

function solveSpine(pose: Pose, pelvis: Point, ctx: SolveContext, pins: Pin[]): Point[] {
  const bend = pose.spine?.bend ?? -1;
  const prior = ctx.spineAngle ?? -Math.PI / 2;
  let lower: Point[]; // pelvis, waist, chest
  if (pose.chest) {
    const waist = solveJoint(pelvis, pose.chest, BONES.pelvisWaist, BONES.waistChest, bend);
    lower = fabrik([pelvis, waist, pose.chest], [BONES.pelvisWaist, BONES.waistChest], pose.chest);
    pins.push({ joint: "chest", target: pose.chest, actual: lower[2] });
  } else if (pinnedHands(pose).length) {
    // Straight spine leaning so the arms reach the pinned hands nearly straight.
    lower = straightSpine(pelvis, spineAngleFromHands(pelvis, pinnedHands(pose), prior)).slice(0, 3);
  } else if (pose.head) {
    // Whole spine reaches for the head, seeded with a gentle bow on the bend side.
    const angle = angleOf(pelvis, pose.head);
    const seed = straightSpine(pelvis, angle).map((p, i) =>
      i === 1 || i === 2 ? add(p, scale(fromAngle(angle + (bend * Math.PI) / 2), 6)) : p,
    );
    const lengths = [BONES.pelvisWaist, BONES.waistChest, BONES.chestNeck, BONES.neckHead];
    const solved = fabrik(seed, lengths, pose.head);
    pins.push({ joint: "head", target: pose.head, actual: solved[4] });
    return solved;
  } else {
    lower = straightSpine(pelvis, prior).slice(0, 3);
  }
  const [, waist, chest] = lower;
  const along = unit(sub(chest, waist));
  if (pose.head) {
    // Neck folds whichever way keeps it closest to the line of the spine.
    const candidates = ([1, -1] as Bend[]).map((b) =>
      solveJoint(chest, pose.head as Point, BONES.chestNeck, BONES.neckHead, b),
    );
    const neckSeed = candidates.reduce((best, c) =>
      dist(c, add(chest, scale(along, BONES.chestNeck))) < dist(best, add(chest, scale(along, BONES.chestNeck)))
        ? c
        : best,
    );
    const upper = fabrik([chest, neckSeed, pose.head], [BONES.chestNeck, BONES.neckHead], pose.head);
    pins.push({ joint: "head", target: pose.head, actual: upper[2] });
    return [pelvis, waist, chest, upper[1], upper[2]];
  }
  const neck = add(chest, scale(along, BONES.chestNeck));
  return [pelvis, waist, chest, neck, add(neck, scale(along, BONES.neckHead))];
}

/**
 * Solve one three-bone limb (root → mid → joint → end). The end bone continues
 * the middle bone unless `endAngle` (feet) is given.
 */
function solveLimb(
  root: Point,
  names: [mid: string, end: string],
  l1: number,
  l2: number,
  l3: number,
  target: Point | undefined,
  hint: JointHint | undefined,
  defaultBend: Bend,
  endAngle: number | undefined,
  pins: Pin[],
): SolvedLimb {
  const bend = hint?.bend ?? defaultBend;
  // Feet pin the ankle (end of l2); hands pin the fingertip (l2 + l3 straight).
  const lower = endAngle === undefined ? l2 + l3 : l2;
  const goal = target ?? add(root, [0, (l1 + lower) * 0.98]);
  let mid: Point;
  let tip: Point;
  if (hint?.at) {
    mid = fabrik([root, hint.at], [l1], hint.at)[1];
    pins.push({ joint: names[0], target: hint.at, actual: mid });
    tip = target ? fabrik([mid, target], [lower], target)[1] : add(mid, scale(unit(sub(mid, root)), lower));
  } else {
    const seedMid = solveJoint(root, goal, l1, lower, bend);
    [, mid, tip] = fabrik([root, seedMid, add(seedMid, scale(unit(sub(goal, seedMid)), lower))], [l1, lower], goal);
  }
  if (target) pins.push({ joint: names[1], target, actual: tip });
  if (endAngle === undefined) {
    const joint = add(mid, scale(unit(sub(tip, mid)), l2));
    return { root, mid, joint, end: tip };
  }
  return { root, mid, joint: tip, end: add(tip, scale(fromAngle(endAngle), l3)) };
}

function solveArm(pose: Pose, side: Side, shoulder: Point, pins: Pin[]): SolvedLimb {
  const wrist = pose.wrists?.[side];
  return solveLimb(
    shoulder,
    [`elbows.${side}`, `hands.${side}`],
    BONES.upperArm,
    BONES.forearm,
    BONES.hand,
    pose.hands?.[side],
    pose.elbows?.[side],
    1,
    wrist === undefined ? undefined : deg(wrist),
    pins,
  );
}

function solveLeg(pose: Pose, side: Side, hip: Point, pins: Pin[]): SolvedLimb {
  const names: [string, string] = [`knees.${side}`, `feet.${side}`];
  const foot = pose.feet?.[side];
  const knee = pose.knees?.[side];
  // Default foot: square to the shin, pointing forward.
  const draft = solveLimb(hip, names, BONES.thigh, BONES.shin, BONES.foot, foot, knee, -1, 0, []);
  const toe = pose.toes?.[side];
  const footAngle = toe === undefined ? angleOf(draft.mid, draft.joint) - Math.PI / 2 : deg(toe);
  return solveLimb(hip, names, BONES.thigh, BONES.shin, BONES.foot, foot, knee, -1, footAngle, pins);
}

/** Solve a keyframe: every bone at its fixed length, pinned joints where reachable. */
export function solvePose(input: Pose | LegacyPose, ctx: SolveContext = {}): Solved {
  const pose = toPose(input);
  const pins: Pin[] = [];
  const pelvis = pose.pelvis ?? ctx.pelvis ?? [0, -172];
  const [, waist, chest, neck, head] = solveSpine(pose, pelvis, ctx, pins);
  const up = unit(sub(chest, waist));
  const across: Point = [-up[1], up[0]];
  const hipAcross = unit(sub(waist, pelvis));
  const hipSide: Point = [-hipAcross[1], hipAcross[0]];
  // Front view spreads the sides apart; side view stacks them.
  const spread = (side: Side, distance: number): number => {
    if (ctx.view !== "front") return 0;
    return (side === "near" ? -1 : 1) * distance;
  };

  const arms = {} as Record<Side, SolvedLimb>;
  const legs = {} as Record<Side, SolvedLimb>;
  for (const side of SIDES) {
    const shoulder = add(add(chest, scale(up, SHOULDER_ALONG)), scale(across, spread(side, SHOULDER_SIDE)));
    arms[side] = solveArm(pose, side, shoulder, pins);
    legs[side] = solveLeg(pose, side, add(pelvis, scale(hipSide, spread(side, HIP_SIDE))), pins);
  }
  return { pelvis, waist, chest, neck, head, arms, legs, pins };
}

// ---------------------------------------------------------------- interpolation

/** Ends that move further than this between keyframes swing in an arc (joint-angle blend). */
export const SWING_THRESHOLD = 24;
/** Ends this close to the floor at both keyframes slide rather than swing. */
export const FLOOR_CONTACT = 10;

function bendOf(limb: SolvedLimb): Bend | undefined {
  const c = cross(sub(limb.mid, limb.root), sub(limb.joint, limb.mid));
  const sine = c / (dist(limb.mid, limb.root) * dist(limb.joint, limb.mid));
  // solveJoint's +1 turns the upper bone clockwise, so the lower bone turns back (negative cross).
  if (Math.abs(sine) < 0.05) return undefined;
  return c < 0 ? 1 : -1;
}

type Contact = "joint" | "end";

/** Bend to keep while blending: the solved shapes first, then author hints, then the limb default. */
function preferredBend(
  a: SolvedLimb,
  b: SolvedLimb,
  t: number,
  hints: [Bend | undefined, Bend | undefined],
  defaultBend: Bend,
): Bend {
  const early = t < 0.5;
  const solved = early ? (bendOf(a) ?? bendOf(b)) : (bendOf(b) ?? bendOf(a));
  const hinted = early ? (hints[0] ?? hints[1]) : (hints[1] ?? hints[0]);
  return solved ?? hinted ?? defaultBend;
}

/** A pinned end that barely moves, or slides along the floor, travels straight. */
function staysPlanted(a: SolvedLimb, b: SolvedLimb, contact: Contact, pinnedA: boolean, pinnedB: boolean): boolean {
  if (!pinnedA || !pinnedB) return false;
  const onFloor = a[contact][1] > -FLOOR_CONTACT && b[contact][1] > -FLOOR_CONTACT;
  return dist(a[contact], b[contact]) < SWING_THRESHOLD || onFloor;
}

/** Swing: blend bone angles so the limb sweeps instead of folding through itself. */
function swingTarget(
  a: SolvedLimb,
  b: SolvedLimb,
  root: Point,
  t: number,
  contact: Contact,
  fallback: Bend,
): { target: Point; bend: Bend } {
  const upper = lerpAngle(angleOf(a.root, a.mid), angleOf(b.root, b.mid), t);
  const lower = lerpAngle(angleOf(a.mid, a[contact]), angleOf(b.mid, b[contact]), t);
  const mid = add(root, scale(fromAngle(upper), dist(a.root, a.mid)));
  const target = add(mid, scale(fromAngle(lower), dist(a.mid, a[contact])));
  const c = cross(sub(mid, root), sub(target, mid));
  if (Math.abs(c) < 1e-6) return { target, bend: fallback };
  return { target, bend: c < 0 ? 1 : -1 };
}

function blendLimb(
  a: SolvedLimb,
  b: SolvedLimb,
  root: Point,
  t: number,
  pinnedA: boolean,
  pinnedB: boolean,
  /** Feet, and hands with a bent wrist: blend the joint position plus the end bone angle. */
  angledEnd: boolean,
  hints: [Bend | undefined, Bend | undefined],
  defaultBend: Bend,
): { target: Point; hint: JointHint; footAngle?: number } {
  const contact: Contact = angledEnd ? "joint" : "end";
  const footAngle = angledEnd ? lerpAngle(angleOf(a.joint, a.end), angleOf(b.joint, b.end), t) : undefined;
  const fallback = preferredBend(a, b, t, hints, defaultBend);
  if (staysPlanted(a, b, contact, pinnedA, pinnedB)) {
    return { target: lerpPoint(a[contact], b[contact], t), hint: { bend: fallback }, footAngle };
  }
  const swing = swingTarget(a, b, root, t, contact, fallback);
  return { target: swing.target, hint: { bend: swing.bend }, footAngle };
}

/** Blend each spine bone's angle; returns pelvis, waist, chest, neck, head. */
function blendSpine(a: Solved, b: Solved, pelvis: Point, t: number): Point[] {
  const chain = (s: Solved) => [s.pelvis, s.waist, s.chest, s.neck, s.head];
  const lengths = [BONES.pelvisWaist, BONES.waistChest, BONES.chestNeck, BONES.neckHead];
  const ca = chain(a);
  const cb = chain(b);
  const spine: Point[] = [pelvis];
  lengths.forEach((l, i) => {
    const angle = lerpAngle(angleOf(ca[i], ca[i + 1]), angleOf(cb[i], cb[i + 1]), t);
    spine.push(add(spine[i], scale(fromAngle(angle), l)));
  });
  return spine;
}

interface BlendedSide {
  hand: Point;
  /** Hand angle (degrees) when the wrist is bent. */
  wrist?: number;
  elbow: JointHint;
  foot: Point;
  knee: JointHint;
  toe: number;
}

interface BlendInput {
  a: Solved;
  b: Solved;
  pa: Pose;
  pb: Pose;
  frame: Solved;
  t: number;
}

/** An arm with a bent wrist in either keyframe blends like a leg: wrist position plus hand angle. */
const hasWrist = (pa: Pose, pb: Pose, side: Side): boolean =>
  pa.wrists?.[side] !== undefined || pb.wrists?.[side] !== undefined;

function blendArm({ a, b, pa, pb, frame, t }: BlendInput, side: Side) {
  const pinned: [boolean, boolean] = [Boolean(pa.hands?.[side]), Boolean(pb.hands?.[side])];
  const hints: [Bend | undefined, Bend | undefined] = [pa.elbows?.[side]?.bend, pb.elbows?.[side]?.bend];
  return blendLimb(a.arms[side], b.arms[side], frame.arms[side].root, t, ...pinned, hasWrist(pa, pb, side), hints, 1);
}

function blendLeg({ a, b, pa, pb, frame, t }: BlendInput, side: Side) {
  const pinned: [boolean, boolean] = [Boolean(pa.feet?.[side]), Boolean(pb.feet?.[side])];
  const hints: [Bend | undefined, Bend | undefined] = [pa.knees?.[side]?.bend, pb.knees?.[side]?.bend];
  return blendLimb(a.legs[side], b.legs[side], frame.legs[side].root, t, ...pinned, true, hints, -1);
}

function blendSide(input: BlendInput, side: Side): BlendedSide {
  const arm = blendArm(input, side);
  const leg = blendLeg(input, side);
  const wrist = arm.footAngle === undefined ? undefined : (arm.footAngle * 180) / Math.PI;
  return { hand: arm.target, wrist, elbow: arm.hint, foot: leg.target, knee: leg.hint, toe: ((leg.footAngle ?? 0) * 180) / Math.PI };
}

/** Blend two solved keyframes into pin targets for an in-between pose (re-solved afterwards). */
export function blendPose(a: Solved, b: Solved, pa: Pose, pb: Pose, t: number, view?: "side" | "front"): Pose {
  const pelvis = lerpPoint(a.pelvis, b.pelvis, t);
  // Spine: blend each bone's angle, then pin chest and head from that shape.
  const spine = blendSpine(a, b, pelvis, t);
  const spineHint = { bend: (cross(sub(spine[1], spine[0]), sub(spine[2], spine[1])) <= 0 ? 1 : -1) as Bend };
  // Where the shoulders/hips will be once the blended spine is solved.
  const frame = solvePose({ pelvis, chest: spine[2], head: spine[4], spine: spineHint }, { view });
  const hands: Partial<Record<Side, Point>> = {};
  const feet: Partial<Record<Side, Point>> = {};
  const elbows: Partial<Record<Side, JointHint>> = {};
  const knees: Partial<Record<Side, JointHint>> = {};
  const toes: Partial<Record<Side, number>> = {};
  const wrists: Partial<Record<Side, number>> = {};
  for (const side of SIDES) {
    const blended = blendSide({ a, b, pa, pb, frame, t }, side);
    hands[side] = blended.hand;
    if (blended.wrist !== undefined) wrists[side] = blended.wrist;
    elbows[side] = blended.elbow;
    feet[side] = blended.foot;
    knees[side] = blended.knee;
    toes[side] = blended.toe;
  }
  const pose: Pose = { pelvis, chest: spine[2], head: spine[4], spine: spineHint, hands, feet, elbows, knees, toes };
  return Object.keys(wrists).length ? { ...pose, wrists } : pose;
}

// ---------------------------------------------------------------- timeline

export const ease = (t: number): number => 0.5 - Math.cos(Math.PI * t) / 2;

export interface ResolvedKeyframe {
  pose: Pose;
  solved: Solved;
}

/** Solve every keyframe in order, carrying the pelvis and spine direction forward. */
export function solveKeyframes(spec: DoodleSpec): ResolvedKeyframe[] {
  const poses = spec.frames.map((frame) => resolveFramePose(frame.pose, frame.sideways));
  const firstPelvis = poses.find((p) => p.pelvis)?.pelvis;
  let pelvis = [...poses].reverse().find((p) => p.pelvis)?.pelvis ?? firstPelvis;
  let spineAngle: number | undefined;
  return poses.map((pose) => {
    const solved = solvePose(pose, { view: spec.view, pelvis, spineAngle });
    pelvis = solved.pelvis;
    spineAngle = angleOf(solved.pelvis, solved.chest);
    return { pose: { ...pose, pelvis: solved.pelvis }, solved };
  });
}

export interface Timeline {
  duration: number;
  keyTimes: number[];
  poses: Solved[];
  /** Index into `poses` of each keyframe. */
  keyframeIndex: number[];
  /** True for samples in the middle of a turn (foreshortened on purpose). */
  turning: boolean[];
  /** Mirror axis each sample is drawn about (undefined: as authored); reflect back to check joint ranges. */
  mirrors: (number | undefined)[];
  /** The solved keyframes the samples were blended from (as authored, not mirrored). */
  keys: ResolvedKeyframe[];
}

function mapSolved(s: Solved, f: (p: Point) => Point): Solved {
  const limb = (l: SolvedLimb): SolvedLimb => ({ root: f(l.root), mid: f(l.mid), joint: f(l.joint), end: f(l.end) });
  return {
    pelvis: f(s.pelvis),
    waist: f(s.waist),
    chest: f(s.chest),
    neck: f(s.neck),
    head: f(s.head),
    arms: { near: limb(s.arms.near), far: limb(s.arms.far) },
    legs: { near: limb(s.legs.near), far: limb(s.legs.far) },
    pins: s.pins.map((pin) => ({ ...pin, target: f(pin.target), actual: f(pin.actual) })),
  };
}

/** The figure reflected about the vertical line x = `axis` (it then faces -x). */
export function reflectSolved(s: Solved, axis: number | undefined): Solved {
  return axis === undefined ? s : mapSolved(s, ([x, y]) => [2 * axis - x, y]);
}

/** Joint-by-joint straight-line blend: the in-between of a turn. */
function lerpSolved(a: Solved, b: Solved, t: number): Solved {
  const points: Point[] = [];
  mapSolved(b, (p) => (points.push(p), p));
  let i = 0;
  const blended = mapSolved(a, (p) => lerpPoint(p, points[i++], t));
  return { ...blended, pins: [] };
}

/** Sample the looping keyframe sequence (holds + eased transitions). */
export function sampleTimeline(spec: DoodleSpec, stepsPerTransition = 14): Timeline {
  const transition = spec.transition ?? 0.9;
  const keys = solveKeyframes(spec);
  const times: number[] = [];
  const poses: Solved[] = [];
  const turning: boolean[] = [];
  const mirrors: (number | undefined)[] = [];
  const keyframeIndex: number[] = [];
  const shown = (index: number): Solved => reflectSolved(keys[index].solved, spec.frames[index].mirror);
  let clock = 0;
  spec.frames.forEach((frame, index) => {
    const next = (index + 1) % keys.length;
    const a = keys[index];
    const b = keys[next];
    const turn = frame.mirror !== spec.frames[next].mirror;
    keyframeIndex.push(poses.length);
    times.push(clock);
    poses.push(shown(index));
    turning.push(false);
    mirrors.push(frame.mirror);
    clock += frame.hold;
    for (let step = 0; step < stepsPerTransition; step += 1) {
      times.push(clock + (transition * step) / stepsPerTransition);
      const t = ease(step / stepsPerTransition);
      poses.push(
        turn
          ? lerpSolved(shown(index), shown(next), t)
          : reflectSolved(
              solvePose(blendPose(a.solved, b.solved, a.pose, b.pose, t, spec.view), { view: spec.view }),
              frame.mirror,
            ),
      );
      turning.push(turn && step > 0);
      mirrors.push(turn && step > 0 ? undefined : frame.mirror);
    }
    clock += transition;
  });
  times.push(clock);
  poses.push(shown(0));
  turning.push(false);
  mirrors.push(spec.frames[0].mirror);
  return { duration: clock, keyTimes: times.map((value) => value / clock), poses, keyframeIndex, turning, mirrors, keys };
}
