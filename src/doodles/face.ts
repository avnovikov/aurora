/**
 * Head facing (issue #216): a keyframe's `face` (turn, tilt, nod) blended over
 * the loop, the head swung sideways on the neck by a tilt (two views), and the
 * nose tick that shows which way the head faces on each panel.
 *
 * The face is a 3D frame on the head: `u` up the head (the torso line turned
 * by the nod and the tilt), `f` the way the face points, `s` towards the far
 * side. The tick runs out along `f` from inside the head circle to just past
 * it, so it is foreshortened like any bone: a profile nose in the side view, a
 * dot in the middle of the face when it looks straight at the viewer.
 */
import type { View } from "./project";
import { deg, SEGMENTS, sampleKeys, type DoodleSpec, type Face, type Point, type Solved } from "./rig";
import type { Figure3, Point3 } from "./rig3d";

/** The nose tick runs from this share of the head radius out to this share (past the circle). */
export const NOSE_FROM = 0.55;
export const NOSE_TO = 1.3;

/** One sample's nose tick on a panel, and whether it is on the viewer's side of the head (drawn over it). */
export interface FaceMark {
  from: Point;
  to: Point;
  front: boolean;
}

/** Whether a spec turns its head anywhere (no tick otherwise). */
export const hasFace = (spec: { frames: readonly { face?: Face }[] }): boolean => spec.frames.some((frame) => frame.face !== undefined);

type Angles = Required<Face>;
const angles = (face: Face | undefined): Angles => ({ turn: face?.turn ?? 0, tilt: face?.tilt ?? 0, nod: face?.nod ?? 0 });

/** Each sample's face, blended between keyframes like the limbs (`count` samples, as the timeline lays them out). */
export function faceBlends(spec: { frames: readonly { face?: Face }[] }, count: number): Angles[] {
  const keys = spec.frames.map((frame) => angles(frame.face));
  return sampleKeys(keys.length, count).map(({ from, to, t }) => {
    const [a, b] = [keys[from], keys[to]];
    return { turn: a.turn + (b.turn - a.turn) * t, tilt: a.tilt + (b.tilt - a.tilt) * t, nod: a.nod + (b.nod - a.nod) * t };
  });
}

// ---------------------------------------------------------------- vectors

const add = (a: Point3, b: Point3): Point3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Point3, b: Point3): Point3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: Point3, k: number): Point3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: Point3, b: Point3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Point3, b: Point3): Point3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function unit(v: Point3, fallback: Point3): Point3 {
  const n = Math.hypot(v[0], v[1], v[2]);
  return n < 1e-9 ? fallback : scale(v, 1 / n);
}
/** Rodrigues: `v` turned by `degrees` about unit `axis`. */
function rotate(v: Point3, axis: Point3, degrees: number): Point3 {
  const [c, s] = [Math.cos(deg(degrees)), Math.sin(deg(degrees))];
  return add(add(scale(v, c), scale(cross(axis, v), s)), scale(axis, dot(axis, v) * (1 - c)));
}

/** The face's frame: `u` up the head, `f` where the face points, `s` towards the far side. */
interface Frame {
  u: Point3;
  f: Point3;
  s: Point3;
}

/**
 * The face frame from the torso (waist to chest) and a sideways hint (the
 * shoulders' far direction): square ahead of the chest, then nodded about `s`
 * (+ chin down), tilted about `f` (+ crown towards +z) and turned about `u`
 * (+ face towards +z). `nodOnly` stops after the nod (the axis a tilt turns about).
 */
function faceFrame(waist: Point3, chest: Point3, side: Point3, a: Angles, nodOnly = false): Frame {
  const u0 = unit(sub(chest, waist), [0, -1, 0]);
  const s0 = unit(sub(side, scale(u0, dot(side, u0))), [0, 0, 1]);
  // cross(s, u) points ahead: +x for an upright figure with s = +z.
  const f0 = cross(s0, u0);
  // About s, + turns u towards f (the head comes forward) and f towards -u (chin down).
  const u1 = rotate(u0, s0, a.nod);
  const f1 = rotate(f0, s0, a.nod);
  if (nodOnly) return { u: u1, f: f1, s: s0 };
  // About f, + would turn u towards -z, so a + tilt turns by -tilt.
  const u2 = rotate(u1, f1, -a.tilt);
  const s2 = rotate(s0, f1, -a.tilt);
  // About u, + turns f towards +z.
  return { u: u2, f: rotate(f1, u2, a.turn), s: rotate(s2, u2, a.turn) };
}

