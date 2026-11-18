/**
 * Dual-view doodles: the side and front views of one 3D-solved figure, side by
 * side at the same scale on one clock (spec: 2026-11-18-dual-view-doodles-design).
 */
import { FOCUS_BY_ID } from "./focus";
import { project } from "./project";
import {
  bounds,
  figurePoints,
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
  type Mapper,
  type ViewBox,
} from "./renderSvg";
import type { DoodleSpec, Prop, Solved } from "./rig";
import { sampleTimeline3, type Timeline3 } from "./rig3d";

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
  if (prop.kind === "box") return { kind: "box", x: shift - FRONT_BOX_HALF, y: prop.y, w: 2 * FRONT_BOX_HALF, h: prop.h };
  return undefined;
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
  const frontProps = props.map((prop) => frontProp(prop)).filter((p): p is Prop => !!p);
  const frontBox = bounds([...allPoints(front), ...frontProps.flatMap(propPoints)], STROKE_REACH);
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
    props
      .map((prop) => frontProp(prop, frontShift))
      .filter((p): p is Prop => !!p)
      .map(propSvg)
      .join(""),
    figureSvg(frontSpec, layout.front, timing, shift, 1),
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
