import { sampleTimeline, SEGMENTS, type DoodleSpec, type Point, type Prop, type Side, type Solved } from "./rig";

const STROKE = "#f4f1ea";
const STROKE_WIDTH = 7;
const FAR_OPACITY = 0.5;

type Path = (pose: Solved) => Point[];

const fmt = (value: number): string => (Math.round(value * 10) / 10).toString();
const pointsAttr = (points: Point[]): string => points.map((p) => `${fmt(p[0])},${fmt(p[1])}`).join(" ");

function animate(attribute: string, values: string[], timing: string): string {
  return `<animate attributeName="${attribute}" values="${values.join(";")}" ${timing}/>`;
}

/** A polyline through joints, its `points` animated over the sampled poses. */
function animatedPolyline(path: Path, poses: Solved[], timing: string, opacity = 1): string {
  const frames = poses.map((pose) => pointsAttr(path(pose)));
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

/** Animated SVG (SMIL) — plays inside a plain <img>, loops forever. */
export function renderDoodleSvg(spec: DoodleSpec): string {
  const timeline = sampleTimeline(spec);
  const { poses } = timeline;
  const timing = `dur="${fmt(timeline.duration)}s" repeatCount="indefinite" calcMode="linear" keyTimes="${timeline.keyTimes
    .map((value) => value.toFixed(4))
    .join(";")}"`;
  const farOpacity = spec.view === "front" ? 1 : FAR_OPACITY;
  const head = poses.map((pose) => pose.head);

  const body = [
    animatedPolyline(legPath("far"), poses, timing, farOpacity),
    animatedPolyline(armPath("far"), poses, timing, farOpacity),
    animatedPolyline(spinePath, poses, timing),
    `<circle cx="${fmt(head[0][0])}" cy="${fmt(head[0][1])}" r="${SEGMENTS.headRadius}" fill="#000">${animate(
      "cx",
      head.map((p) => fmt(p[0])),
      timing,
    )}${animate(
      "cy",
      head.map((p) => fmt(p[1])),
      timing,
    )}</circle>`,
    animatedPolyline(legPath("near"), poses, timing),
    animatedPolyline(armPath("near"), poses, timing),
  ].join("");

  const box = specViewBox(spec, poses);
  const view = [box.x, box.y, box.w, box.h].map(fmt).join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view}" role="img" aria-label="${spec.title}">
<title>${spec.title}</title>
<rect x="${fmt(box.x)}" y="${fmt(box.y)}" width="${fmt(box.w)}" height="${fmt(box.h)}" fill="#000"/>
<g fill="none" stroke="${STROKE}" stroke-width="${STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round">
${(spec.props ?? []).map(propSvg).join("")}
${body}
</g>
</svg>
`;
}
