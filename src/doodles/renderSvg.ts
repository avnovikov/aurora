import { FOCUS_BY_ID, type Focus, type Segment } from "./focus";
import { dualLayout, renderDualSvg } from "./renderDual";
import { sampleTimeline, SEGMENTS, type DoodleSpec, type Point, type Prop, type Side, type Solved } from "./rig";

/**
 * Colours are CSS custom properties so an inlined doodle follows the active
 * palette; the fallbacks are the standalone look (light ink on black).
 */
export const INK = "var(--doodle-ink, #f4f1ea)";
/** Fills that hide lines behind them (head, grips, inset): whatever the doodle sits on. */
const PAPER = "var(--doodle-paper, #000)";
const BACKDROP = "var(--doodle-backdrop, #000)";
const STROKE_WIDTH = 7;
const FAR_OPACITY = 0.5;
/** App accent (brass); coral is reserved for pulse and pain. */
const FOCUS_COLOUR = "var(--doodle-focus, #c4a574)";
const HIGHLIGHT_WIDTH = 20;
const HIGHLIGHT_OPACITY = 0.45;
/** Inset diameter as a share of the main view height. */
const INSET_SHARE = 0.62;

type Path = (pose: Solved) => Point[];

export const fmt = (value: number): string => (Math.round(value * 10) / 10).toString();
const pointsAttr = (points: Point[]): string => points.map((p) => `${fmt(p[0])},${fmt(p[1])}`).join(" ");

/** SMIL timing for one loop over the sampled poses (shared by every animated element). */
export function timingAttr(timeline: { duration: number; keyTimes: number[] }): string {
  return `dur="${fmt(timeline.duration)}s" repeatCount="indefinite" calcMode="linear" keyTimes="${timeline.keyTimes
    .map((value) => value.toFixed(4))
    .join(";")}"`;
}

function animate(attribute: string, values: string[], timing: string): string {
  return `<animate attributeName="${attribute}" values="${values.join(";")}" ${timing}/>`;
}

/** Maps rig coordinates into the drawing (identity for the main figure, zoom for the inset). */
export type Mapper = (point: Point) => Point;
export const identity: Mapper = (point) => point;

/** A polyline through joints, its `points` animated over the sampled poses. */
function animatedPolyline(path: Path, poses: Solved[], timing: string, opacity = 1, map: Mapper = identity): string {
  const frames = poses.map((pose) => pointsAttr(path(pose).map(map)));
  const fade = opacity < 1 ? ` opacity="${opacity}"` : "";
  return `<polyline points="${frames[0]}"${fade}>${animate("points", frames, timing)}</polyline>`;
}

/** Where the neck line meets the head circle. */
export function headEdge(pose: Solved): Point {
  const dx = pose.head[0] - pose.neck[0];
  const dy = pose.head[1] - pose.neck[1];
  const k = Math.max(0, 1 - SEGMENTS.headRadius / Math.hypot(dx, dy));
  return [pose.neck[0] + dx * k, pose.neck[1] + dy * k];
}

const spinePath: Path = (p) => [p.pelvis, p.waist, p.chest, p.neck, headEdge(p)];
const armPath = (side: Side): Path => (p) => [p.chest, p.arms[side].root, p.arms[side].mid, p.arms[side].joint, p.arms[side].end];
const legPath = (side: Side): Path => (p) => [p.pelvis, p.legs[side].root, p.legs[side].mid, p.legs[side].joint, p.legs[side].end];

const onThigh = (p: Solved, side: Side, share: number): Point => {
  const { root, mid } = p.legs[side];
  return [root[0] + (mid[0] - root[0]) * share, root[1] + (mid[1] - root[1]) * share];
};

/** A band looped round both thighs, `share` of the way from hip to knee. */
const bandPath = (share: number): Path => (p) => [onThigh(p, "near", share), onThigh(p, "far", share)];

/** Band stroke: thinner than the limbs, in the accent colour so it reads as gear, not a bone. */
const BAND_WIDTH = 5;

/** A filled circle of radius `r` moving through `centres`. */
function animatedCircle(centres: Point[], r: number, fill: string, timing: string): string {
  const cx = animate("cx", centres.map((p) => fmt(p[0])), timing);
  const cy = animate("cy", centres.map((p) => fmt(p[1])), timing);
  return `<circle cx="${fmt(centres[0][0])}" cy="${fmt(centres[0][1])}" r="${fmt(r)}" style="fill:${fill}">${cx}${cy}</circle>`;
}

