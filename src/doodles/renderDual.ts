/**
 * Dual-view doodles: the side and front views of one 3D-solved figure, side by
 * side at the same scale on one clock (spec: 2026-11-18-dual-view-doodles-design).
 */
import { faceMarks3 } from "./face";
import { FOCUS_BY_ID } from "./focus";
import { bellInFront, byTheHorns, heldKind, heldLine, heldLines } from "./gear";
import { partner3D } from "./partner";
import { project, type Panel, type View } from "./project";
import {
  extraPoints,
  figureExtent,
  FIGURE_PARTS,
  figureSvg,
  fmt,
  frame,
  highlightSvg,
  identity,
  INK,
  PADDING,
  partnerSvg,
  propSvg,
  resolveFloors,
  svgShell,
  timingAttr,
  union,
  type FigurePart,
  type Mapper,
  type PanelExtras,
  type ViewBox,
} from "./renderSvg";
import { SHOULDER_SIDE, type DoodleSpec, type Prop, type Side, type Solved } from "./rig";
import { dist3, sampleTimeline3, type Figure3, type Limb3, type Point3, type Timeline3 } from "./rig3d";

type Bar = Extract<Prop, { kind: "bar" }>;
type Box = Extract<Prop, { kind: "box" }>;

/**
 * Sideways (z) half-extents of each prop, as drawn from the front and from
 * above, and checked by the depth-aware crossings (one table for all three).
 */
export const PROP_HALF = {
  bar: 90,
  /** A box, unless it gives `frontHalf`. */
  box: 60,
  /** A bench board (and its legs) seen end-on. */
  board: 36,
  /** Parallel bars' rails each side of the centre, unless `frontHalf`. */
  rail: 30,
  /** A rail or handle seen end-on. */
  railEnd: 4,
  /** A parallette's foot on the floor, seen from the front. */
  parallette: 12,
} as const;
/** View labels, in rig units (the doodle row is about half scale). */
export const LABEL_SIZE = 22;
export const LABEL_GAP = 12;
const LABEL_OPACITY = 0.6;

/** A bar seen end-on from the front: a stroke across the panel. */
const frontBar = (bar: Bar, shift: number): Prop => ({ kind: "bar", y: bar.y, x1: shift - PROP_HALF.bar, x2: shift + PROP_HALF.bar });

/** A box seen from the front, `frontHalf` either side of the panel's centre. */
function frontBox(box: Box, shift: number): Prop {
  const half = box.frontHalf ?? PROP_HALF.box;
  return { kind: "box", x: shift - half, y: box.y, w: 2 * half, h: box.h };
}

/** A board seen end-on: its outline from its highest to its lowest point, and a leg at each edge. */
function frontBoard(board: Extract<Prop, { kind: "board" }>, shift: number): Prop[] {
  const top = Math.min(board.from[1], board.to[1]);
  const bottom = Math.max(board.from[1], board.to[1]);
  const outline: Prop = { kind: "box", x: shift - PROP_HALF.board, y: top, w: 2 * PROP_HALF.board, h: bottom - top };
  if (board.posts === false) return [outline];
  const legs = [shift - PROP_HALF.board, shift + PROP_HALF.board].map((x): Prop => ({ kind: "box", x, y: bottom, w: 1, h: -bottom }));
  return [outline, ...legs];
}

/** A parallel bars' rail half-spacing: its `frontHalf`, or the default. */
export const railHalf = (bars: Extract<Prop, { kind: "parallelBars" }>): number => bars.frontHalf ?? PROP_HALF.rail;

/** Sideways position (z) of each hand in the first keyframe: where parallettes stand. */
export type HandZ = Record<Side, number>;
export const handZ = (first: Figure3 | undefined): HandZ => ({
  near: first?.arms.near.end[2] ?? -SHOULDER_SIDE,
  far: first?.arms.far.end[2] ?? SHOULDER_SIDE,
});

/** A rail or handle seen end-on: a small square centred on (z, y). */
const endOn = (z: number, y: number): Prop => ({ kind: "box", x: z - PROP_HALF.railEnd, y: y - PROP_HALF.railEnd, w: 2 * PROP_HALF.railEnd, h: 2 * PROP_HALF.railEnd });
/** A plain vertical line from (z, top) to the floor. */
const upright = (z: number, top: number): Prop => ({ kind: "board", from: [z, top], to: [z, 0], posts: false });

