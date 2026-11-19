/**
 * Dual-view doodles: the side and front views of one 3D-solved figure, side by
 * side at the same scale on one clock (spec: 2026-11-18-dual-view-doodles-design).
 */
import { FOCUS_BY_ID } from "./focus";
import { project } from "./project";
import {
  bounds,
  figurePoints,
  FIGURE_PARTS,
  figureSvg,
  fmt,
  frame,
  highlightSvg,
  INK,
  PADDING,
  propPoints,
  propSvg,
  STROKE_REACH,
  union,
  type FigurePart,
  type Mapper,
  type ViewBox,
} from "./renderSvg";
import type { DoodleSpec, Prop, Solved } from "./rig";
import { sampleTimeline3, type Figure3, type Point3, type Timeline3 } from "./rig3d";

/** Half-width of a bar and a box seen from the front. */
const FRONT_BAR_HALF = 90;
const FRONT_BOX_HALF = 60;
/** View labels, in rig units (the doodle row is about half scale). */
const LABEL_SIZE = 22;
const LABEL_GAP = 12;
const LABEL_OPACITY = 0.6;

/** A prop as seen from the front (only bar and box are allowed in two views). */
export function frontProp(prop: Prop, shift = 0): Prop | undefined {
  if (prop.kind === "bar") return { kind: "bar", y: prop.y, x1: shift - FRONT_BAR_HALF, x2: shift + FRONT_BAR_HALF };
  if (prop.kind === "box") {
    const half = prop.frontHalf ?? FRONT_BOX_HALF;
    return { kind: "box", x: shift - half, y: prop.y, w: 2 * half, h: prop.h };
  }
  return undefined;
}

/** Front bars this close in height belong to one sloped board drawn as short strokes. */
const BOARD_GAP = 8;
/** Half-width of a bench board (and its legs) seen end-on. */
const BOARD_HALF = 36;
/** Boxes this thin are a bench's posts. */
const POST_WIDTH = 2;

/**
 * All props as seen from the front. A sloped board drawn as a run of short bar
 * strokes would stack into a solid block end-on; it is drawn as its outline
 * (the board's end, from its lowest to its highest point) so the figure on it
 * stays visible, and a thin post as the bench's two legs at the board's edges.
 */
export function frontProps(props: readonly Prop[], shift = 0): Prop[] {
  const bars = props.filter((prop): prop is Extract<Prop, { kind: "bar" }> => prop.kind === "bar");
  const others = props.flatMap((prop): Prop[] => {
    if (prop.kind === "bar") return [];
    if (prop.kind === "box" && prop.w <= POST_WIDTH) {
      return [shift - BOARD_HALF, shift + BOARD_HALF].map((x): Prop => ({ kind: "box", x, y: prop.y, w: 0, h: prop.h }));
    }
    const front = frontProp(prop, shift);
    return front ? [front] : [];
  });
  return [...boardRuns(bars).flatMap((run) => frontBars(run, shift)), ...others];
}

/** Bars grouped into runs of strokes that sit close together in height. */
function boardRuns(bars: readonly Extract<Prop, { kind: "bar" }>[]): Extract<Prop, { kind: "bar" }>[][] {
  const runs: Extract<Prop, { kind: "bar" }>[][] = [];
  for (const bar of [...bars].sort((a, b) => a.y - b.y)) {
    const run = runs[runs.length - 1];
    if (run && bar.y - run[run.length - 1].y <= BOARD_GAP) run.push(bar);
    else runs.push([bar]);
  }
  return runs;
}

/** One run seen from the front: a lone bar stays a bar, a sloped board becomes its outline. */
function frontBars(run: readonly Extract<Prop, { kind: "bar" }>[], shift: number): Prop[] {
  if (run.length < 3) return run.map((bar) => frontProp(bar, shift)).filter((p): p is Prop => !!p);
  const top = run[0].y;
  const bottom = run[run.length - 1].y;
  return [{ kind: "box", x: shift - BOARD_HALF, y: top, w: 2 * BOARD_HALF, h: bottom - top }];
}

