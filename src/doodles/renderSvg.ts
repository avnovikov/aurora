import { FOCUS_BY_ID, type Focus, type Segment } from "./focus";
import { sampleTimeline, SEGMENTS, type DoodleSpec, type Point, type Prop, type Side, type Solved } from "./rig";

const STROKE = "#f4f1ea";
const STROKE_WIDTH = 7;
const FAR_OPACITY = 0.5;
/** App accent (brass); coral is reserved for pulse and pain. */
const FOCUS_COLOUR = "#c4a574";
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

function propSvg(prop: Prop): string {
  if (prop.kind === "box") {
    return `<rect x="${prop.x}" y="${prop.y}" width="${prop.w}" height="${prop.h}" fill="none"/>`;
  }
  const lines = propSegments(prop)
    .map(([a, b]) => `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`)
    .join("");
  const grips =
    prop.kind === "bar"
      ? (prop.grips ?? []).map((x) => `<ellipse cx="${x}" cy="${prop.y}" rx="8" ry="11" fill="#000"/>`).join("")
      : "";
  return lines + grips;
}

const ASPECT = 16 / 10;
const PADDING = 36;

function propPoints(prop: Prop): Point[] {
  return propSegments(prop).flat();
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

/** Tight 16:10 box around everything the figure and props touch over the loop. */
function fitViewBox(points: Point[]): ViewBox {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  let x = Math.min(...xs) - PADDING;
  let y = Math.min(...ys) - PADDING;
  let w = Math.max(...xs) + PADDING - x;
  let h = Math.max(...ys, 0) + PADDING - y;
  if (w / h < ASPECT) {
    x -= (h * ASPECT - w) / 2;
    w = h * ASPECT;
  } else {
    y -= (w / ASPECT - h) / 2;
    h = w / ASPECT;
  }
  return { x, y, w, h };
}

export function specViewBox(spec: DoodleSpec, poses: Solved[] = sampleTimeline(spec).poses): ViewBox {
  return fitViewBox([
    ...poses.flatMap((pose) => figurePoints(pose).map((p) => p.point)),
    ...(spec.props ?? []).flatMap(propPoints),
  ]);
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
  return `<g stroke="${FOCUS_COLOUR}" stroke-width="${HIGHLIGHT_WIDTH}" opacity="${HIGHLIGHT_OPACITY}">${lines}</g>`;
}

/** The figure (far side first), drawn through `map`; `headScale` keeps the head in proportion. */
function figureSvg(spec: DoodleSpec, poses: Solved[], timing: string, map: Mapper, headScale: number): string {
  const farOpacity = spec.view === "front" ? 1 : FAR_OPACITY;
  const head = poses.map((pose) => map(pose.head));
  return [
    animatedPolyline(legPath("far"), poses, timing, farOpacity, map),
    animatedPolyline(armPath("far"), poses, timing, farOpacity, map),
    animatedPolyline(spinePath, poses, timing, 1, map),
    `<circle cx="${fmt(head[0][0])}" cy="${fmt(head[0][1])}" r="${fmt(SEGMENTS.headRadius * headScale)}" fill="#000">${animate(
      "cx",
      head.map((p) => fmt(p[0])),
      timing,
    )}${animate(
      "cy",
      head.map((p) => fmt(p[1])),
      timing,
    )}</circle>`,
    animatedPolyline(legPath("near"), poses, timing, 1, map),
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

/** Inset to the right of the main view, centred on the focus joints' range over the loop. */
function insetFor(focus: Focus | undefined, poses: Solved[], box: ViewBox): Inset | undefined {
  if (!focus?.zoom) return undefined;
  const points = poses.flatMap((pose) =>
    figurePoints(pose)
      .filter((p) => focus.joints.includes(p.name))
      .map((p) => p.point),
  );
  if (points.length === 0) return undefined;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const centre: Point = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  const extent = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2 + 30;
  const r = (box.h * INSET_SHARE) / 2;
  // Zoom in as asked, but never so far that the focus area leaves the circle.
  const zoom = Math.min(focus.zoom, (r * 0.85) / extent);
  const cx = box.x + box.w + r + PADDING / 2;
  const cy = box.y + box.h / 2;
  const map: Mapper = ([x, y]) => [cx + (x - centre[0]) * zoom, cy + (y - centre[1]) * zoom];
  return { cx, cy, r, zoom, map };
}

function insetSvg(spec: DoodleSpec, focus: Focus, inset: Inset, poses: Solved[], timing: string): string {
  const { cx, cy, r, zoom, map } = inset;
  // Unique per doodle: several SVGs inlined on one page must not share a clip.
  const clipId = `focus-${spec.slug}`;
  const fontSize = r * 0.16;
  const label = focus.label
    ? `<text x="${fmt(cx)}" y="${fmt(cy + r + fontSize * 1.2)}" fill="${FOCUS_COLOUR}" stroke="none" font-family="system-ui, sans-serif" font-size="${fmt(fontSize)}" text-anchor="middle">${focus.label}</text>`
    : "";
  return `<clipPath id="${clipId}"><circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r)}"/></clipPath>
<g clip-path="url(#${clipId})">
<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r)}" fill="#000" stroke="none"/>
${highlightSvg(focus, poses, timing, map)}
${figureSvg(spec, poses, timing, map, zoom)}
</g>
<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r)}" stroke="${FOCUS_COLOUR}" stroke-width="4"/>
${label}`;
}

/** Animated SVG (SMIL) — plays inside a plain <img>, loops forever. */
export function renderDoodleSvg(spec: DoodleSpec): string {
  const timeline = sampleTimeline(spec);
  const { poses } = timeline;
  const timing = `dur="${fmt(timeline.duration)}s" repeatCount="indefinite" calcMode="linear" keyTimes="${timeline.keyTimes
    .map((value) => value.toFixed(4))
    .join(";")}"`;
  const box = specViewBox(spec, poses);
  const focus = FOCUS_BY_ID[spec.id];
  const inset = insetFor(focus, poses, box);
  const width = inset ? inset.cx + inset.r + PADDING / 2 - box.x : box.w;
  const view = [box.x, box.y, width, box.h].map(fmt).join(" ");
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
<rect x="${fmt(box.x)}" y="${fmt(box.y)}" width="${fmt(width)}" height="${fmt(box.h)}" fill="#000"/>
<g fill="none" stroke="${STROKE}" stroke-width="${STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round">
${layers}
</g>
</svg>
`;
}
