/**
 * Partner figure (issue #216): a second figure on the exerciser's clock, for
 * partner-assisted stretches. It is solved like any spec (its own keyframes,
 * the exerciser's holds and transition), drawn reflected about `mirror` when
 * it faces the exerciser, and its holding hands are re-solved on every sample
 * so they stay on the exerciser's joints.
 */
import { faceMarks2D, faceMarks3, reflectMarks, type FaceMark } from "./face";
import type { View } from "./project";
import {
  BONES,
  dist,
  reflectSolved,
  sampleTimeline,
  solveJoint,
  type BodyJoint,
  type DoodleSpec,
  type Keyframe,
  type Point,
  type Side,
  type Solved,
  type SolvedLimb,
  type Timeline,
} from "./rig";
import { dist3, reachArm3, sampleTimeline3, type Figure3, type Limb3, type Point3, type Timeline3 } from "./rig3d";

/** The partner is drawn at this opacity and stroke width (the exerciser: full strength, 7). */
export const PARTNER_OPACITY = 0.55;
export const PARTNER_WIDTH = 5;

/** A held hand may sit this far off its joint (it is re-solved onto it; more means out of reach). */
export const HOLD_SLIP = 2;

/** The joints of a 2D or 3D figure (enough to find a held joint). */
interface Body<P> {
  pelvis: P;
  waist: P;
  chest: P;
  neck: P;
  head: P;
  arms: Record<Side, { root: P; mid: P; joint: P; end: P }>;
  legs: Record<Side, { root: P; mid: P; joint: P; end: P }>;
}

const half = <P extends readonly number[]>(a: P, b: P): P => a.map((v, i) => (v + b[i]) / 2) as unknown as P;

/** Where an exerciser joint is (see `BodyJoint`): a joint as drawn, or the middle of a bone. */
export function jointOf<P extends readonly number[]>(pose: Body<P>, name: BodyJoint): P {
  const [part, side] = name.split(".") as [string, Side | undefined];
  if (!side) return pose[part as "pelvis" | "waist" | "chest" | "neck" | "head"];
  const arm = pose.arms[side];
  const leg = pose.legs[side];
  const table: Record<string, P> = {
    shoulder: arm.root,
    elbow: arm.mid,
    wrist: arm.joint,
    hand: arm.end,
    hip: leg.root,
    knee: leg.mid,
    ankle: leg.joint,
    toe: leg.end,
    upperArm: half(arm.root, arm.mid),
    forearm: half(arm.mid, arm.joint),
    thigh: half(leg.root, leg.mid),
    shin: half(leg.mid, leg.joint),
  };
  return table[part];
}

/** Every joint name a hold may use (guards check `on` against it). */
export const BODY_JOINTS: readonly string[] = [
  "pelvis",
  "waist",
  "chest",
  "neck",
  "head",
  ...["shoulder", "elbow", "wrist", "hand", "hip", "knee", "ankle", "toe", "upperArm", "forearm", "thigh", "shin"].flatMap((part) => [`${part}.near`, `${part}.far`]),
];

const mirrorX = (x: number, axis: number | undefined): number => (axis === undefined ? x : 2 * axis - x);

/** Where a hold's hand goes (world coordinates): the exerciser's joint plus the hold's offset. */
function holdTarget<P extends readonly number[]>(pose: Body<P>, hold: { on: BodyJoint; offset?: Point }): P {
  const at = jointOf(pose, hold.on);
  const offset = [...(hold.offset ?? [0, 0]), 0];
  return at.map((v, i) => v + offset[i]) as unknown as P;
}

/**
 * The partner as a spec of its own: its keyframes on the exerciser's holds and
 * transition, each held hand pinned (in the partner's authored frame, so
 * reflected back through `mirror`) to where the exerciser's joint is at that
 * keyframe, with its sideways z in two views. `keys`: the exerciser's keyframe
 * poses as drawn (3D figures in two views).
 */
export function partnerSpec(spec: DoodleSpec, keys: (Solved | Figure3)[]): DoodleSpec {
  const partner = spec.partner!;
  const frames = spec.frames.map((frame, k): Keyframe => {
    const own = partner.frames[k];
    const hands = { ...own.pose.hands };
    const handZ = { ...own.sideways?.hands };
    for (const hold of partner.holds ?? []) {
      const at = holdTarget<readonly number[]>(keys[k], hold);
      hands[hold.hand] = [mirrorX(at[0], partner.mirror), at[1]];
      if (at.length === 3) handZ[hold.hand] = at[2];
    }
    const sideways = spec.views ? { ...own.sideways, hands: handZ } : own.sideways;
    return {
      pose: { ...own.pose, hands },
      hold: frame.hold,
      ...(sideways ? { sideways } : {}),
      ...(own.face ? { face: own.face } : {}),
    };
  });
  return {
    id: `${spec.id}.partner`,
    slug: `${spec.slug}-partner`,
    title: `${spec.title} (partner)`,
    frames,
    ...(spec.view ? { view: spec.view } : {}),
    ...(spec.views ? { views: spec.views } : {}),
    ...(spec.transition !== undefined ? { transition: spec.transition } : {}),
  };
}

