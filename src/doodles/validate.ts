import { BONES, dist, sampleTimeline, type DoodleSpec, type Point, type Prop, type Side, type Solved } from "./rig";
import { figurePoints, propSegments, specViewBox } from "./renderSvg";

/** Validator for doodle specs (rig v2 spec, "Validator" section). JSON-serialisable output. */

const BONE_TOLERANCE = 0.5;
const PIN_TOLERANCE = 0.5;
const FLOOR_TOLERANCE = 0.5;
/** Pinned contacts may press into the floor by at most this much (stroke width). */
const CONTACT_TOLERANCE = 3;
/** Crossings within this distance of a limb segment's ends count as touching (grips, contacts). */
const TOUCH = 3;

export interface KeyframeReport {
  index: number;
  boneLengthError: number;
  /** Straight-line pelvis→neck distance; informational only (a bent spine is shorter). */
  torsoLength: number;
  /** Joints outside their anatomical range, or an arm drawn through the head. */
  anatomy: string[];
  unreachable: { joint: string; target: Point; actual: Point; miss: number }[];
  belowFloor: { joint: string; y: number }[];
  outsideViewBox: { joint: string; point: Point }[];
  propCrossings: { segment: string; prop: number }[];
}

export interface SpecReport {
  slug: string;
  ok: boolean;
  errors: string[];
  maxBoneLengthError: number;
  /** Max bone-length error over every sampled step (keyframes and transitions). */
  maxBoneLengthErrorAllSamples: number;
  torsoRange: [number, number];
  /** Transition samples with a joint below the floor (warning only). */
  transitionSamplesBelowFloor: number;
  /** Anatomy problems seen only between keyframes (errors: they are visible in the loop). */
  transitionAnatomy: string[];
  keyframes: KeyframeReport[];
}

const round = (value: number, digits = 3): number => Math.round(value * 10 ** digits) / 10 ** digits;
const roundPoint = (p: Point): Point => [round(p[0], 1), round(p[1], 1)];

/** Named bones with their expected length. */
interface Bone {
  name: string;
  a: Point;
  b: Point;
  length: number;
}

function bones(pose: Solved): Bone[] {
  const list: Bone[] = [
    { name: "pelvis-waist", a: pose.pelvis, b: pose.waist, length: BONES.pelvisWaist },
    { name: "waist-chest", a: pose.waist, b: pose.chest, length: BONES.waistChest },
    { name: "chest-neck", a: pose.chest, b: pose.neck, length: BONES.chestNeck },
    { name: "neck-head", a: pose.neck, b: pose.head, length: BONES.neckHead },
  ];
  for (const side of ["near", "far"] as Side[]) {
    const arm = pose.arms[side];
    const leg = pose.legs[side];
    list.push(
      { name: `upperArm.${side}`, a: arm.root, b: arm.mid, length: BONES.upperArm },
      { name: `forearm.${side}`, a: arm.mid, b: arm.joint, length: BONES.forearm },
      { name: `hand.${side}`, a: arm.joint, b: arm.end, length: BONES.hand },
      { name: `thigh.${side}`, a: leg.root, b: leg.mid, length: BONES.thigh },
      { name: `shin.${side}`, a: leg.mid, b: leg.joint, length: BONES.shin },
      { name: `foot.${side}`, a: leg.joint, b: leg.end, length: BONES.foot },
    );
  }
  return list;
}

export function boneLengthError(pose: Solved): number {
  return Math.max(...bones(pose).map((bone) => Math.abs(dist(bone.a, bone.b) - bone.length)));
}

export const torsoLength = (pose: Solved): number => dist(pose.pelvis, pose.neck);

/**
 * Anatomical ranges (degrees). Segment lengths are fixed by the rig, so the
 * spine may bend freely within these limits — an arch or a rounded back is a
 * bend, not a shorter torso.
 */
const LIMITS = {
  /** Each spine joint (lumbar, thoracic). */
  spineJoint: 35,
  /** Neck (chest→neck vs neck→head). */
  neck: 60,
  /** Knee/elbow flexion. */
  flexion: 160,
  /** Allowed hyperextension the "wrong" way. */
  hyperextension: 10,
} as const;

const sub2 = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];

/** Signed angle (degrees) turning from direction u to direction v (y points down). */
function turn(u: Point, v: Point): number {
  return (Math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1]) * 180) / Math.PI;
}

/**
 * Figures face +x, so knee flexion turns the shin clockwise from the thigh
 * (positive) and elbow flexion turns the forearm counter-clockwise (negative),
 * whether the figure stands, lies face up or lies face down.
 */