/** Mean forward position (x) of a part over the loop: larger x is nearer the front panel's viewer. */
function depthOf(part: FigurePart, poses: Figure3[]): number {
  const points = (f: Figure3): Point3[] => {
    switch (part) {
      case "legFar":
      case "legNear": {
        const l = f.legs[part === "legFar" ? "far" : "near"];
        return [l.root, l.mid, l.joint, l.end];
      }
      case "armFar":
      case "armNear": {
        const a = f.arms[part === "armFar" ? "far" : "near"];
        return [a.root, a.mid, a.joint, a.end];
      }
      case "head":
        return [f.head];
      default:
        return [f.pelvis, f.waist, f.chest, f.neck];
    }
  };
  const all = poses.flatMap(points);
  return all.reduce((sum, p) => sum + p[0], 0) / Math.max(1, all.length);
}

/** Front panel draw order: furthest from the viewer first (the band stays with the near leg). */
export function frontOrder(poses: Figure3[]): FigurePart[] {
  const parts: FigurePart[] = FIGURE_PARTS.filter((part) => part !== "band" && part !== "wheel");
  const sorted = [...parts].sort((a, b) => depthOf(a, poses) - depthOf(b, poses));
  sorted.splice(sorted.indexOf("legNear") + 1, 0, "band");
  return [...sorted, "wheel"];
}

export interface DualLayout {
  view: ViewBox;
  /** Added to front-panel x so it sits right of the side panel. */
  frontShift: number;
  side: Solved[];
  front: Solved[];
  labels: { side: number; front: number; y: number };
}

const allPoints = (poses: Solved[]) => poses.flatMap((pose) => figurePoints(pose).map((p) => p.point));

export function dualLayout(spec: DoodleSpec, timeline: Timeline3 = sampleTimeline3(spec)): DualLayout {
  const side = timeline.poses.map((pose) => project(pose, "side"));
  const front = timeline.poses.map((pose) => project(pose, "front"));
  const props = spec.props ?? [];
  const sideBox = bounds([...allPoints(side), ...props.flatMap(propPoints)], STROKE_REACH);
  const frontBox = bounds([...allPoints(front), ...frontProps(props).flatMap(propPoints)], STROKE_REACH);
  const frontShift = sideBox.x + sideBox.w + 2 * PADDING - frontBox.x;
  const shifted: ViewBox = { ...frontBox, x: frontBox.x + frontShift };
  const figures = union(sideBox, shifted);
  const y = figures.y + figures.h + LABEL_GAP + LABEL_SIZE;
  const drawing = union(figures, { x: figures.x, y: figures.y, w: figures.w, h: y + LABEL_SIZE * 0.3 - figures.y });
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
  const timing = `dur="${fmt(timeline.duration)}s" repeatCount="indefinite" calcMode="linear" keyTimes="${timeline.keyTimes
    .map((value) => value.toFixed(4))
    .join(";")}"`;
  const layout = dualLayout(spec, timeline);
  const { view: box, frontShift } = layout;
  const focus = FOCUS_BY_ID[spec.id];
  const shift: Mapper = ([x, y]) => [x + frontShift, y];
  const identity: Mapper = (point) => point;
  const props = spec.props ?? [];
  const frontSpec: DoodleSpec = { ...spec, view: "front" };
  const view = [box.x, box.y, box.w, box.h].map(fmt).join(" ");
  const layers = [
    highlightSvg(focus, layout.side, timing, identity),
    props.map(propSvg).join(""),
    figureSvg(spec, layout.side, timing, identity, 1),
    highlightSvg(focus, layout.front, timing, shift),
    frontProps(props, frontShift).map(propSvg).join(""),
    figureSvg(frontSpec, layout.front, timing, shift, 1, frontOrder(timeline.poses)),
    label("side", layout.labels.side, layout.labels.y),
    label("front", layout.labels.front, layout.labels.y),
  ]
    .filter(Boolean)
    .join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view}" role="img" aria-label="${spec.title}">
<title>${spec.title}</title>
<rect x="${fmt(box.x)}" y="${fmt(box.y)}" width="${fmt(box.w)}" height="${fmt(box.h)}" style="fill:var(--doodle-backdrop, #000)"/>
<g fill="none" style="stroke:${INK}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
${layers}
</g>
</svg>
`;
}
