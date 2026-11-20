import { facePoints, faceMarks2D, type FaceMark } from "./face";
import { FOCUS_BY_ID, type Focus, type Segment } from "./focus";
import { bellSize, bells, byTheHorns, gearPanel, gearPoints, handsOff, heldLines, panelOf, RING_RADIUS, secondView, strapAnchor, strapAttach, strapLine, strapSides } from "./gear";
import { partnerFlat, PARTNER_OPACITY, PARTNER_WIDTH } from "./partner";
import type { Panel, View } from "./project";
import { dualLayout, renderDualSvg } from "./renderDual";
import { renderTopSvg, topLayout } from "./renderTop";
import { sampleTimeline, SEGMENTS, type DoodleSpec, type Point, type Prop, type Side, type Solved, type Timeline } from "./rig";

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
function animatedCircle(centres: Point[], r: number, fill: string, timing: string, extra = ""): string {
  const cx = animate("cx", centres.map((p) => fmt(p[0])), timing);
  const cy = animate("cy", centres.map((p) => fmt(p[1])), timing);
  return `<circle cx="${fmt(centres[0][0])}" cy="${fmt(centres[0][1])}" r="${fmt(r)}" style="fill:${fill}"${extra}>${cx}${cy}</circle>`;
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

/** Strap webbing and ring strokes: thinner than the limbs, so gear never reads as a bone. */
const STRAP_WIDTH = 3;
const RING_STROKE = 4;

const fadeAttr = (opacity: number): string => (opacity < 1 ? ` opacity="${opacity}"` : "");

/** One side's strap (rings, handles) or anchored band, from the panel's anchor to the hand, knee or ankle. */
function strapSvg(spec: DoodleSpec, side: Side, poses: Solved[], timing: string, map: Mapper, scale: number, panel: Panel, opacity: number): string {
  if (!strapSides(spec).includes(side)) return "";
  const anchor = strapAnchor(spec, poses, side, panel);
  const line = animatedPolyline((pose) => strapLine(spec, anchor, pose, side), poses, timing, 1, map);
  if (spec.straps!.end === "band") {
    return `<g style="stroke:${FOCUS_COLOUR}" stroke-width="${BAND_WIDTH}"${fadeAttr(opacity)}>${line}</g>`;
  }
  const ring =
    spec.straps!.end === "ring"
      ? animatedCircle(poses.map((pose) => map(strapAttach(spec, pose, side))), RING_RADIUS * scale, "none", timing, ` stroke-width="${RING_STROKE}"`)
      : "";
  return `<g stroke-width="${STRAP_WIDTH}"${fadeAttr(opacity)}>${line}${ring}</g>`;
}

/** Nose tick and held stick strokes: thinner than the limbs. */
const FACE_WIDTH = 5;
const STICK_WIDTH = 5;

/** A 0/1 opacity per sample, animated (`shown[i]`: visible at sample i). */
function shownAttrs(shown: boolean[], timing: string): { attr: string; child: string } {
  const values = shown.map((on) => (on ? "1" : "0"));
  return { attr: ` opacity="${values[0]}"`, child: animate("opacity", values, timing) };
}

/** A two-point (or longer) line moving through `frames`, with `attrs`; shown only while `shown` (when given). */
function animatedLine(frames: Point[][], timing: string, map: Mapper, attrs: string, shown?: boolean[]): string {
  const points = frames.map((line) => pointsAttr(line.map(map)));
  const fade = shown ? shownAttrs(shown, timing) : { attr: "", child: "" };
  return `<polyline points="${points[0]}"${attrs}${fade.attr}>${animate("points", points, timing)}${fade.child}</polyline>`;
}

/**
 * The nose tick: `back` is drawn under the head circle (only its tip past the
 * circle shows), the front copy over it while the face is towards the viewer.
 */
function faceSvg(marks: FaceMark[] | undefined, timing: string, map: Mapper, back: boolean): string {
  if (!marks) return "";
  const frames = marks.map((mark) => [mark.from, mark.to]);
  const attrs = ` stroke-width="${FACE_WIDTH}"`;
  const always = marks.every((mark) => mark.front);
  if (back) return always ? "" : animatedLine(frames, timing, map, attrs);
  if (always) return animatedLine(frames, timing, map, attrs);
  return marks.some((mark) => mark.front) ? animatedLine(frames, timing, map, attrs, marks.map((mark) => mark.front)) : "";
}

/** A stick (ink, past the hands) or towel (accent, like a band); shown only while `shown` (when given). */
function heldSvg(spec: DoodleSpec, lines: Point[][] | undefined, timing: string, map: Mapper, shown?: boolean[]): string {
  if (!lines) return "";
  const attrs = spec.stick ? ` stroke-width="${STICK_WIDTH}"` : ` style="stroke:${FOCUS_COLOUR}" stroke-width="${BAND_WIDTH}"`;
  return animatedLine(lines, timing, map, attrs, shown);
}

/** A band from hand to hand (accent colour, like the thigh band). */
function handBandSvg(spec: DoodleSpec, poses: Solved[], timing: string, map: Mapper): string {
  if (!spec.handBand) return "";
  const path: Path = (p) => [p.arms.near.end, p.arms.far.end];
  return `<g style="stroke:${FOCUS_COLOUR}" stroke-width="${BAND_WIDTH}">${animatedPolyline(path, poses, timing, 1, map)}</g>`;
}

/** Kettlebell handle stroke (the bell itself is a solid disc: never a second head). */
const HANDLE_WIDTH = 4;

/** A bell that changes hands or is held by the horns is drawn in its own layers (`bellBack`, `bellFront`), not with one arm. */
const layeredBell = (spec: DoodleSpec): boolean => byTheHorns(spec) || handsOff(spec);

/** A solid bell and a handle arc up through the grip, for the bell that starts in `side`; `attrs` (and `extra` children) go on its group. */
function bellGroup(spec: DoodleSpec, side: Side, poses: Solved[], timing: string, map: Mapper, scale: number, panel: Panel, attrs: string, extra = ""): string {
  const list = bells(spec, poses, side, panel);
  const d = list.map(({ handle: [a, c, b] }) => {
    const [p, q, r] = [a, c, b].map(map);
    return `M${fmt(p[0])},${fmt(p[1])} Q${fmt(q[0])},${fmt(q[1])} ${fmt(r[0])},${fmt(r[1])}`;
  });
  const handle = `<path d="${d[0]}" stroke-width="${fmt(HANDLE_WIDTH * scale)}">${animate("d", d, timing)}</path>`;
  const body = animatedCircle(list.map((bell) => map(bell.centre)), bellSize(spec) * scale, INK, timing, ` stroke-width="${fmt(2 * scale)}"`);
  return `<g${attrs}>${handle}${body}${extra}</g>`;
}

/** A kettlebell in one hand. */
function bellSvg(spec: DoodleSpec, side: Side, poses: Solved[], timing: string, map: Mapper, scale: number, panel: Panel, opacity: number): string {
  if (!spec.kettlebell?.hands.includes(side) || layeredBell(spec)) return "";
  return bellGroup(spec, side, poses, timing, map, scale, panel, fadeAttr(opacity));
}

/**
 * A bell handed between the hands or held by the horns, at full strength.
 * `back`: a copy drawn just behind the torso (only where `inFront` is known);
 * otherwise drawn over the figure, shown only while `inFront` (when known), so
 * a bell behind the head is hidden by it (and by the neck).
 */
function layeredBellSvg(spec: DoodleSpec, back: boolean, poses: Solved[], timing: string, map: Mapper, scale: number, panel: Panel, inFront?: boolean[], behind?: boolean[]): string {
  if (!spec.kettlebell || !layeredBell(spec)) return "";
  const side = spec.kettlebell.hands[0];
  if (behind?.some(Boolean)) {
    // `fadeBehind`: pale behind the body while it is behind, bright over the figure otherwise.
    const [whenBehind, otherwise] = back ? [`${FAR_OPACITY}`, "0"] : ["0", "1"];
    const values = behind.map((b) => (b ? whenBehind : otherwise));
    return bellGroup(spec, side, poses, timing, map, scale, panel, ` opacity="${values[0]}"`, animate("opacity", values, timing));
  }
  if (back) return inFront ? bellGroup(spec, side, poses, timing, map, scale, panel, "") : "";
  if (!inFront) return bellGroup(spec, side, poses, timing, map, scale, panel, "");
  const shown = inFront.map((front) => (front ? "1" : "0"));
  return bellGroup(spec, side, poses, timing, map, scale, panel, ` opacity="${shown[0]}"`, animate("opacity", shown, timing));
}

/** A board's posts stand this far in from each end. */
export const BOARD_POST_INSET = 16;

/** Point on the board's line at `x`. */
function onBoard(from: Point, to: Point, x: number): Point {
  if (to[0] === from[0]) return [x, Math.max(from[1], to[1])]; // vertical: the higher end
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

/**
 * What a panel draws beside the figure and its spec-level gear: nose ticks,
 * the held stick or towel (in front of the torso or behind it, front panel),
 * and the partner (its own spec, poses as drawn, ticks, draw order).
 */
export interface PanelExtras {
  faces?: FaceMark[];
  held?: Point[][];
  heldInFront?: boolean[];
  partner?: { spec: DoodleSpec; poses: Solved[]; faces?: FaceMark[]; order?: readonly FigurePart[] };
}

/** Every point the extras are drawn through (for the bounds). */
export function extraPoints(extras: PanelExtras): Point[] {
  const partner = extras.partner;
  return [
    ...facePoints(extras.faces),
    ...(extras.held ?? []).flat(),
    ...(partner ? [...partner.poses.flatMap((pose) => figurePoints(pose).map((p) => p.point)), ...facePoints(partner.faces)] : []),
  ];
}

/** A single-view spec's samples and where its keyframes are among them. */
type FlatSamples = Pick<Timeline, "poses" | "keyframeIndex">;

/** Extras of a single-view spec, from its 2D samples. */
export function flatExtras(spec: DoodleSpec, { poses, keyframeIndex }: FlatSamples): PanelExtras {
  const partner = partnerFlat(spec, poses, keyframeIndex);
  return {
    faces: faceMarks2D(spec, poses),
    held: heldLines(spec, poses),
    partner: partner && { spec: partner.spec, poses: partner.poses, faces: partner.faces },
  };
}

/** The partner, paler and thinner, drawn before (behind) the exerciser. */
export function partnerSvg(extras: PanelExtras, timing: string, map: Mapper, options: FigureOptions): string {
  const partner = extras.partner;
  if (!partner) return "";
  const figure = figureSvg(partner.spec, partner.poses, timing, map, { ...options, faces: partner.faces, order: partner.order ?? options.order });
  return `<g opacity="${PARTNER_OPACITY}" stroke-width="${PARTNER_WIDTH}">${figure}</g>`;
}

/** Everything the figure, its gear and props touch over the loop on one panel (no inset); `extra`: more points drawn (see `extraPoints`). */
export function figureExtent(poses: Solved[], props: readonly Prop[], spec: DoodleSpec, view: View = panelOf(spec), extra: Point[] = []): ViewBox {
  const panel = gearPanel(view);
  const r = spec.wheel;
  return bounds([
    ...poses.flatMap((pose) => figurePoints(pose).map((p) => p.point)),
    ...props.flatMap(propPoints),
    ...gearPoints(spec, poses, panel),
    // The ab wheel round the near hand.
    ...(r === undefined
      ? []
      : poses.flatMap(({ arms: { near: { end: [x, y] } } }): Point[] => [[x - r, y - r], [x + r, y + r]])),
    ...extra,
  ], STROKE_REACH);
}

interface Layout {
  view: ViewBox;
  focus?: Focus;
  inset?: Inset;
}

/** Floors run under the partner as well as the exerciser: the poses a panel's floors resolve against. */
export const partnerFloor = (poses: Solved[], extras: PanelExtras): Solved[] => (extras.partner ? [...poses, ...extras.partner.poses] : poses);

function layoutFor(spec: DoodleSpec, timeline: FlatSamples, extras: PanelExtras = flatExtras(spec, timeline)): Layout {
  const { poses } = timeline;
  const figure = figureExtent(poses, resolveFloors(spec.props ?? [], partnerFloor(poses, extras)), spec, panelOf(spec), extraPoints(extras));
  const focus = FOCUS_BY_ID[spec.id];
  const inset = insetFor(focus, poses, figure);
  const drawing = inset ? union(figure, insetExtent(inset, focus)) : figure;
  return { view: frame(drawing), focus, inset };
}

export function specViewBox(spec: DoodleSpec, timeline?: FlatSamples): ViewBox {
  if (spec.views) return secondView(spec) === "top" ? topLayout(spec).view : dualLayout(spec).view;
  return layoutFor(spec, timeline ?? sampleTimeline(spec)).view;
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
export const FIGURE_PARTS = [
  "legFar",
  "armFar",
  "strapFar",
  "bellFar",
  "forearmsBack",
  "bellBack",
  "spine",
  "head",
  "legNear",
  "band",
  "armNear",
  "strapNear",
  "handBand",
  "held",
  "bellNear",
  "wheel",
  "bellFront",
  "heldBack",
  "heldFront",
] as const;
export type FigurePart = (typeof FIGURE_PARTS)[number];

export interface FigureOptions {
  /** Keeps the head (and wheel) in proportion under a zoom. */
  headScale?: number;
  /** Opacity of the far arm and leg (1 when both sides are seen square on). */
  farOpacity?: number;
  /** Back-to-front order (the front panel sorts by depth). */
  order?: readonly FigurePart[];
  /** Which panel the poses are (front: straps hang above each hand, racked bells sit outside the forearm; top: no gear, as side). */
  panel?: View;
  /** Per sample, whether a bell held by the horns is in front of the head (two views; see `bellInFront`). */
  bellInFront?: boolean[];
  /** Per sample nose ticks (see `FaceMark`). */
  faces?: FaceMark[];
  /** Per sample stick or towel line. */
  held?: Point[][];
  /** Front panel: per sample, whether the stick or towel is in front of the torso (drawn behind it and again over the figure). */
  heldInFront?: boolean[];
  /** `fadeBehind`: per sample, whether each forearm and the layered bell is behind the body (drawn pale, behind it). */
  behind?: Behind;
}

/** Per sample, what is behind the body on a panel (see `DoodleSpec.fadeBehind`). */
export interface Behind {
  forearms?: Partial<Record<Side, boolean[]>>;
  bell?: boolean[];
}

const forearmPath = (side: Side): Path => (p) => [p.arms[side].mid, p.arms[side].joint, p.arms[side].end];
const upperArmPath = (side: Side): Path => (p) => [p.chest, p.arms[side].root, p.arms[side].mid];

/**
 * An arm. With `behind` samples (see `Behind`) its forearm is split off and
 * shown here only while it is in front; `forearmsBackSvg` draws it pale behind the body.
 */
function armSvg(side: Side, poses: Solved[], timing: string, map: Mapper, opacity: number, behind: boolean[] | undefined): string {
  if (!behind?.some(Boolean)) return animatedPolyline(armPath(side), poses, timing, opacity, map);
  const fore = animatedLine(poses.map(forearmPath(side)), timing, map, "", behind.map((b) => !b));
  return animatedPolyline(upperArmPath(side), poses, timing, opacity, map) + (opacity < 1 ? `<g${fadeAttr(opacity)}>${fore}</g>` : fore);
}

/** The forearms while they are behind the body, pale (drawn just behind the torso). */
function forearmsBackSvg(poses: Solved[], timing: string, map: Mapper, behind: Behind | undefined): string {
  const lines = (["far", "near"] as Side[])
    .filter((side) => behind?.forearms?.[side]?.some(Boolean))
    .map((side) => animatedLine(poses.map(forearmPath(side)), timing, map, "", behind!.forearms![side]))
    .join("");
  return lines ? `<g${fadeAttr(FAR_OPACITY)}>${lines}</g>` : "";
}

/** The far side at full strength in a front view, faded behind the near side otherwise. */
const farOpacityOf = (spec: DoodleSpec): number => (spec.view === "front" ? 1 : FAR_OPACITY);

/** The figure (far side first by default), drawn through `map`. */
export function figureSvg(
  spec: DoodleSpec,
  poses: Solved[],
  timing: string,
  map: Mapper,
  { headScale = 1, farOpacity = FAR_OPACITY, order = FIGURE_PARTS, panel: view = panelOf(spec), bellInFront, faces, held, heldInFront, behind }: FigureOptions = {},
): string {
  const panel = gearPanel(view);
  const parts: Record<FigurePart, () => string> = {
    legFar: () => animatedPolyline(legPath("far"), poses, timing, farOpacity, map),
    armFar: () => armSvg("far", poses, timing, map, farOpacity, behind?.forearms?.far),
    spine: () => animatedPolyline(spinePath, poses, timing, 1, map),
    head: () =>
      faceSvg(faces, timing, map, true) +
      animatedCircle(poses.map((pose) => map(pose.head)), SEGMENTS.headRadius * headScale, PAPER, timing) +
      faceSvg(faces, timing, map, false),
    legNear: () => animatedPolyline(legPath("near"), poses, timing, 1, map),
    band: () => bandSvg(spec, poses, timing, map),
    armNear: () => armSvg("near", poses, timing, map, 1, behind?.forearms?.near),
    forearmsBack: () => forearmsBackSvg(poses, timing, map, behind),
    wheel: () => wheelSvg(spec, poses, timing, map, headScale),
    strapFar: () => strapSvg(spec, "far", poses, timing, map, headScale, panel, farOpacity),
    strapNear: () => strapSvg(spec, "near", poses, timing, map, headScale, panel, 1),
    handBand: () => handBandSvg(spec, poses, timing, map),
    bellFar: () => bellSvg(spec, "far", poses, timing, map, headScale, panel, farOpacity),
    bellNear: () => bellSvg(spec, "near", poses, timing, map, headScale, panel, 1),
    bellBack: () => layeredBellSvg(spec, true, poses, timing, map, headScale, panel, bellInFront, behind?.bell),
    bellFront: () => layeredBellSvg(spec, false, poses, timing, map, headScale, panel, bellInFront, behind?.bell),
    held: () => (heldInFront ? "" : heldSvg(spec, held, timing, map)),
    heldBack: () => (heldInFront ? heldSvg(spec, held, timing, map) : ""),
    heldFront: () => (heldInFront?.some(Boolean) ? heldSvg(spec, held, timing, map, heldInFront) : ""),
  };
  return order.map((part) => parts[part]()).join("");
}

export interface Inset {
  cx: number;
  cy: number;
  r: number;
  zoom: number;
  map: Mapper;
}

/** Inset to the right of the figure, zoomed on the focus joints' range over the loop. */
export function insetFor(focus: Focus | undefined, poses: Solved[], figure: ViewBox): Inset | undefined {
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
export function insetExtent(inset: Inset, focus: Focus | undefined): ViewBox {
  const reach = inset.r + RING_WIDTH / 2;
  const bottom = focus?.label
    ? labelBaseline(inset, focus) + labelSize(inset.r, focus) * LABEL_DESCENT
    : inset.cy + reach;
  return { x: inset.cx - reach, y: inset.cy - reach, w: 2 * reach, h: bottom - (inset.cy - reach) };
}

export function insetSvg(spec: DoodleSpec, focus: Focus, inset: Inset, poses: Solved[], timing: string, extras: PanelExtras, options: FigureOptions = {}): string {
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
${figureSvg(spec, poses, timing, map, { headScale: zoom, farOpacity: farOpacityOf(spec), faces: extras.faces, held: extras.held, ...options })}
</g>
<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r)}" style="stroke:${FOCUS_COLOUR}" stroke-width="${RING_WIDTH}"/>
${label}`;
}

/** Animated SVG (SMIL), loops forever; plays standalone, in an <img>, or inlined (doodleMarkup). */
export function renderDoodleSvg(spec: DoodleSpec): string {
  if (spec.views) return secondView(spec) === "top" ? renderTopSvg(spec) : renderDualSvg(spec);
  const timeline = sampleTimeline(spec);
  const { poses } = timeline;
  const timing = timingAttr(timeline);
  const extras = flatExtras(spec, timeline);
  const { view, focus, inset } = layoutFor(spec, timeline, extras);
  const props = resolveFloors(spec.props ?? [], partnerFloor(poses, extras)).map(propSvg).join("");
  const options: FigureOptions = { farOpacity: farOpacityOf(spec) };
  return svgShell(view, spec.title, [
    highlightSvg(focus, poses, timing, identity),
    `${props}\n${partnerSvg(extras, timing, identity, options)}${figureSvg(spec, poses, timing, identity, { ...options, faces: extras.faces, held: extras.held })}`,
    focus && inset ? insetSvg(spec, focus, inset, poses, timing, extras) : "",
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