function spineIssues(pose: Solved): string[] {
  const spine: [string, Point, Point, Point, number][] = [
    ["lumbar", pose.pelvis, pose.waist, pose.chest, LIMITS.spineJoint],
    ["thoracic", pose.waist, pose.chest, pose.neck, LIMITS.spineJoint],
    ["neck", pose.chest, pose.neck, pose.head, LIMITS.neck],
  ];
  return spine.flatMap(([name, a, b, c, limit]) => {
    const bend = Math.abs(turn(sub2(b, a), sub2(c, b)));
    return bend > limit ? [`${name} bends ${Math.round(bend)}° (> ${limit}°)`] : [];
  });
}

function hingeIssues(name: string, angle: number, view: "side" | "front" | undefined): string[] {
  const issues: string[] = [];
  if (Math.abs(angle) > LIMITS.flexion) issues.push(`${name} bends ${Math.round(Math.abs(angle))}° (> ${LIMITS.flexion}°)`);
  if (view !== "front" && angle < -LIMITS.hyperextension) issues.push(`${name} bends backwards ${Math.round(-angle)}°`);
  return issues;
}

function headIssues(pose: Solved, side: Side): string[] {
  const arm = pose.arms[side];
  const segments: [string, Point, Point][] = [
    [`upperArm.${side}`, arm.root, arm.mid],
    [`forearm.${side}`, arm.mid, arm.joint],
    [`hand.${side}`, arm.joint, arm.end],
  ];
  return segments
    .filter(([, a, b]) => distanceToSegment(pose.head, a, b) < HEAD_CLEARANCE)
    .map(([name]) => `${name} passes through the head`);
}

function anatomy(pose: Solved, view: "side" | "front" | undefined): string[] {
  return [
    ...spineIssues(pose),
    ...(["near", "far"] as Side[]).flatMap((side) => {
      const leg = pose.legs[side];
      const arm = pose.arms[side];
      const knee = turn(sub2(leg.mid, leg.root), sub2(leg.joint, leg.mid));
      const elbow = -turn(sub2(arm.mid, arm.root), sub2(arm.joint, arm.mid));
      return [...hingeIssues(`knee.${side}`, knee, view), ...hingeIssues(`elbow.${side}`, elbow, view), ...headIssues(pose, side)];
    }),
  ];
}

/** An arm closer than this to the head centre is drawn through the head circle. */
const HEAD_CLEARANCE = 20;

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const ab = sub2(b, a);
  const lengthSq = ab[0] * ab[0] + ab[1] * ab[1];
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / lengthSq));
  return dist(p, [a[0] + ab[0] * t, a[1] + ab[1] * t]);
}

/** Joints a pin makes exempt from the floor check (contacts the move asks for). */
function floorExempt(pose: Solved): Set<string> {
  const exempt = new Set<string>();
  for (const pin of pose.pins) {
    const [group, side] = pin.joint.split(".");
    if (group === "hands") exempt.add(`hand.${side}`).add(`wrist.${side}`);
    if (group === "elbows") exempt.add(`elbow.${side}`);
    if (group === "feet") exempt.add(`ankle.${side}`).add(`toe.${side}`);
    if (group === "knees") exempt.add(`knee.${side}`);
  }
  return exempt;
}

function belowFloor(pose: Solved): { joint: string; y: number }[] {
  const exempt = floorExempt(pose);
  return figurePoints(pose)
    .filter((p) => p.point[1] > (exempt.has(p.name) ? CONTACT_TOLERANCE : FLOOR_TOLERANCE))
    .map((p) => ({ joint: p.name, y: round(p.point[1], 1) }));
}

/** Proper intersection of segments ab and cd, ignoring touches near ab's ends. */
function crosses(a: Point, b: Point, c: Point, d: Point): boolean {
  const r: Point = [b[0] - a[0], b[1] - a[1]];
  const s: Point = [d[0] - c[0], d[1] - c[1]];
  const denom = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(denom) < 1e-9) return false;
  const qp: Point = [c[0] - a[0], c[1] - a[1]];
  const t = (qp[0] * s[1] - qp[1] * s[0]) / denom;
  const u = (qp[0] * r[1] - qp[1] * r[0]) / denom;
  const length = Math.hypot(r[0], r[1]);
  const margin = Math.min(0.49, TOUCH / Math.max(length, 1e-9));
  return t > margin && t < 1 - margin && u >= 0 && u <= 1;
}

