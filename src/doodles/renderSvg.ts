import { FOCUS_BY_ID, type Focus, type Segment } from "./focus";
import { sampleTimeline, SEGMENTS, type DoodleSpec, type Point, type Prop, type Side, type Solved } from "./rig";

/**
 * Colours are CSS custom properties so an inlined doodle follows the active
 * palette; the fallbacks are the standalone look (light ink on black).
 */
const INK = "var(--doodle-ink, #f4f1ea)";
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

const fmt = (value: number): string => (Math.round(value * 10) / 10).toString();
const pointsAttr = (points: Point[]): string => points.map((p) => `${fmt(p[0])},${fmt(p[1])}`).join(" ");

function animate(attribute: string, values: string[], timing: string): string {
  return `<animate attributeName="${attribute}" values="${values.join(";")}" ${timing}/>`;
}

/** A polyline through joints, its `points` animated over the sampled poses. */
/** Maps rig coordinates into the drawing (identity for the main figure, zoom for the inset). */
type Mapper = (point: Point) => Point;
const identity: Mapper = (point) => point;

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

function bandSvg(spec: DoodleSpec, poses: Solved[], timing: string, map: Mapper): string {
  if (spec.band === undefined) return "";
  return `<g style="stroke:${FOCUS_COLOUR}" stroke-width="${BAND_WIDTH}">${animatedPolyline(bandPath(spec.band), poses, timing, 1, map)}</g>`;
}