/** An ab wheel centred on the near hand (drawn over the near arm, like a held object). */
function wheelSvg(spec: DoodleSpec, poses: Solved[], timing: string, map: Mapper, scale: number): string {
  if (spec.wheel === undefined) return "";
  const centres = poses.map((pose) => map(pose.arms.near.end));
  // A filled hub inside the ring, so the wheel never reads as a second head.
  return animatedCircle(centres, spec.wheel * scale, PAPER, timing) + animatedCircle(centres, WHEEL_HUB * scale, INK, timing);
}

/** Radius of the ab wheel's hub dot. */
const WHEEL_HUB = 3;

function bandSvg(spec: DoodleSpec, poses: Solved[], timing: string, map: Mapper): string {
  if (spec.band === undefined) return "";
  return `<g style="stroke:${FOCUS_COLOUR}" stroke-width="${BAND_WIDTH}">${animatedPolyline(bandPath(spec.band), poses, timing, 1, map)}</g>`;
}

/** A board's posts stand this far in from each end. */
export const BOARD_POST_INSET = 16;

/** Point on the board's line at `x`. */
function onBoard(from: Point, to: Point, x: number): Point {
  return [x, Math.round((from[1] + ((to[1] - from[1]) * (x - from[0])) / (to[0] - from[0])) * 10) / 10];
}

/** Segments a prop is drawn with (also used by the validator for crossings). */
export function propSegments(prop: Prop): [Point, Point][] {
  switch (prop.kind) {
    case "floor":
      // Unresolved, a floor draws and blocks nothing (see resolveFloors).
      return [];
    case "bar":
      return [[[prop.x1, prop.y], [prop.x2, prop.y]]];
    case "box": {
      const { x, y, w, h } = prop;
      return [
        [[x, y], [x + w, y]],
        [[x + w, y], [x + w, y + h]],
        [[x + w, y + h], [x, y + h]],
        [[x, y + h], [x, y]],
      ];
    }
    case "board": {
      const plank: [Point, Point] = [prop.from, prop.to];
      if (prop.posts === false) return [plank];
      const step = Math.sign(prop.to[0] - prop.from[0]) * BOARD_POST_INSET;
      const posts = [prop.from[0] + step, prop.to[0] - step].map((x): [Point, Point] => {
        const top = onBoard(prop.from, prop.to, x);
        return [top, [x, 0]];
      });
      return [plank, ...posts];
    }
    case "parallelBars":
      return [
        [[prop.x1, prop.y], [prop.x2, prop.y]],
        [[prop.x1 + 12, prop.y], [prop.x1 + 12, 0]],
        [[prop.x2 - 12, prop.y], [prop.x2 - 12, 0]],
      ];
    case "parallettes":
      return prop.xs.flatMap((x): [Point, Point][] => [
        [[x - 22, prop.y], [x + 22, prop.y]],
        [[x - 16, prop.y], [x - 16, 0]],
        [[x + 16, prop.y], [x + 16, 0]],
      ]);
  }
}

/** Grip ellipse radii on a bar. */
const GRIP_RX = 8;
const GRIP_RY = 11;

export function propSvg(prop: Prop): string {
  if (prop.kind === "box") {
    return `<rect x="${prop.x}" y="${prop.y}" width="${prop.w}" height="${prop.h}" fill="none"/>`;
  }
  const lines = propSegments(prop)
    .map(([a, b]) => `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`)
    .join("");
  const grips =
    prop.kind === "bar"
      ? (prop.grips ?? []).map((x) => `<ellipse cx="${x}" cy="${prop.y}" rx="${GRIP_RX}" ry="${GRIP_RY}" style="fill:${PAPER}"/>`).join("")
      : "";
  return lines + grips;
}

/** Even margin between the drawing (strokes included) and the viewBox edge. */
export const PADDING = 24;
/** Widest half-stroke drawn (the focus highlight), so caps and joins stay inside. */
export const STROKE_REACH = HIGHLIGHT_WIDTH / 2;
/** Tall drawings are widened (centred) to at least square, so they are not slivers. */
const MIN_ASPECT = 1;
/** The inset is sized against the figure framed at this aspect. */
const INSET_BASIS_ASPECT = 16 / 10;
/** Inset ring stroke width. */
const RING_WIDTH = 4;
/** Inset label font size, as a share of the ring radius. */
const LABEL_SHARE = 0.16;
/** Gap from the ring to the label baseline, in label heights. */
const LABEL_GAP = 1.2;
/** How far descenders fall below the baseline, in label heights. */
const LABEL_DESCENT = 0.3;

