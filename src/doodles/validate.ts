import { BONES, SEGMENTS, dist, reflectSolved, sampleTimeline, type DoodleSpec, type Point, type Prop, type Side, type Solved } from "./rig";
import { dualLayout } from "./renderDual";
import { figurePoints, propSegments, specViewBox } from "./renderSvg";
import { dist3, sampleTimeline3, type Figure3, type Point3 } from "./rig3d";

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
interface Bone<P> {
  name: string;
  a: P;
  b: P;
  length: number;
}

/** The joints a figure is drawn through, in 2D (Solved) or 3D (Figure3). */
interface Body<P> {
  pelvis: P;
  waist: P;
  chest: P;
  neck: P;
  head: P;
  arms: Record<Side, { root: P; mid: P; joint: P; end: P }>;
  legs: Record<Side, { root: P; mid: P; joint: P; end: P }>;
}

function bones<P>(pose: Body<P>): Bone<P>[] {
  const list: Bone<P>[] = [
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

const maxBoneError = <P>(list: Bone<P>[], distance: (a: P, b: P) => number): number =>
  Math.max(...list.map((bone) => Math.abs(distance(bone.a, bone.b) - bone.length)));

export const boneLengthError = (pose: Solved): number => maxBoneError(bones(pose), dist);

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

/** Distance from `p` to segment ab, in 2D or 3D. */
function distanceToSegment<P extends readonly number[]>(p: P, a: P, b: P): number {
  const ab = b.map((v, i) => v - a[i]);
  const dot = (u: readonly number[], v: readonly number[]): number => u.reduce((sum, x, i) => sum + x * v[i], 0);
  const lengthSq = dot(ab, ab);
  const ap = p.map((v, i) => v - a[i]);
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, dot(ap, ab) / lengthSq));
  return Math.hypot(...p.map((v, i) => v - (a[i] + ab[i] * t)));
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
  // The floor is the below-floor rule, not an obstacle.
  if (prop.kind === "floor") return [];
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

/**
 * Head circle overlapping a prop obstacle (e.g. a head drawn inside a wall).
 * Pull-up bars are exempt: the head legitimately passes a bar (chin over bar),
 * which sits in front of or behind it, not in its plane.
 */
function headInProp(spec: DoodleSpec, pose: Solved): string[] {
  const issues: string[] = [];
  (spec.props ?? []).forEach((prop, index) => {
    if (prop.kind === "bar") return;
    for (const [c, d] of obstacles(prop)) {
      if (distanceToSegment(pose.head, c, d) < SEGMENTS.headRadius - TOUCH) {
        issues.push(`head overlaps prop ${index}`);
        return;
      }
    }
  });
  return issues;
}

/** Prop problems a sample shows: limbs crossing a prop, the head inside one. */
const propIssues = (spec: DoodleSpec, pose: Solved): string[] => [
  ...propCrossings(spec, pose).map((c) => `${c.segment} crosses prop ${c.prop}`),
  ...headInProp(spec, pose),
];

/** Every keyframe problem, one error line each. */
function keyframeErrors(keyframes: KeyframeReport[]): string[] {
  return keyframes.flatMap((k) => [
    ...k.unreachable.map((u) => `${u.joint} unreachable by ${u.miss}`),
    ...k.belowFloor.map((b) => `${b.joint} below floor (y=${b.y})`),
    ...k.outsideViewBox.map((o) => `${o.joint} outside viewBox`),
    ...k.propCrossings.map((c) => `${c.segment} crosses prop ${c.prop}`),
    ...k.anatomy,
  ].map((issue) => `frame ${k.index}: ${issue}`));
}

/** The sampling a check runs over: which samples are keyframes, and when each falls. */
interface Samples {
  keyframeIndex: number[];
  keyTimes: number[];
  duration: number;
}

/** Issues seen between keyframes, stamped with the sample's time (repeats dropped). */
function between<P>(timeline: Samples & { poses: P[] }, check: (pose: P, i: number) => string[]): string[] {
  const keys = new Set(timeline.keyframeIndex);
  return [
    ...new Set(
      timeline.poses.flatMap((pose, i) =>
        keys.has(i)
          ? []
          : check(pose, i).map((issue) => `between keyframes (t=${round(timeline.keyTimes[i] * timeline.duration, 1)}s): ${issue}`),
      ),
    ),
  ];
}

/** Transition samples (not keyframes) for which `test` holds. */
function betweenCount<P>(timeline: Samples & { poses: P[] }, test: (pose: P) => boolean): number {
  const keys = new Set(timeline.keyframeIndex);
  return timeline.poses.filter((pose, i) => !keys.has(i) && test(pose)).length;
}

export function validateSpec(spec: DoodleSpec): SpecReport {
  const guards = dualViewGuards(spec);
  if (guards.length > 0) return failed(spec, guards);
  return spec.views ? validateDual(spec) : validateFlat(spec);
}

/** Single-view specs (the 2D rig). */
function validateFlat(spec: DoodleSpec): SpecReport {
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
      anatomy: [...anatomy(reflectSolved(pose, timeline.mirrors[sampleIndex]), spec.view), ...headInProp(spec, pose)],
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
  // Mid-turn samples are foreshortened on purpose (the figure is front-on halfway).
  const maxBoneLengthErrorAllSamples = round(
    Math.max(...timeline.poses.filter((_, i) => !timeline.turning[i]).map(boneLengthError)),
    4,
  );
  // Joint ranges are judged as authored (a mirrored knee would otherwise read as bending backwards);
  // mid-turn samples are skipped.
  const transitionAnatomy = between(timeline, (pose, i) =>
    timeline.turning[i] ? [] : anatomy(reflectSolved(pose, timeline.mirrors[i]), spec.view),
  );
  // A limb sweeping through a prop between keyframes is as visible as one at a keyframe.
  const transitionPropCrossings = between(timeline, (pose) => propIssues(spec, pose));
  const transitionSamplesBelowFloor = betweenCount(timeline, (pose) => belowFloor(pose).length > 0);

  // An unsolvable pin can leave NaN joints, which every distance check above silently passes.
  const nonFinite = timeline.poses.filter((pose) =>
    figurePoints(pose).some(({ point }) => !Number.isFinite(point[0]) || !Number.isFinite(point[1])),
  ).length;
  if (nonFinite > 0) {
    errors.push(`${nonFinite} sampled poses have non-finite joints`);
  }
  if (maxBoneLengthErrorAllSamples > BONE_TOLERANCE) {
    errors.push(`bone length error ${maxBoneLengthErrorAllSamples} > ${BONE_TOLERANCE}`);
  }
  errors.push(...keyframeErrors(keyframes), ...transitionAnatomy, ...transitionPropCrossings);

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

// ---------------------------------------------------------------- dual view

/** Props a dual-view doodle can draw from the front. */
const DUAL_PROPS = new Set<Prop["kind"]>(["bar", "box", "board", "floor"]);

/** Spec-level rules for `views` / `sideways` (dual-view spec, "Scope" and "Solver"). */
export function dualViewGuards(spec: DoodleSpec): string[] {
  const errors: string[] = [];
  const sideways = spec.frames.some((frame) => frame.sideways);
  if (!spec.views) {
    if (sideways) errors.push("keyframe sideways needs views: [\"side\", \"front\"]");
    return errors;
  }
  if (spec.view === "front") errors.push("views can't be combined with view: \"front\"");
  if (spec.frames.some((frame) => frame.mirror !== undefined)) errors.push("views can't be combined with mirror (turning round)");
  if (spec.wheel !== undefined) errors.push("views can't be combined with wheel (no front drawing of an ab wheel yet)");
  for (const prop of spec.props ?? []) {
    if (!DUAL_PROPS.has(prop.kind)) errors.push(`prop ${prop.kind} can't be drawn in two views (bar, box, board and floor only)`);
  }
  return errors;
}

function failed(spec: DoodleSpec, errors: string[]): SpecReport {
  return {
    slug: spec.slug,
    ok: false,
    errors,
    maxBoneLengthError: 0,
    maxBoneLengthErrorAllSamples: 0,
    torsoRange: [0, 0],
    transitionSamplesBelowFloor: 0,
    transitionAnatomy: [],
    keyframes: [],
  };
}

const sub3 = (a: Point3, b: Point3): Point3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

/** Angle (degrees) between two 3D directions. */
function angle3(u: Point3, v: Point3): number {
  const dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const n = Math.hypot(...u) * Math.hypot(...v);
  return n < 1e-9 ? 0 : (Math.acos(Math.max(-1, Math.min(1, dot / n))) * 180) / Math.PI;
}

/** Joint ranges judged in 3D: knee / elbow flexion, arms through the head; spine on the side view. */
function anatomy3(f: Figure3, side: Solved): string[] {
  const issues = spineIssues(side);
  for (const s of ["near", "far"] as Side[]) {
    const leg = f.legs[s];
    const arm = f.arms[s];
    const knee = angle3(sub3(leg.mid, leg.root), sub3(leg.joint, leg.mid));
    const elbow = angle3(sub3(arm.mid, arm.root), sub3(arm.joint, arm.mid));
    if (knee > LIMITS.flexion) issues.push(`knee.${s} bends ${Math.round(knee)}° (> ${LIMITS.flexion}°)`);
    if (elbow > LIMITS.flexion) issues.push(`elbow.${s} bends ${Math.round(elbow)}° (> ${LIMITS.flexion}°)`);
    const segments: [string, Point3, Point3][] = [
      [`upperArm.${s}`, arm.root, arm.mid],
      [`forearm.${s}`, arm.mid, arm.joint],
      [`hand.${s}`, arm.joint, arm.end],
    ];
    for (const [name, a, b] of segments) {
      if (distanceToSegment(f.head, a, b) < HEAD_CLEARANCE) issues.push(`${name} passes through the head`);
    }
  }
  return issues;
}

/** Dual-view specs: bone lengths and joint ranges in 3D, floor and props on the side view, both panels in frame. */
function validateDual(spec: DoodleSpec): SpecReport {
  const timeline = sampleTimeline3(spec);
  const layout = dualLayout(spec, timeline);
  const box = layout.view;
  const inBox = ([x, y]: Point): boolean => x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h;
  const boneLists = timeline.poses.map((f) => bones(f));
  const keyframes = timeline.keyframeIndex.map((sampleIndex, index): KeyframeReport => {
    const figure = timeline.poses[sampleIndex];
    const side = layout.side[sampleIndex];
    const front = layout.front[sampleIndex];
    const outsideViewBox = [
      ...figurePoints(side).filter(({ point }) => !inBox(point)).map(({ name, point }) => ({ joint: `side ${name}`, point: roundPoint(point) })),
      ...figurePoints(front)
        .filter(({ point }) => !inBox([point[0] + layout.frontShift, point[1]]))
        .map(({ name, point }) => ({ joint: `front ${name}`, point: roundPoint(point) })),
    ];
    return {
      index,
      boneLengthError: round(maxBoneError(boneLists[sampleIndex], dist3), 4),
      torsoLength: round(dist3(figure.pelvis, figure.neck), 2),
      anatomy: [...anatomy3(figure, side), ...headInProp(spec, side)],
      unreachable: figure.pins
        .filter((pin) => dist3(pin.target, pin.actual) > PIN_TOLERANCE)
        .map((pin) => ({
          joint: pin.joint,
          target: roundPoint([pin.target[0], pin.target[1]]),
          actual: roundPoint([pin.actual[0], pin.actual[1]]),
          miss: round(dist3(pin.target, pin.actual), 1),
        })),
      belowFloor: belowFloor(side),
      outsideViewBox,
      propCrossings: propCrossings(spec, side),
    };
  });
  const errors: string[] = [];
  const allError = round(Math.max(...boneLists.map((list) => maxBoneError(list, dist3))), 4);
  const nonFinite = boneLists.filter((list) => list.some((b) => ![...b.a, ...b.b].every(Number.isFinite))).length;
  if (nonFinite > 0) errors.push(`${nonFinite} sampled poses have non-finite joints`);
  if (allError > BONE_TOLERANCE) errors.push(`bone length error ${allError} > ${BONE_TOLERANCE}`);
  const transitionAnatomy = between(timeline, (f, i) => anatomy3(f, layout.side[i]));
  const transitionPropCrossings = between(timeline, (_, i) => propIssues(spec, layout.side[i]));
  errors.push(...keyframeErrors(keyframes), ...transitionAnatomy, ...transitionPropCrossings);
  const torsos = keyframes.map((k) => k.torsoLength);
  return {
    slug: spec.slug,
    ok: errors.length === 0,
    errors,
    maxBoneLengthError: Math.max(...keyframes.map((k) => k.boneLengthError)),
    maxBoneLengthErrorAllSamples: allError,
    torsoRange: [Math.min(...torsos), Math.max(...torsos)],
    transitionSamplesBelowFloor: betweenCount({ ...timeline, poses: layout.side }, (side) => belowFloor(side).length > 0),
    transitionAnatomy,
    keyframes,
  };
}
