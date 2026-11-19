/**
 * Hand-held gear drawn from the solved poses each sample (issue #212): straps
 * from a fixed anchor (rings, suspension-trainer handles, an anchored band), a
 * band from hand to hand, and kettlebells hanging from the hands.
 *
 * Everything here is plain 2D geometry on one panel's poses, so the renderer,
 * the drawing's bounds and the validator share it.
 */
import type { Panel } from "./project";
import { ease, KETTLEBELL, zOut, type BellMode, type DoodleSpec, type Point, type Side, type Solved } from "./rig";

/** Ring radius (round the hand) and suspension handle half-width / loop height. */
export const RING_RADIUS = 10;
export const HANDLE_HALF = 14;
export const HANDLE_LOOP = 26;
/** Handle feet sit this many degrees either side of the bell's axis. */
const HANDLE_FOOT = 42;
/** A racked bell sits this far off the forearm (beyond its radius), and this share of its radius back from the wrist. */
const RACK_GAP = 3;
const RACK_BACK = 0.6;

const sides = (list: readonly Side[] | undefined): Side[] => [...(list ?? ["near", "far"])];

/** The panel a spec's single view draws (`view: "front"` is a front panel). */
export const panelOf = (spec: DoodleSpec): Panel => (spec.view === "front" ? "front" : "side");

/** Which sides carry a strap. */
export function strapSides(spec: DoodleSpec): Side[] {
  return spec.straps ? sides(spec.straps.sides) : [];
}

/** The joint a strap or anchored band holds: the hand tip, the knee, or the ankle (`to`). */
export function strapAttach(spec: DoodleSpec, pose: Solved, side: Side): Point {
  switch (spec.straps?.to) {
    case "knees":
      return pose.legs[side].mid;
    case "feet":
      return pose.legs[side].joint;
    default:
      return pose.arms[side].end;
  }
}

/**
 * Where a strap hangs from on this panel. Side: the spec's anchor. Front: the
 * anchor's height, straight above where the strap's hand (or knee) is in the
 * first sample, so straps hang either side of the centre line.
 */
export function strapAnchor(spec: DoodleSpec, poses: Solved[], side: Side, panel: Panel): Point {
  const anchor = spec.straps!.anchor;
  if (panel === "side") return anchor;
  return [strapAttach(spec, poses[0], side)[0], anchor[1]];
}

const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
const add = (a: Point, b: Point): Point => [a[0] + b[0], a[1] + b[1]];
const scale = (a: Point, k: number): Point => [a[0] * k, a[1] * k];
const lerp = (a: Point, b: Point, t: number): Point => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
function unit(v: Point, fallback: Point = [0, 1]): Point {
  const n = Math.hypot(v[0], v[1]);
  return n < 1e-9 ? fallback : [v[0] / n, v[1] / n];
}
const rotate = (v: Point, degrees: number): Point => {
  const r = (degrees * Math.PI) / 180;
  return [v[0] * Math.cos(r) - v[1] * Math.sin(r), v[0] * Math.sin(r) + v[1] * Math.cos(r)];
};

/**
 * The strap's line: anchor to where it meets its end. A ring's strap stops at
 * the top of the ring; a handle's strap forks into a triangle onto the handle
 * bar (drawn as one line: anchor, apex, bar end, bar end, apex); a band runs
 * straight to the hand or knee.
 */
export function strapLine(spec: DoodleSpec, anchor: Point, pose: Solved, side: Side): Point[] {
  const at = strapAttach(spec, pose, side);
  const down = unit(sub(at, anchor));
  switch (spec.straps!.end) {
    case "band":
      return [anchor, at];
    case "ring":
      return [anchor, sub(at, scale(down, RING_RADIUS))];
    case "handle": {
      const apex = sub(at, scale(down, HANDLE_LOOP));
      const across: Point = [-down[1] * HANDLE_HALF, down[0] * HANDLE_HALF];
      return [anchor, apex, add(at, across), sub(at, across), apex];
    }
  }
}