/** Prop segments a limb must not pass through (parallel-bar rails run past the body, so only uprights count). */
function obstacles(prop: Prop): [Point, Point][] {
  const segments = propSegments(prop);
  return prop.kind === "parallelBars" ? segments.slice(1) : segments;
}

function propCrossings(spec: DoodleSpec, pose: Solved): { segment: string; prop: number }[] {
  const limbs = bones(pose).filter((bone) => !/^(pelvis|waist|chest|neck)-/.test(bone.name));
  const found: { segment: string; prop: number }[] = [];
  (spec.props ?? []).forEach((prop, index) => {
    for (const [c, d] of obstacles(prop)) {
      for (const bone of limbs) {
        if (crosses(bone.a, bone.b, c, d) && !found.some((f) => f.segment === bone.name && f.prop === index)) {
          found.push({ segment: bone.name, prop: index });
        }
      }
    }
  });
  return found;
}

export function validateSpec(spec: DoodleSpec): SpecReport {
  const timeline = sampleTimeline(spec);
  const box = specViewBox(spec, timeline.poses);
  const errors: string[] = [];
  const keyframes = timeline.keyframeIndex.map((sampleIndex, index): KeyframeReport => {
    const pose = timeline.poses[sampleIndex];
    const outsideViewBox = figurePoints(pose)
      .filter(
        ({ point }) => point[0] < box.x || point[0] > box.x + box.w || point[1] < box.y || point[1] > box.y + box.h,
      )
      .map(({ name, point }) => ({ joint: name, point: roundPoint(point) }));
    return {
      index,
      boneLengthError: round(boneLengthError(pose), 4),
      torsoLength: round(torsoLength(pose), 2),
      anatomy: anatomy(pose, spec.view),
      unreachable: pose.pins
        .filter((pin) => dist(pin.target, pin.actual) > PIN_TOLERANCE)
        .map((pin) => ({
          joint: pin.joint,
          target: roundPoint(pin.target),
          actual: roundPoint(pin.actual),
          miss: round(dist(pin.target, pin.actual), 1),
        })),
      belowFloor: belowFloor(pose),
      outsideViewBox,
      propCrossings: propCrossings(spec, pose),
    };
  });

  const torsos = keyframes.map((k) => k.torsoLength);
  const torsoRange: [number, number] = [Math.min(...torsos), Math.max(...torsos)];
  const maxBoneLengthError = Math.max(...keyframes.map((k) => k.boneLengthError));
  const maxBoneLengthErrorAllSamples = round(Math.max(...timeline.poses.map(boneLengthError)), 4);
  const between = (check: (pose: Solved) => string[]): string[] => [
    ...new Set(
      timeline.poses.flatMap((pose, i) =>
        timeline.keyframeIndex.includes(i)
          ? []
          : check(pose).map((issue) => `between keyframes (t=${round(timeline.keyTimes[i] * timeline.duration, 1)}s): ${issue}`),
      ),
    ),
  ];
  const transitionAnatomy = between((pose) => anatomy(pose, spec.view));
  // A limb sweeping through a prop between keyframes is as visible as one at a keyframe.
  const transitionPropCrossings = between((pose) =>
    propCrossings(spec, pose).map((c) => `${c.segment} crosses prop ${c.prop}`),
  );
  const transitionSamplesBelowFloor = timeline.poses.filter(
    (pose, i) => !timeline.keyframeIndex.includes(i) && belowFloor(pose).length > 0,
  ).length;

  if (maxBoneLengthErrorAllSamples > BONE_TOLERANCE) {
    errors.push(`bone length error ${maxBoneLengthErrorAllSamples} > ${BONE_TOLERANCE}`);
  }
  for (const k of keyframes) {
    for (const u of k.unreachable) errors.push(`frame ${k.index}: ${u.joint} unreachable by ${u.miss}`);
    for (const b of k.belowFloor) errors.push(`frame ${k.index}: ${b.joint} below floor (y=${b.y})`);
    for (const o of k.outsideViewBox) errors.push(`frame ${k.index}: ${o.joint} outside viewBox`);
    for (const c of k.propCrossings) errors.push(`frame ${k.index}: ${c.segment} crosses prop ${c.prop}`);
    for (const a of k.anatomy) errors.push(`frame ${k.index}: ${a}`);
  }
  errors.push(...transitionAnatomy, ...transitionPropCrossings);

  return {
    slug: spec.slug,
    ok: errors.length === 0,
    errors,
    maxBoneLengthError,
    maxBoneLengthErrorAllSamples,
    torsoRange,
    transitionSamplesBelowFloor,
    transitionAnatomy,
    keyframes,
  };
}
