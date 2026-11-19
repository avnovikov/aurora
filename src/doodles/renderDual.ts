/**
 * Dual-view doodles: the side and front views of one 3D-solved figure, side by
 * side at the same scale on one clock (spec: 2026-11-18-dual-view-doodles-design).
 */
import { FOCUS_BY_ID } from "./focus";
import { project } from "./project";
import {
  figureExtent,
  FIGURE_PARTS,
  figureSvg,
  fmt,
  frame,
  highlightSvg,
  identity,
  INK,
  PADDING,
  propSvg,
  resolveFloors,
  svgShell,
  timingAttr,
  union,
  type FigurePart,
  type Mapper,
  type ViewBox,
} from "./renderSvg";
import { SHOULDER_SIDE, type DoodleSpec, type Prop, type Side, type Solved } from "./rig";
import { sampleTimeline3, type Figure3, type Limb3, type Point3, type Timeline3 } from "./rig3d";

type Bar = Extract<Prop, { kind: "bar" }>;
type Box = Extract<Prop, { kind: "box" }>;

/** Half-width of a bar and a box seen from the front. */
const FRONT_BAR_HALF = 90;
const FRONT_BOX_HALF = 60;
/** View labels, in rig units (the doodle row is about half scale). */
const LABEL_SIZE = 22;
const LABEL_GAP = 12;
const LABEL_OPACITY = 0.6;

/** A bar seen end-on from the front: a stroke across the panel. */
const frontBar = (bar: Bar, shift: number): Prop => ({ kind: "bar", y: bar.y, x1: shift - FRONT_BAR_HALF, x2: shift + FRONT_BAR_HALF });

/** A box seen from the front, `frontHalf` either side of the panel's centre. */
function frontBox(box: Box, shift: number): Prop {
  const half = box.frontHalf ?? FRONT_BOX_HALF;
  return { kind: "box", x: shift - half, y: box.y, w: 2 * half, h: box.h };
}

/** Half-width of a bench board (and its legs) seen end-on. */
export const BOARD_HALF = 36;

/** A board seen end-on: its outline from its highest to its lowest point, and a leg at each edge. */
function frontBoard(board: Extract<Prop, { kind: "board" }>, shift: number): Prop[] {
  const top = Math.min(board.from[1], board.to[1]);
  const bottom = Math.max(board.from[1], board.to[1]);
  const outline: Prop = { kind: "box", x: shift - BOARD_HALF, y: top, w: 2 * BOARD_HALF, h: bottom - top };
  if (board.posts === false) return [outline];
  const legs = [shift - BOARD_HALF, shift + BOARD_HALF].map((x): Prop => ({ kind: "box", x, y: bottom, w: 1, h: -bottom }));
  return [outline, ...legs];
}

/** Default rail half-spacing of parallel bars seen from the front. */
export const FRONT_RAIL_HALF = 30;
/** Half-size of a rail or parallette handle seen end-on. */
const END_ON_HALF = 4;
/** Half-width of a parallette's foot on the floor, seen from the front. */
const PARALLETTE_FOOT = 12;

/** Sideways position (z) of each hand in the first keyframe: where parallettes stand. */
export type HandZ = Record<Side, number>;
export const handZ = (first: Figure3 | undefined): HandZ => ({
  near: first?.arms.near.end[2] ?? -SHOULDER_SIDE,
  far: first?.arms.far.end[2] ?? SHOULDER_SIDE,
});

/** A rail or handle seen end-on: a small square centred on (z, y). */
const endOn = (z: number, y: number): Prop => ({ kind: "box", x: z - END_ON_HALF, y: y - END_ON_HALF, w: 2 * END_ON_HALF, h: 2 * END_ON_HALF });
/** A plain vertical line from (z, top) to the floor. */
const upright = (z: number, top: number): Prop => ({ kind: "board", from: [z, top], to: [z, 0], posts: false });