/** Every point a prop is drawn through, grips' top and bottom included. */
export function propPoints(prop: Prop): Point[] {
  const grips =
    prop.kind === "bar"
      ? (prop.grips ?? []).flatMap((x): Point[] => [
          [x, prop.y - GRIP_RY],
          [x, prop.y + GRIP_RY],
        ])
      : [];
  return [...propSegments(prop).flat(), ...grips];
}

/** How far a floor line runs past the figure (and props on the floor) at each end. */
export const FLOOR_MARGIN = 30;

/**
 * Props ready to draw: each `floor` becomes a line at y = 0 under everything
 * the figure reaches over the loop, plus any prop standing on the floor.
 */
export function resolveFloors(props: readonly Prop[], poses: Solved[], dx = 0): Prop[] {
  if (!props.some((prop) => prop.kind === "floor")) return [...props];
  const xs = [
    // `dx` moves the figure as the panel is drawn (the front panel sits right of the side panel).
    ...poses.flatMap((pose) => figurePoints(pose).map((p) => p.point[0] + dx)),
    ...props.flatMap(propPoints).filter(([, y]) => Math.abs(y) < 1).map(([x]) => x),
  ];
  const x1 = Math.floor(Math.min(...xs) - FLOOR_MARGIN);
  const x2 = Math.ceil(Math.max(...xs) + FLOOR_MARGIN);
  return props.map((prop): Prop => (prop.kind === "floor" ? { kind: "bar", y: 0, x1, x2 } : prop));
}

/** Every drawn figure point (joints plus the head circle's extent). */
export function figurePoints(pose: Solved): { name: string; point: Point }[] {
  const r = SEGMENTS.headRadius;
  const named: { name: string; point: Point }[] = [
    { name: "pelvis", point: pose.pelvis },
    { name: "waist", point: pose.waist },
    { name: "chest", point: pose.chest },
    { name: "neck", point: pose.neck },
    { name: "head.top", point: [pose.head[0], pose.head[1] - r] },
    { name: "head.bottom", point: [pose.head[0], pose.head[1] + r] },
    { name: "head.left", point: [pose.head[0] - r, pose.head[1]] },
    { name: "head.right", point: [pose.head[0] + r, pose.head[1]] },
  ];
  for (const side of ["near", "far"] as Side[]) {
    const arm = pose.arms[side];
    const leg = pose.legs[side];
    named.push(
      { name: `shoulder.${side}`, point: arm.root },
      { name: `elbow.${side}`, point: arm.mid },
      { name: `wrist.${side}`, point: arm.joint },
      { name: `hand.${side}`, point: arm.end },
      { name: `hip.${side}`, point: leg.root },
      { name: `knee.${side}`, point: leg.mid },
      { name: `ankle.${side}`, point: leg.joint },
      { name: `toe.${side}`, point: leg.end },
    );
  }
  return named;
}

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The box around `points`, grown by `grow` on every side. */
export function bounds(points: Point[], grow = 0): ViewBox {
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { x: minX - grow, y: minY - grow, w: maxX - minX + 2 * grow, h: maxY - minY + 2 * grow };
}