/** Bend sign (`solveJoint`'s) of a drawn limb; straight: `fallback`. */
function bendOf(limb: SolvedLimb, fallback: 1 | -1): 1 | -1 {
  const c = (limb.mid[0] - limb.root[0]) * (limb.joint[1] - limb.mid[1]) - (limb.mid[1] - limb.root[1]) * (limb.joint[0] - limb.mid[0]);
  const sine = c / (dist(limb.mid, limb.root) * dist(limb.joint, limb.mid));
  if (Math.abs(sine) < 0.05) return fallback;
  return c < 0 ? 1 : -1;
}

/** A 2D arm re-solved so its hand tip reaches `target`, folding the way it already does (short of it when out of reach). */
export function reachArm(arm: SolvedLimb, target: Point, fallback: 1 | -1 = 1): SolvedLimb {
  const lower = BONES.forearm + BONES.hand;
  const mid = solveJoint(arm.root, target, BONES.upperArm, lower, bendOf(arm, fallback));
  const d = Math.max(dist(mid, target), 1e-9);
  const along = (l: number): Point => [mid[0] + ((target[0] - mid[0]) * l) / d, mid[1] + ((target[1] - mid[1]) * l) / d];
  return { root: arm.root, mid, joint: along(BONES.forearm), end: along(lower) };
}

/** The partner over the loop on the 2D rig: its derived spec, samples as authored (facing +x), and as drawn. */
export interface Partner2D {
  spec: DoodleSpec;
  timeline: Timeline;
  /** As drawn: reflected about `mirror`, held hands on the exerciser. */
  poses: Solved[];
  faces?: FaceMark[];
}

/** The partner of a single-view spec, against the exerciser's samples `main`. */
export function partnerFlat(spec: DoodleSpec, main: Solved[], keyframeIndex: number[]): Partner2D | undefined {
  if (!spec.partner) return undefined;
  const { mirror, holds = [] } = spec.partner;
  const derived = partnerSpec(spec, keyframeIndex.map((i) => main[i]));
  const timeline = sampleTimeline(derived);
  const poses = timeline.poses.map((authored, i) => {
    const pose = reflectSolved(authored, mirror);
    const arms = { ...pose.arms };
    for (const hold of holds) arms[hold.hand] = reachArm(pose.arms[hold.hand], holdTarget(main[i], hold), mirror === undefined ? 1 : -1);
    return { ...pose, arms };
  });
  return { spec: derived, timeline, poses, faces: reflectMarks(faceMarks2D(derived, timeline.poses), mirror, derived.view === "front" ? "front" : "side") };
}

const reflect3 = (p: Point3, axis: number | undefined): Point3 => [mirrorX(p[0], axis), p[1], p[2]];

/** A 3D figure reflected about the plane x = `axis`. */
function reflectFigure(f: Figure3, axis: number | undefined): Figure3 {
  if (axis === undefined) return f;
  const r = (p: Point3): Point3 => reflect3(p, axis);
  const limb = (l: Limb3): Limb3 => ({ root: r(l.root), mid: r(l.mid), joint: r(l.joint), end: r(l.end) });
  return {
    pelvis: r(f.pelvis),
    waist: r(f.waist),
    chest: r(f.chest),
    neck: r(f.neck),
    head: r(f.head),
    arms: { near: limb(f.arms.near), far: limb(f.arms.far) },
    legs: { near: limb(f.legs.near), far: limb(f.legs.far) },
    pins: f.pins.map((pin) => ({ ...pin, target: r(pin.target), actual: r(pin.actual) })),
  };
}

/** The partner of a two-view spec in 3D: derived spec, samples as authored, and as drawn. */
export interface Partner3D {
  spec: DoodleSpec;
  timeline: Timeline3;
  figures: Figure3[];
  /** Nose ticks per panel (reflected with the figure). */
  faces: (panel: View) => FaceMark[] | undefined;
}

export function partner3D(spec: DoodleSpec, main: Timeline3): Partner3D | undefined {
  if (!spec.partner) return undefined;
  const { mirror, holds = [] } = spec.partner;
  const derived = partnerSpec(spec, main.keyframeIndex.map((i) => main.poses[i]));
  const timeline = sampleTimeline3(derived);
  const figures = timeline.poses.map((authored, i) => {
    const figure = reflectFigure(authored, mirror);
    const arms = { ...figure.arms };
    for (const hold of holds) arms[hold.hand] = reachArm3(figure.arms[hold.hand], holdTarget(main.poses[i], hold));
    return { ...figure, arms };
  });
  return { spec: derived, timeline, figures, faces: (panel) => reflectMarks(faceMarks3(derived, timeline.poses, panel), mirror, panel) };
}

/** How far each hold's hand is off its joint, per sample (2D or 3D). */
export function holdSlips<P extends readonly number[]>(spec: DoodleSpec, partner: Body<P>[], main: Body<P>[]): { hold: string; slip: number; sample: number }[] {
  const found: { hold: string; slip: number; sample: number }[] = [];
  for (const hold of spec.partner?.holds ?? []) {
    partner.forEach((pose, i) => {
      const target = holdTarget(main[i], hold);
      const hand = pose.arms[hold.hand].end;
      const slip = target.length === 3 ? dist3(hand as unknown as Point3, target as unknown as Point3) : dist(hand as unknown as Point, target as unknown as Point);
      if (slip > HOLD_SLIP) found.push({ hold: `hands.${hold.hand} on ${hold.on}`, slip, sample: i });
    });
  }
  return found;
}