/** Parallel bars seen end-on: each rail a small square at ±frontHalf on its upright. */
function frontParallelBars(bars: Extract<Prop, { kind: "parallelBars" }>, shift: number): Prop[] {
  const half = bars.frontHalf ?? FRONT_RAIL_HALF;
  return [-half, half].flatMap((z) => [endOn(shift + z, bars.y), upright(shift + z, bars.y + END_ON_HALF)]);
}

/** Parallettes seen end-on: a handle at each hand's z on an upright, with a foot on the floor. */
function frontParallettes(bars: Extract<Prop, { kind: "parallettes" }>, shift: number, hands: HandZ): Prop[] {
  return [hands.near, hands.far].flatMap((z): Prop[] => [
    endOn(shift + z, bars.y),
    upright(shift + z, bars.y + END_ON_HALF),
    { kind: "bar", y: 0, x1: shift + z - PARALLETTE_FOOT, x2: shift + z + PARALLETTE_FOOT },
  ]);
}

/** All props as seen from the front (dualViewGuards admits only the kinds handled here). */
export function frontProps(props: readonly Prop[], shift = 0, hands: HandZ = handZ(undefined)): Prop[] {
  return props.flatMap((prop): Prop[] => {
    switch (prop.kind) {
      case "bar":
        return [frontBar(prop, shift)];
      case "box":
        return [frontBox(prop, shift)];
      case "board":
        return frontBoard(prop, shift);
      case "parallelBars":
        return frontParallelBars(prop, shift);
      case "parallettes":
        return frontParallettes(prop, shift, hands);
      case "floor":
        // Passed through; resolved against the front poses.
        return [prop];
    }
  });
}

/**
 * Sideways (z) ranges a prop fills, matching its front drawing: a limb that
 * crosses the prop in the side view only touches it if it is inside one of
 * these at the crossing (two views; see validate's depth-aware crossings).
 */
export function propDepth(prop: Prop, hands: HandZ): [number, number][] {
  const around = (z: number, half: number): [number, number] => [z - half, z + half];
  switch (prop.kind) {
    case "bar":
      return [around(0, FRONT_BAR_HALF)];
    case "box":
      return [around(0, prop.frontHalf ?? FRONT_BOX_HALF)];
    case "board":
      return [around(0, BOARD_HALF)];
    case "parallelBars": {
      const half = prop.frontHalf ?? FRONT_RAIL_HALF;
      return [around(-half, END_ON_HALF), around(half, END_ON_HALF)];
    }
    case "parallettes":
      return [around(hands.near, PARALLETTE_FOOT), around(hands.far, PARALLETTE_FOOT)];
    case "floor":
      return [];
  }
}

/**
 * Parts drawn with another (band round the thighs, gear in a hand), and the part
 * they follow. Straps tied to the knees or feet (`straps.to`) follow the legs.
 */
const ATTACHED = {
  band: "legNear",
  wheel: "armNear",
  strapFar: "armFar",
  bellFar: "armFar",
  strapNear: "armNear",
  handBand: "armNear",
  bellNear: "armNear",
} as const satisfies Partial<Record<FigurePart, FigurePart>>;
type Attached = keyof typeof ATTACHED;
type BodyPart = Exclude<FigurePart, Attached>;

function attachedFor(spec: DoodleSpec): Record<Attached, BodyPart> {
  if (spec.straps?.to !== "knees" && spec.straps?.to !== "feet") return ATTACHED;
  return { ...ATTACHED, strapFar: "legFar", strapNear: "legNear" };
}

const limbPoints = (l: Limb3): Point3[] => [l.root, l.mid, l.joint, l.end];
const PART_POINTS: Record<BodyPart, (f: Figure3) => Point3[]> = {
  legFar: (f) => limbPoints(f.legs.far),
  armFar: (f) => limbPoints(f.arms.far),
  spine: (f) => [f.pelvis, f.waist, f.chest, f.neck],
  head: (f) => [f.head],
  legNear: (f) => limbPoints(f.legs.near),
  armNear: (f) => limbPoints(f.arms.near),
};