/** Segments a prop is drawn with (also used by the validator for crossings). */
export function propSegments(prop: Prop): [Point, Point][] {
  switch (prop.kind) {
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

function propSvg(prop: Prop): string {
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
const PADDING = 24;
/** Widest half-stroke drawn (the focus highlight), so caps and joins stay inside. */
const STROKE_REACH = HIGHLIGHT_WIDTH / 2;
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
function propPoints(prop: Prop): Point[] {
  const grips =
    prop.kind === "bar"
      ? (prop.grips ?? []).flatMap((x): Point[] => [
          [x, prop.y - GRIP_RY],
          [x, prop.y + GRIP_RY],
        ])
      : [];
  return [...propSegments(prop).flat(), ...grips];
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
function bounds(points: Point[], grow = 0): ViewBox {
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { x: minX - grow, y: minY - grow, w: maxX - minX + 2 * grow, h: maxY - minY + 2 * grow };
}

function union(a: ViewBox, b: ViewBox): ViewBox {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

/** The drawing centred with an even PADDING, widened to MIN_ASPECT when tall. */
function frame(drawing: ViewBox): ViewBox {
  const h = drawing.h + 2 * PADDING;
  const w = Math.max(drawing.w + 2 * PADDING, h * MIN_ASPECT);
  return { x: drawing.x + drawing.w / 2 - w / 2, y: drawing.y - PADDING, w, h };
}

/** Everything the figure and props touch over the loop (no inset). */
function figureExtent(spec: DoodleSpec, poses: Solved[]): ViewBox {
  return bounds([
    ...poses.flatMap((pose) => figurePoints(pose).map((p) => p.point)),
    ...(spec.props ?? []).flatMap(propPoints),
  ], STROKE_REACH);
}

interface Layout {
  view: ViewBox;
  focus?: Focus;
  inset?: Inset;
}

function layoutFor(spec: DoodleSpec, poses: Solved[]): Layout {
  const figure = figureExtent(spec, poses);
  const focus = FOCUS_BY_ID[spec.id];
  const inset = insetFor(focus, poses, figure);
  const drawing = inset ? union(figure, insetExtent(inset, focus?.label)) : figure;
  return { view: frame(drawing), focus, inset };
}

export function specViewBox(spec: DoodleSpec, poses: Solved[] = sampleTimeline(spec).poses): ViewBox {
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

function highlightSvg(focus: Focus | undefined, poses: Solved[], timing: string, map: Mapper): string {
  if (!focus || focus.highlight.length === 0) return "";
  const lines = focus.highlight.map((segment) => animatedPolyline(segmentPath(segment), poses, timing, 1, map)).join("");
  return `<g style="stroke:${FOCUS_COLOUR}" stroke-width="${HIGHLIGHT_WIDTH}" opacity="${HIGHLIGHT_OPACITY}">${lines}</g>`;
}

/** The figure (far side first), drawn through `map`; `headScale` keeps the head in proportion. */
function figureSvg(spec: DoodleSpec, poses: Solved[], timing: string, map: Mapper, headScale: number): string {
  const farOpacity = spec.view === "front" ? 1 : FAR_OPACITY;
  const head = poses.map((pose) => map(pose.head));
  return [
    animatedPolyline(legPath("far"), poses, timing, farOpacity, map),
    animatedPolyline(armPath("far"), poses, timing, farOpacity, map),
    animatedPolyline(spinePath, poses, timing, 1, map),
    `<circle cx="${fmt(head[0][0])}" cy="${fmt(head[0][1])}" r="${fmt(SEGMENTS.headRadius * headScale)}" style="fill:${PAPER}">${animate(
      "cx",
      head.map((p) => fmt(p[0])),
      timing,
    )}${animate(
      "cy",
      head.map((p) => fmt(p[1])),
      timing,
    )}</circle>`,
    animatedPolyline(legPath("near"), poses, timing, 1, map),
    bandSvg(spec, poses, timing, map),
    animatedPolyline(armPath("near"), poses, timing, 1, map),
  ].join("");
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
  const extent = Math.max(area.w, area.h) / 2 + 30;
  const r = (Math.max(figure.h, figure.w / INSET_BASIS_ASPECT) * INSET_SHARE) / 2;
  // Zoom in as asked, but never so far that the focus area leaves the circle.
  const zoom = Math.min(focus.zoom, (r * 0.85) / extent);
  const cx = figure.x + figure.w + PADDING + r;
  const cy = figure.y + figure.h / 2;
  const map: Mapper = ([x, y]) => [cx + (x - centre[0]) * zoom, cy + (y - centre[1]) * zoom];
  return { cx, cy, r, zoom, map };
}

const labelSize = (r: number): number => r * LABEL_SHARE;
const labelBaseline = (inset: Inset): number => inset.cy + inset.r + labelSize(inset.r) * LABEL_GAP;

/** The inset ring plus, below it, its label (descenders included). */
function insetExtent(inset: Inset, label: string | undefined): ViewBox {
  const reach = inset.r + RING_WIDTH / 2;
  const bottom = label ? labelBaseline(inset) + labelSize(inset.r) * LABEL_DESCENT : inset.cy + reach;
  return { x: inset.cx - reach, y: inset.cy - reach, w: 2 * reach, h: bottom - (inset.cy - reach) };
}

function insetSvg(spec: DoodleSpec, focus: Focus, inset: Inset, poses: Solved[], timing: string): string {
  const { cx, cy, r, zoom, map } = inset;
  // Unique per doodle: several SVGs inlined on one page must not share a clip.
  const clipId = `focus-${spec.slug}`;
  const fontSize = labelSize(r);
  const label = focus.label
    ? `<text x="${fmt(cx)}" y="${fmt(labelBaseline(inset))}" style="fill:${FOCUS_COLOUR}" stroke="none" font-family="system-ui, sans-serif" font-size="${fmt(fontSize)}" text-anchor="middle">${focus.label}</text>`
    : "";
  return `<clipPath id="${clipId}"><circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r)}"/></clipPath>
<g clip-path="url(#${clipId})">
<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r)}" style="fill:${PAPER}" stroke="none"/>
${highlightSvg(focus, poses, timing, map)}
${figureSvg(spec, poses, timing, map, zoom)}
</g>
<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r)}" style="stroke:${FOCUS_COLOUR}" stroke-width="${RING_WIDTH}"/>
${label}`;
}

/** Animated SVG (SMIL), loops forever; plays standalone, in an <img>, or inlined (doodleMarkup). */
export function renderDoodleSvg(spec: DoodleSpec): string {
  const timeline = sampleTimeline(spec);
  const { poses } = timeline;
  const timing = `dur="${fmt(timeline.duration)}s" repeatCount="indefinite" calcMode="linear" keyTimes="${timeline.keyTimes
    .map((value) => value.toFixed(4))
    .join(";")}"`;
  const { view: box, focus, inset } = layoutFor(spec, poses);
  const view = [box.x, box.y, box.w, box.h].map(fmt).join(" ");
  const props = (spec.props ?? []).map(propSvg).join("");
  const layers = [
    highlightSvg(focus, poses, timing, identity),
    `${props}\n${figureSvg(spec, poses, timing, identity, 1)}`,
    focus && inset ? insetSvg(spec, focus, inset, poses, timing) : "",
  ]
    .filter(Boolean)
    .join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view}" role="img" aria-label="${spec.title}">
<title>${spec.title}</title>
<rect x="${fmt(box.x)}" y="${fmt(box.y)}" width="${fmt(box.w)}" height="${fmt(box.h)}" style="fill:${BACKDROP}"/>
<g fill="none" style="stroke:${INK}" stroke-width="${STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round">
${layers}
</g>
</svg>
`;
}