export function union(a: ViewBox, b: ViewBox): ViewBox {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

/** The drawing centred with an even PADDING, widened to MIN_ASPECT when tall. */
export function frame(drawing: ViewBox): ViewBox {
  const h = drawing.h + 2 * PADDING;
  const w = Math.max(drawing.w + 2 * PADDING, h * MIN_ASPECT);
  return { x: drawing.x + drawing.w / 2 - w / 2, y: drawing.y - PADDING, w, h };
}

/** Everything the figure, its ab wheel (radius `r`) and props touch over the loop (no inset). */
export function figureExtent(poses: Solved[], props: readonly Prop[], r: number | undefined): ViewBox {
  return bounds([
    ...poses.flatMap((pose) => figurePoints(pose).map((p) => p.point)),
    ...props.flatMap(propPoints),
    // The ab wheel round the near hand.
    ...(r === undefined
      ? []
      : poses.flatMap(({ arms: { near: { end: [x, y] } } }): Point[] => [[x - r, y - r], [x + r, y + r]])),
  ], STROKE_REACH);
}

interface Layout {
  view: ViewBox;
  focus?: Focus;
  inset?: Inset;
}

function layoutFor(spec: DoodleSpec, poses: Solved[]): Layout {
  const figure = figureExtent(poses, resolveFloors(spec.props ?? [], poses), spec.wheel);
  const focus = FOCUS_BY_ID[spec.id];
  const inset = insetFor(focus, poses, figure);
  const drawing = inset ? union(figure, insetExtent(inset, focus)) : figure;
  return { view: frame(drawing), focus, inset };
}

export function specViewBox(spec: DoodleSpec, poses?: Solved[]): ViewBox {
  if (spec.views) return dualLayout(spec).view;
  poses ??= sampleTimeline(spec).poses;
  return layoutFor(spec, poses).view;
}

/** Joints a highlighted segment runs through. */
function segmentPath(segment: Segment): Path {
  const [part, side] = segment.split(".") as [string, Side | undefined];
  const s = side ?? "near";
  const paths: Record<string, Path> = {
    upperArm: (p) => [p.arms[s].root, p.arms[s].mid],
    forearm: (p) => [p.arms[s].mid, p.arms[s].joint],
    hand: (p) => [p.arms[s].joint, p.arms[s].end],
    shoulder: (p) => [p.chest, p.arms[s].root],
    thigh: (p) => [p.legs[s].root, p.legs[s].mid],
    shin: (p) => [p.legs[s].mid, p.legs[s].joint],
    foot: (p) => [p.legs[s].joint, p.legs[s].end],
    lumbar: (p) => [p.pelvis, p.waist],
    thoracic: (p) => [p.waist, p.chest],
    neck: (p) => [p.chest, p.neck],
    pelvis: (p) => [p.legs.near.root, p.pelvis, p.legs.far.root],
  };
  return paths[part];
}

export function highlightSvg(focus: Focus | undefined, poses: Solved[], timing: string, map: Mapper): string {
  if (!focus || focus.highlight.length === 0) return "";
  const lines = focus.highlight.map((segment) => animatedPolyline(segmentPath(segment), poses, timing, 1, map)).join("");
  return `<g style="stroke:${FOCUS_COLOUR}" stroke-width="${HIGHLIGHT_WIDTH}" opacity="${HIGHLIGHT_OPACITY}">${lines}</g>`;
}

/** Drawable parts of the figure, in the side view's back-to-front order. */
export const FIGURE_PARTS = ["legFar", "armFar", "spine", "head", "legNear", "band", "armNear", "wheel"] as const;
export type FigurePart = (typeof FIGURE_PARTS)[number];

interface FigureOptions {
  /** Keeps the head (and wheel) in proportion under a zoom. */
  headScale?: number;
  /** Opacity of the far arm and leg (1 when both sides are seen square on). */
  farOpacity?: number;
  /** Back-to-front order (the front panel sorts by depth). */
  order?: readonly FigurePart[];
}

/** The far side at full strength in a front view, faded behind the near side otherwise. */
const farOpacityOf = (spec: DoodleSpec): number => (spec.view === "front" ? 1 : FAR_OPACITY);

/** The figure (far side first by default), drawn through `map`. */
export function figureSvg(
  spec: DoodleSpec,
  poses: Solved[],
  timing: string,
  map: Mapper,
  { headScale = 1, farOpacity = FAR_OPACITY, order = FIGURE_PARTS }: FigureOptions = {},
): string {
  const parts: Record<FigurePart, () => string> = {
    legFar: () => animatedPolyline(legPath("far"), poses, timing, farOpacity, map),
    armFar: () => animatedPolyline(armPath("far"), poses, timing, farOpacity, map),
    spine: () => animatedPolyline(spinePath, poses, timing, 1, map),
    head: () => animatedCircle(poses.map((pose) => map(pose.head)), SEGMENTS.headRadius * headScale, PAPER, timing),
    legNear: () => animatedPolyline(legPath("near"), poses, timing, 1, map),
    band: () => bandSvg(spec, poses, timing, map),
    armNear: () => animatedPolyline(armPath("near"), poses, timing, 1, map),
    wheel: () => wheelSvg(spec, poses, timing, map, headScale),
  };
  return order.map((part) => parts[part]()).join("");
}

interface Inset {
  cx: number;
  cy: number;
  r: number;
  zoom: number;
  map: Mapper;
}

/** Inset to the right of the figure, zoomed on the focus joints' range over the loop. */
function insetFor(focus: Focus | undefined, poses: Solved[], figure: ViewBox): Inset | undefined {
  if (!focus?.zoom) return undefined;
  const points = poses.flatMap((pose) =>
    figurePoints(pose)
      .filter((p) => focus.joints.includes(p.name))
      .map((p) => p.point),
  );
  if (points.length === 0) return undefined;
  const area = bounds(points);
  const centre: Point = [area.x + area.w / 2, area.y + area.h / 2];
  const extent = Math.max(area.w, area.h) / 2 + (focus.margin ?? 30);
  const r = (Math.max(figure.h, figure.w / INSET_BASIS_ASPECT) * INSET_SHARE) / 2;
  // Zoom in as asked, but never so far that the focus area leaves the circle.
  const zoom = Math.min(focus.zoom, (r * 0.85) / extent);
  const cx = figure.x + figure.w + PADDING + r;
  const cy = figure.y + figure.h / 2;
  const map: Mapper = ([x, y]) => [cx + (x - centre[0]) * zoom, cy + (y - centre[1]) * zoom];
  return { cx, cy, r, zoom, map };
}

const labelSize = (r: number, focus?: Focus): number => r * LABEL_SHARE * (focus?.labelScale ?? 1);
const labelBaseline = (inset: Inset, focus?: Focus): number =>
  inset.cy + inset.r + labelSize(inset.r, focus) * LABEL_GAP;

/** The inset ring plus, below it, its label (descenders included). */
function insetExtent(inset: Inset, focus: Focus | undefined): ViewBox {
  const reach = inset.r + RING_WIDTH / 2;
  const bottom = focus?.label
    ? labelBaseline(inset, focus) + labelSize(inset.r, focus) * LABEL_DESCENT
    : inset.cy + reach;
  return { x: inset.cx - reach, y: inset.cy - reach, w: 2 * reach, h: bottom - (inset.cy - reach) };
}

function insetSvg(spec: DoodleSpec, focus: Focus, inset: Inset, poses: Solved[], timing: string): string {
  const { cx, cy, r, zoom, map } = inset;
  // Unique per doodle: several SVGs inlined on one page must not share a clip.
  const clipId = `focus-${spec.slug}`;
  const fontSize = labelSize(r, focus);
  const floorY = map([0, 0])[1];
  const floor = focus.floor
    ? `<line x1="${fmt(cx - r)}" y1="${fmt(floorY)}" x2="${fmt(cx + r)}" y2="${fmt(floorY)}" opacity="${FAR_OPACITY}" stroke-width="${RING_WIDTH}"/>\n`
    : "";
  const label = focus.label
    ? `<text x="${fmt(cx)}" y="${fmt(labelBaseline(inset, focus))}" style="fill:${FOCUS_COLOUR}" stroke="none" font-family="system-ui, sans-serif" font-size="${fmt(fontSize)}" text-anchor="middle">${focus.label}</text>`
    : "";
  return `<clipPath id="${clipId}"><circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r)}"/></clipPath>
<g clip-path="url(#${clipId})">
<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r)}" style="fill:${PAPER}" stroke="none"/>
${floor}${highlightSvg(focus, poses, timing, map)}
${figureSvg(spec, poses, timing, map, { headScale: zoom, farOpacity: farOpacityOf(spec) })}
</g>
<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r)}" style="stroke:${FOCUS_COLOUR}" stroke-width="${RING_WIDTH}"/>
${label}`;
}

/** Animated SVG (SMIL), loops forever; plays standalone, in an <img>, or inlined (doodleMarkup). */
export function renderDoodleSvg(spec: DoodleSpec): string {
  if (spec.views) return renderDualSvg(spec);
  const timeline = sampleTimeline(spec);
  const { poses } = timeline;
  const timing = timingAttr(timeline);
  const { view, focus, inset } = layoutFor(spec, poses);
  const props = resolveFloors(spec.props ?? [], poses).map(propSvg).join("");
  return svgShell(view, spec.title, [
    highlightSvg(focus, poses, timing, identity),
    `${props}\n${figureSvg(spec, poses, timing, identity, { farOpacity: farOpacityOf(spec) })}`,
    focus && inset ? insetSvg(spec, focus, inset, poses, timing) : "",
  ]);
}

/** The standalone SVG document: backdrop, then the non-empty `layers` in the shared stroke style. */
export function svgShell(box: ViewBox, title: string, layers: string[]): string {
  const view = [box.x, box.y, box.w, box.h].map(fmt).join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view}" role="img" aria-label="${title}">
<title>${title}</title>
<rect x="${fmt(box.x)}" y="${fmt(box.y)}" width="${fmt(box.w)}" height="${fmt(box.h)}" style="fill:${BACKDROP}"/>
<g fill="none" style="stroke:${INK}" stroke-width="${STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round">
${layers.filter(Boolean).join("\n")}
</g>
</svg>
`;
}