/** Mean forward position (x) of a part over the loop: larger x is nearer the front panel's viewer. */
function depthOf(part: BodyPart, poses: Figure3[]): number {
  const all = poses.flatMap(PART_POINTS[part]);
  return all.reduce((sum, p) => sum + p[0], 0) / Math.max(1, all.length);
}

const isBodyPart = (part: FigurePart): part is BodyPart => !(part in ATTACHED);

/** Front panel draw order: furthest from the viewer first, attached parts right after their anchor. */
function frontOrder(spec: DoodleSpec, poses: Figure3[]): FigurePart[] {
  const parts = FIGURE_PARTS.filter(isBodyPart);
  const depth = new Map(parts.map((part) => [part, depthOf(part, poses)]));
  const sorted = [...parts].sort((a, b) => depth.get(a)! - depth.get(b)!);
  const attached = Object.entries(attachedFor(spec)) as [FigurePart, BodyPart][];
  return sorted.flatMap((part) => [part, ...attached.filter(([, anchor]) => anchor === part).map(([extra]) => extra)]);
}

interface DualLayout {
  view: ViewBox;
  /** Added to front-panel x so it sits right of the side panel. */
  frontShift: number;
  side: Solved[];
  front: Solved[];
  labels: { side: number; front: number; y: number };
}

export function dualLayout(spec: DoodleSpec, timeline: Timeline3 = sampleTimeline3(spec)): DualLayout {
  const side = timeline.poses.map((pose) => project(pose, "side"));
  const front = timeline.poses.map((pose) => project(pose, "front"));
  const props = spec.props ?? [];
  const sideBox = figureExtent(side, resolveFloors(props, side), spec, "side");
  const frontBox = figureExtent(front, resolveFloors(frontProps(props, 0, handZ(timeline.poses[0])), front), spec, "front");
  const frontShift = sideBox.x + sideBox.w + 2 * PADDING - frontBox.x;
  const shifted: ViewBox = { ...frontBox, x: frontBox.x + frontShift };
  const figures = union(sideBox, shifted);
  const y = figures.y + figures.h + LABEL_GAP + LABEL_SIZE;
  // Down to the labels' descenders.
  const drawing = { ...figures, h: y + LABEL_SIZE * 0.3 - figures.y };
  return {
    view: frame(drawing),
    frontShift,
    side,
    front,
    labels: { side: sideBox.x + sideBox.w / 2, front: shifted.x + shifted.w / 2, y },
  };
}

function label(text: string, x: number, y: number): string {
  return `<text x="${fmt(x)}" y="${fmt(y)}" style="fill:${INK}" opacity="${LABEL_OPACITY}" stroke="none" font-family="system-ui, sans-serif" font-size="${LABEL_SIZE}" text-anchor="middle">${text}</text>`;
}

/** Animated SVG with a side panel and a front panel; no zoom inset. */
export function renderDualSvg(spec: DoodleSpec): string {
  const timeline = sampleTimeline3(spec);
  const timing = timingAttr(timeline);
  const layout = dualLayout(spec, timeline);
  const focus = FOCUS_BY_ID[spec.id];
  const shift: Mapper = ([x, y]) => [x + layout.frontShift, y];
  const props = spec.props ?? [];
  return svgShell(layout.view, spec.title, [
    highlightSvg(focus, layout.side, timing, identity),
    resolveFloors(props, layout.side).map(propSvg).join(""),
    figureSvg(spec, layout.side, timing, identity, { panel: "side" }),
    highlightSvg(focus, layout.front, timing, shift),
    resolveFloors(frontProps(props, layout.frontShift, handZ(timeline.poses[0])), layout.front, layout.frontShift).map(propSvg).join(""),
    // Seen from the front both sides are square on: no faded far side.
    figureSvg(spec, layout.front, timing, shift, { farOpacity: 1, order: frontOrder(spec, timeline.poses), panel: "front" }),
    label("side", layout.labels.side, layout.labels.y),
    label("front", layout.labels.front, layout.labels.y),
  ]);
}