/** The chest's sideways direction of a 3D figure (near to far): rolled with a twist, unmoved by a shrug. */
const shoulderAxis = (figure: Figure3): Point3 => figure.across ?? sub(figure.arms.far.root, figure.arms.near.root);

/**
 * A 3D figure with its head swung sideways about the neck by the tilt (the
 * nod is already in the 2D spine the figure is built on). Bone length is kept.
 */
export function tiltHead(figure: Figure3, a: Angles): Figure3 {
  if (!a.tilt) return figure;
  const { f } = faceFrame(figure.waist, figure.chest, shoulderAxis(figure), a, true);
  return { ...figure, head: add(figure.neck, rotate(sub(figure.head, figure.neck), f, -a.tilt)) };
}

/** Every sample's head tilted (see `tiltHead`); the figures as given when the spec never tilts. */
export function tiltHeads(spec: DoodleSpec, figures: Figure3[]): Figure3[] {
  if (!spec.frames.some((frame) => frame.face?.tilt)) return figures;
  const blends = faceBlends(spec, figures.length);
  return figures.map((figure, i) => tiltHead(figure, blends[i]));
}

/** A panel's projection of 3D points and of directions towards its viewer. */
interface Lens {
  flat: (p: Point3) => Point;
  /** Positive when the direction points at the viewer. */
  depth: (v: Point3) => number;
}

const LENSES: Record<View, Lens> = {
  side: { flat: (p) => [p[0], p[1]], depth: (v) => -v[2] },
  front: { flat: (p) => [p[2], p[1]], depth: (v) => v[0] },
  top: { flat: (p) => [p[0], -p[2]], depth: (v) => -v[1] },
};

function markOf(head: Point3, frame: Frame, lens: Lens): FaceMark {
  const r = SEGMENTS.headRadius;
  return {
    from: lens.flat(add(head, scale(frame.f, NOSE_FROM * r))),
    to: lens.flat(add(head, scale(frame.f, NOSE_TO * r))),
    front: lens.depth(frame.f) >= -1e-6,
  };
}

/** Nose ticks of a single-view spec, from its 2D poses (side: the drawing is x, y with z towards the far side; front: the drawing's x is z). */
export function faceMarks2D(spec: DoodleSpec, poses: Solved[]): FaceMark[] | undefined {
  if (!hasFace(spec)) return undefined;
  const blends = faceBlends(spec, poses.length);
  const front = spec.view === "front";
  const lift = (p: Point): Point3 => (front ? [0, p[1], p[0]] : [p[0], p[1], 0]);
  const lens = LENSES[front ? "front" : "side"];
  return poses.map((pose, i) => markOf(lift(pose.head), faceFrame(lift(pose.waist), lift(pose.chest), [0, 0, 1], blends[i]), lens));
}

/** Nose ticks of a two-view spec on one panel, from its 3D figures. */
export function faceMarks3(spec: DoodleSpec, figures: Figure3[], panel: View): FaceMark[] | undefined {
  if (!hasFace(spec)) return undefined;
  const blends = faceBlends(spec, figures.length);
  return figures.map((figure, i) => markOf(figure.head, faceFrame(figure.waist, figure.chest, shoulderAxis(figure), blends[i]), LENSES[panel]));
}

/** The tick's points, for a drawing's bounds. */
export const facePoints = (marks: FaceMark[] | undefined): Point[] => (marks ?? []).flatMap((mark) => [mark.from, mark.to]);

/** Face marks of a figure drawn reflected about x = `axis` (side and top panels; the front panel sees it from behind). */
export function reflectMarks(marks: FaceMark[] | undefined, axis: number | undefined, panel: View): FaceMark[] | undefined {
  if (!marks || axis === undefined) return marks;
  if (panel === "front") return marks.map((mark) => ({ ...mark, front: !mark.front }));
  const flip = (p: Point): Point => [2 * axis - p[0], p[1]];
  return marks.map((mark) => ({ ...mark, from: flip(mark.from), to: flip(mark.to) }));
}