/** Per sample, the bell modes it blends between and how far (keyframes sit at t = 0), mirroring the timeline's sampling. */
export function bellBlends(spec: DoodleSpec, count: number): { from: BellMode; to: BellMode; t: number }[] {
  const modes = spec.frames.map((frame): BellMode => frame.bell ?? "hang");
  const perFrame = (count - 1) / modes.length;
  const steps = perFrame - 1;
  return Array.from({ length: count }, (_, i) => {
    if (i === count - 1) return { from: modes[0], to: modes[0], t: 0 };
    const k = Math.floor(i / perFrame);
    const s = i % perFrame;
    const t = s === 0 ? 0 : ease((s - 1) / steps);
    return { from: modes[k], to: modes[(k + 1) % modes.length], t };
  });
}

export interface Bell {
  centre: Point;
  radius: number;
  /** The handle: a quadratic curve from one foot on the bell, through the grip, to the other foot. */
  handle: [from: Point, control: Point, to: Point];
}

/** Bell radius of a spec's kettlebells. */
export const bellSize = (spec: DoodleSpec): number => spec.kettlebell?.size ?? KETTLEBELL.size;

/**
 * The bell's centre for a grip at the hand tip (see `BellMode`): straight below
 * it; on along the forearm; or on the back of the forearm by the wrist, behind
 * it (-x) in a side panel and outside it (the hand's own side) in a front panel.
 */
function bellCentre(pose: Solved, side: Side, radius: number, mode: BellMode, panel: Panel): Point {
  const arm = pose.arms[side];
  const grip = arm.end;
  if (mode === "hang") return [grip[0], grip[1] + radius * KETTLEBELL.grip];
  if (mode === "swing") return add(grip, scale(unit(sub(arm.end, arm.mid)), radius * KETTLEBELL.grip));
  const along = unit(sub(arm.joint, arm.mid), [0, -1]);
  const back = rackSide(along, panel === "side" ? -1 : zOut(side));
  return add(sub(arm.joint, scale(along, radius * RACK_BACK)), scale(back, radius + RACK_GAP));
}

/** The forearm's normal on the `want` side of x (-1 behind, +1 ahead); a forearm along x puts the bell below it. */
function rackSide(along: Point, want: number): Point {
  const a: Point = [-along[1], along[0]];
  const b: Point = [along[1], -along[0]];
  if (Math.abs(a[0]) <= 0.2) return a[1] > 0 ? a : b;
  return a[0] * want > 0 ? a : b;
}

/** A kettlebell gripped at the hand tip, `t` of the way from mode `from` to mode `to`; the handle points from the bell to the grip. */
export function bellAt(pose: Solved, side: Side, radius: number, panel: Panel, from: BellMode, to: BellMode = from, t = 0): Bell {
  const grip = pose.arms[side].end;
  const a = bellCentre(pose, side, radius, from, panel);
  const centre = from === to || t === 0 ? a : lerp(a, bellCentre(pose, side, radius, to, panel), t);
  const axis = unit(sub(grip, centre), [0, -1]);
  const foot1 = add(centre, scale(rotate(axis, -HANDLE_FOOT), radius));
  const foot2 = add(centre, scale(rotate(axis, HANDLE_FOOT), radius));
  const control = sub(scale(grip, 2), scale(add(foot1, foot2), 0.5));
  return { centre, radius, handle: [foot1, control, foot2] };
}

/** Every sample's bell in one hand. */
export function bells(spec: DoodleSpec, poses: Solved[], side: Side, panel: Panel): Bell[] {
  const blends = bellBlends(spec, poses.length);
  return poses.map((pose, i) => bellAt(pose, side, bellSize(spec), panel, blends[i].from, blends[i].to, blends[i].t));
}

/** Every point the gear is drawn through over the loop (for the drawing's bounds). */
export function gearPoints(spec: DoodleSpec, poses: Solved[], panel: Panel): Point[] {
  const points: Point[] = [];
  for (const side of strapSides(spec)) {
    const anchor = strapAnchor(spec, poses, side, panel);
    for (const pose of poses) {
      points.push(...strapLine(spec, anchor, pose, side));
      if (spec.straps!.end === "ring") {
        const [x, y] = strapAttach(spec, pose, side);
        points.push([x - RING_RADIUS, y - RING_RADIUS], [x + RING_RADIUS, y + RING_RADIUS]);
      }
    }
  }
  for (const side of spec.kettlebell?.hands ?? []) {
    for (const { centre: [x, y], radius: r, handle } of bells(spec, poses, side, panel)) {
      points.push([x - r, y - r], [x + r, y + r], handle[0], handle[2]);
    }
  }
  return points;
}
