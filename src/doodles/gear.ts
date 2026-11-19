/**
 * Hand-held gear drawn from the solved poses each sample (issue #212): straps
 * from a fixed anchor (rings, suspension-trainer handles, an anchored band), a
 * band from hand to hand, and kettlebells in one hand, handed between the
 * hands, or held in both by the horns.
 *
 * Everything here is plain 2D geometry on one panel's poses, so the renderer,
 * the drawing's bounds and the validator share it.
 */
import type { Panel } from "./project";
import { BONES, ease, KETTLEBELL, zOut, type BellMode, type DoodleSpec, type Keyframe, type Point, type Side, type Solved } from "./rig";
import type { Figure3, Point3 } from "./rig3d";

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

/** A band looped round the upper arm (`to: "elbows"`) sits this share of the way from shoulder to elbow. */
export const ELBOW_LOOP = 0.8;

/** The joint a strap or anchored band holds: the hand tip, just above the elbow, the knee, or the ankle (`to`). */
export function strapAttach(spec: DoodleSpec, pose: Solved, side: Side): Point {
  switch (spec.straps?.to) {
    case "elbows":
      return lerp(pose.arms[side].root, pose.arms[side].mid, ELBOW_LOOP);
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
 * anchor's height, `straps.width` either side of the centre line, or (no
 * width) straight above where the strap's hand (or knee) is in the first
 * sample. Either way the anchor is fixed over the loop.
 */
export function strapAnchor(spec: DoodleSpec, poses: Solved[], side: Side, panel: Panel): Point {
  const { anchor, width } = spec.straps!;
  if (panel === "side") return anchor;
  if (width !== undefined) return [zOut(side) * width, anchor[1]];
  return [strapAttach(spec, poses[0], side)[0], anchor[1]];
}

const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
const add = (a: Point, b: Point): Point => [a[0] + b[0], a[1] + b[1]];
const scale = (a: Point, k: number): Point => [a[0] * k, a[1] * k];
function lerp(a: Point, b: Point, t: number): Point {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
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

/** Where a bell sits: a `BellMode` in one hand, or `horns` (both hands). */
export type BellPlace = BellMode | "horns";

/** A bell's place at one keyframe and the hand holding it (ignored by `horns`). */
export interface BellKey {
  place: BellPlace;
  holder: Side;
}

/** Whether a spec hands its bell between the hands (`bellIn` on any keyframe). */
export const handsOff = (spec: DoodleSpec): boolean => spec.frames.some((frame) => frame.bellIn);

/** Whether a spec holds its bell by the horns on any keyframe. */
export const byTheHorns = (spec: DoodleSpec): boolean => spec.frames.some((frame) => frame.bell === "horns");

/**
 * Which hand holds the bell that starts in `side` at each keyframe: `side`
 * throughout, unless keyframes say `bellIn`, which holds until the next one
 * that does (round the loop).
 */
export function bellHolders(spec: DoodleSpec, side: Side): Side[] {
  if (!handsOff(spec)) return spec.frames.map(() => side);
  let holder = [...spec.frames].reverse().find((frame) => frame.bellIn)!.bellIn!;
  return spec.frames.map((frame) => (holder = frame.bellIn ?? holder));
}

/** A keyframe's place for the bell in `holder`'s hand (`bell` for every bell, or per hand; default hang). */
function placeOf(frame: Keyframe, holder: Side): BellPlace {
  const bell = frame.bell;
  if (bell === undefined) return "hang";
  if (typeof bell === "string") return bell;
  return bell[holder] ?? "hang";
}

/** Each keyframe's place and holder for the bell that starts in `side`. */
export function bellKeys(spec: DoodleSpec, side: Side): BellKey[] {
  const holders = bellHolders(spec, side);
  return spec.frames.map((frame, k) => ({ place: placeOf(frame, holders[k]), holder: holders[k] }));
}

/**
 * Per sample, the keys it blends between and how far (keyframes sit at t = 0),
 * mirroring the timeline's sampling. A transition stays in the hand that held
 * the bell at its start: a new holder takes over at its keyframe (the hand-off,
 * hands together).
 */
export function bellBlends(spec: DoodleSpec, count: number, side: Side): { from: BellKey; to: BellKey; t: number }[] {
  const keys = bellKeys(spec, side);
  const perFrame = (count - 1) / keys.length;
  const steps = perFrame - 1;
  return Array.from({ length: count }, (_, i) => {
    if (i === count - 1) return { from: keys[0], to: keys[0], t: 0 };
    const k = Math.floor(i / perFrame);
    const s = i % perFrame;
    const t = s === 0 ? 0 : ease((s - 1) / steps);
    const from = keys[k];
    return { from, to: { place: keys[(k + 1) % keys.length].place, holder: from.holder }, t };
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

/** Elbow to hand tip of a straight wrist: the 3D length a horns bell's offset is measured against. */
const FOREARM_HAND = BONES.forearm + BONES.hand;

/**
 * Grip and centre of a bell. In one hand: the hand tip and `bellCentre`. By
 * the horns: the hands' midpoint, the bell on beyond it along the mean forearm
 * (elbow to hand tip), its offset foreshortened with the forearms so a bell
 * pointing at the viewer sits on the hands.
 */
function placed(pose: Solved, key: BellKey, radius: number, panel: Panel): { grip: Point; centre: Point } {
  if (key.place !== "horns") return { grip: pose.arms[key.holder].end, centre: bellCentre(pose, key.holder, radius, key.place, panel) };
  const { near, far } = pose.arms;
  const grip = lerp(near.end, far.end, 0.5);
  const forearm = scale(add(sub(near.end, near.mid), sub(far.end, far.mid)), 0.5);
  return { grip, centre: add(grip, scale(forearm, (radius * KETTLEBELL.grip) / FOREARM_HAND)) };
}

/** A bell `t` of the way from key `from` to key `to`; the handle points from the bell to the grip. */
export function bellBetween(pose: Solved, radius: number, panel: Panel, from: BellKey, to: BellKey = from, t = 0): Bell {
  const a = placed(pose, from, radius, panel);
  const same = t === 0 || (from.place === to.place && from.holder === to.holder);
  const b = same ? a : placed(pose, to, radius, panel);
  const centre = same ? a.centre : lerp(a.centre, b.centre, t);
  const grip = same ? a.grip : lerp(a.grip, b.grip, t);
  const axis = unit(sub(grip, centre), [0, -1]);
  const foot1 = add(centre, scale(rotate(axis, -HANDLE_FOOT), radius));
  const foot2 = add(centre, scale(rotate(axis, HANDLE_FOOT), radius));
  const control = sub(scale(grip, 2), scale(add(foot1, foot2), 0.5));
  return { centre, radius, handle: [foot1, control, foot2] };
}

/** A kettlebell gripped at `side`'s hand tip (or both, `horns`), `t` of the way from place `from` to place `to`. */
export function bellAt(pose: Solved, side: Side, radius: number, panel: Panel, from: BellPlace, to: BellPlace = from, t = 0): Bell {
  return bellBetween(pose, radius, panel, { place: from, holder: side }, { place: to, holder: side }, t);
}

/** Every sample's bell that starts in hand `side`. */
export function bells(spec: DoodleSpec, poses: Solved[], side: Side, panel: Panel): Bell[] {
  const blends = bellBlends(spec, poses.length, side);
  return poses.map((pose, i) => bellBetween(pose, bellSize(spec), panel, blends[i].from, blends[i].to, blends[i].t));
}

const lerp3 = (a: Point3, b: Point3, t: number): Point3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Roughly where the bell is in 3D (enough to tell which side of the head it is): horns as `placed`, else the gripping hand. */
function bellNear3(figure: Figure3, key: BellKey, radius: number): Point3 {
  if (key.place !== "horns") return figure.arms[key.holder].end;
  const { near, far } = figure.arms;
  const grip = lerp3(near.end, far.end, 0.5);
  const k = (radius * KETTLEBELL.grip) / FOREARM_HAND / 2;
  const out = (i: number): number => grip[i] + (near.end[i] - near.mid[i] + far.end[i] - far.mid[i]) * k;
  return [out(0), out(1), out(2)];
}

/**
 * Per sample, whether the bell held by the horns is nearer this panel's viewer
 * than the head (side: smaller z; front: larger x), so it can be drawn in
 * front of the head or behind it.
 */
export function bellInFront(spec: DoodleSpec, figures: Figure3[], panel: Panel): boolean[] {
  const side = spec.kettlebell!.hands[0];
  const blends = bellBlends(spec, figures.length, side);
  const radius = bellSize(spec);
  return figures.map((figure, i) => {
    const { from, to, t } = blends[i];
    const bell = lerp3(bellNear3(figure, from, radius), bellNear3(figure, to, radius), t);
    return panel === "side" ? bell[2] < figure.head[2] : bell[0] > figure.head[0];
  });
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