/** Parallel bars seen end-on: each rail a small square at ±frontHalf on its upright. */
function frontParallelBars(bars: Extract<Prop, { kind: "parallelBars" }>, shift: number): Prop[] {
  const half = railHalf(bars);
  return [-half, half].flatMap((z) => [endOn(shift + z, bars.y), upright(shift + z, bars.y + PROP_HALF.railEnd)]);
}

/** Parallettes seen end-on: a handle at each hand's z on an upright, with a foot on the floor. */
function frontParallettes(bars: Extract<Prop, { kind: "parallettes" }>, shift: number, hands: HandZ): Prop[] {
  return [hands.near, hands.far].flatMap((z): Prop[] => [
    endOn(shift + z, bars.y),
    upright(shift + z, bars.y + PROP_HALF.railEnd),
    { kind: "bar", y: 0, x1: shift + z - PROP_HALF.parallette, x2: shift + z + PROP_HALF.parallette },
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
      return [around(0, PROP_HALF.bar)];
    case "box":
      return [around(0, prop.frontHalf ?? PROP_HALF.box)];
    case "board":
      return [around(0, PROP_HALF.board)];
    case "parallelBars": {
      const half = railHalf(prop);
      return [around(-half, PROP_HALF.railEnd), around(half, PROP_HALF.railEnd)];
    }
    case "parallettes":
      return [around(hands.near, PROP_HALF.parallette), around(hands.far, PROP_HALF.parallette)];
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
  held: "armNear",
  bellNear: "armNear",
} as const satisfies Partial<Record<FigurePart, FigurePart>>;
type Attached = keyof typeof ATTACHED;
/** A bell handed between the hands or held by the horns: drawn just behind the torso and again over the figure. */
const LAYERED = ["bellBack", "bellFront", "heldBack", "heldFront"] as const satisfies readonly FigurePart[];
type Layered = (typeof LAYERED)[number];
type BodyPart = Exclude<FigurePart, Attached | Layered>;

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

/** Mean of `axis` over a part's points over the loop. */
function depthOf(part: BodyPart, poses: Figure3[], axis: (p: Point3) => number): number {
  const all = poses.flatMap(PART_POINTS[part]);
  return all.reduce((sum, p) => sum + axis(p), 0) / Math.max(1, all.length);
}

const isBodyPart = (part: FigurePart): part is BodyPart => !(part in ATTACHED) && !(LAYERED as readonly FigurePart[]).includes(part);

/**
 * Draw order by depth: parts with the smallest mean `axis` first (furthest from
 * the viewer), attached parts right after their anchor, and a layered bell just
 * behind the torso (spine or head, whichever is further) and again last of all.
 * Front panel: x (larger x is nearer the viewer). Top panel: -y (higher parts on top).
 */
export function depthOrder(spec: DoodleSpec, poses: Figure3[], axis: (p: Point3) => number = (p) => p[0]): FigurePart[] {
  const parts = FIGURE_PARTS.filter(isBodyPart);
  const depth = new Map(parts.map((part) => [part, depthOf(part, poses, axis)]));
  const sorted = [...parts].sort((a, b) => depth.get(a)! - depth.get(b)!);
  const attached = Object.entries(attachedFor(spec)) as [FigurePart, BodyPart][];
  const torso = sorted.findIndex((part) => part === "spine" || part === "head");
  const before = (i: number): FigurePart[] => (i === torso ? ["bellBack", "heldBack"] : []);
  return [...sorted.flatMap((part, i) => [...before(i), part, ...attached.filter(([, anchor]) => anchor === part).map(([extra]) => extra)]), "bellFront", "heldFront"];
}

/**
 * Extras of one panel of a two-view spec (see `PanelExtras`): nose ticks, the
 * stick (its overhang foreshortened by the hands' true distance) or towel, in
 * the front panel layered in front of or behind the torso, and the partner.
 */
export function panelExtras3(spec: DoodleSpec, timeline: Timeline3, panel: View, partner = partner3D(spec, timeline)): PanelExtras {
  const figures = timeline.poses;
  const flat = figures.map((figure) => project(figure, panel));
  const gaps = figures.map((f) => dist3(f.arms.near.end, f.arms.far.end));
  const heldInFront =
    panel === "front" && heldKind(spec)
      ? figures.map((f, i) => {
          const line = heldLine(spec, f, gaps[i]);
          return line.reduce((sum, p) => sum + p[0], 0) / line.length >= (f.chest[0] + f.neck[0]) / 2;
        })
      : undefined;
  const axis = panel === "top" ? (p: Point3) => -p[1] : (p: Point3) => p[0];
  return {
    faces: faceMarks3(spec, figures, panel),
    held: heldLines(spec, flat, gaps),
    heldInFront,
    partner: partner && {
      spec: partner.spec,
      poses: partner.figures.map((figure) => project(figure, panel)),
      faces: partner.faces(panel),
      order: panel === "side" ? undefined : depthOrder(partner.spec, partner.figures, axis),
    },
  };
}

interface DualLayout {
  view: ViewBox;
  /** Added to front-panel x so it sits right of the side panel. */
  frontShift: number;
  side: Solved[];
  front: Solved[];
  extras: { side: PanelExtras; front: PanelExtras };
  labels: { side: number; front: number; y: number };
}

export function dualLayout(spec: DoodleSpec, timeline: Timeline3 = sampleTimeline3(spec)): DualLayout {
  const side = timeline.poses.map((pose) => project(pose, "side"));
  const front = timeline.poses.map((pose) => project(pose, "front"));
  const props = spec.props ?? [];
  const partner = partner3D(spec, timeline);
  const extras = { side: panelExtras3(spec, timeline, "side", partner), front: panelExtras3(spec, timeline, "front", partner) };
  const floorOf = (poses: Solved[], e: PanelExtras): Solved[] => (e.partner ? [...poses, ...e.partner.poses] : poses);
  const sideBox = figureExtent(side, resolveFloors(props, floorOf(side, extras.side)), spec, "side", extraPoints(extras.side));
  const frontBox = figureExtent(front, resolveFloors(frontProps(props, 0, handZ(timeline.poses[0])), floorOf(front, extras.front)), spec, "front", extraPoints(extras.front));
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
    extras,
    labels: { side: sideBox.x + sideBox.w / 2, front: shifted.x + shifted.w / 2, y },
  };
}

export function label(text: string, x: number, y: number): string {
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
  // A bell held by the horns hides behind the head when it is further from the viewer.
  const horns = byTheHorns(spec);
  const inFront = (panel: Panel): boolean[] | undefined => (horns ? bellInFront(spec, timeline.poses, panel) : undefined);
  const { side, front } = layout.extras;
  const floorOf = (poses: Solved[], e: PanelExtras): Solved[] => (e.partner ? [...poses, ...e.partner.poses] : poses);
  const own = (e: PanelExtras) => ({ faces: e.faces, held: e.held, heldInFront: e.heldInFront });
  return svgShell(layout.view, spec.title, [
    highlightSvg(focus, layout.side, timing, identity),
    resolveFloors(props, floorOf(layout.side, side)).map(propSvg).join(""),
    partnerSvg(side, timing, identity, { panel: "side" }),
    figureSvg(spec, layout.side, timing, identity, { panel: "side", bellInFront: inFront("side"), ...own(side) }),
    highlightSvg(focus, layout.front, timing, shift),
    resolveFloors(frontProps(props, layout.frontShift, handZ(timeline.poses[0])), floorOf(layout.front, front), layout.frontShift).map(propSvg).join(""),
    partnerSvg(front, timing, shift, { farOpacity: 1, panel: "front" }),
    // Seen from the front both sides are square on: no faded far side.
    figureSvg(spec, layout.front, timing, shift, { farOpacity: 1, order: depthOrder(spec, timeline.poses), panel: "front", bellInFront: inFront("front"), ...own(front) }),
    label("side", layout.labels.side, layout.labels.y),
    label("front", layout.labels.front, layout.labels.y),
  ]);
}
