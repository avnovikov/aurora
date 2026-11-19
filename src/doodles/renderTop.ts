/**
 * Side + top doodles (`views: ["side", "top"]`): floor moves seen from the side
 * and from above, one 3D-solved figure on one clock. The top panel sits under
 * the side panel with the same x, so the head, hands and feet line up; its
 * vertical is z with the near side (the side view's camera) at the bottom.
 */
import { FOCUS_BY_ID } from "./focus";
import { project } from "./project";
import { depthOrder, handZ, label, LABEL_GAP, LABEL_SIZE, panelExtras3, propDepth, railHalf, type HandZ } from "./renderDual";
import {
  extraPoints,
  figureExtent,
  figureSvg,
  frame,
  highlightSvg,
  identity,
  PADDING,
  partnerSvg,
  propSvg,
  resolveFloors,
  svgShell,
  timingAttr,
  union,
  type Mapper,
  type PanelExtras,
  type ViewBox,
} from "./renderSvg";
import type { DoodleSpec, Prop, Solved } from "./rig";
import { sampleTimeline3, type Timeline3 } from "./rig3d";
import { partner3D } from "./partner";

/** Half-length of a parallette handle (as in the side view). */
const PARALLETTE_HALF = 22;

/** A footprint from x1 to x2 across a sideways extent (screen y = -z), `shift` down. */
const footprint = (x1: number, x2: number, [low, high]: [number, number], shift: number): Prop => ({
  kind: "box",
  x: Math.min(x1, x2),
  y: -high + shift,
  w: Math.abs(x2 - x1),
  h: high - low,
});

/** A line along x at sideways position z, `shift` down. */
const alongX = (x1: number, x2: number, z: number, shift: number): Prop => ({ kind: "bar", y: -z + shift, x1, x2 });

/**
 * Props seen from above, `shift` down: box, bench board and bar as their
 * footprints, the rails of parallel bars and parallette handles as lines along
 * x at their z. The floor is the panel itself and isn't drawn.
 */
export function topProps(props: readonly Prop[], hands: HandZ = handZ(undefined), shift = 0): Prop[] {
  return props.flatMap((prop): Prop[] => {
    switch (prop.kind) {
      case "floor":
        return [];
      case "bar":
        return [footprint(prop.x1, prop.x2, propDepth(prop, hands)[0], shift)];
      case "box":
        return [footprint(prop.x, prop.x + prop.w, propDepth(prop, hands)[0], shift)];
      case "board":
        return [footprint(prop.from[0], prop.to[0], propDepth(prop, hands)[0], shift)];
      case "parallelBars": {
        const half = railHalf(prop);
        return [alongX(prop.x1, prop.x2, -half, shift), alongX(prop.x1, prop.x2, half, shift)];
      }
      case "parallettes":
        return prop.xs.flatMap((x) => [hands.near, hands.far].map((z) => alongX(x - PARALLETTE_HALF, x + PARALLETTE_HALF, z, shift)));
    }
  });
}

interface TopLayout {
  view: ViewBox;
  /** Added to top-panel y so it sits under the side panel (x is shared). */
  topShift: number;
  side: Solved[];
  top: Solved[];
  extras: { side: PanelExtras; top: PanelExtras };
  labels: { side: [number, number]; top: [number, number] };
}

export function topLayout(spec: DoodleSpec, timeline: Timeline3 = sampleTimeline3(spec)): TopLayout {
  const side = timeline.poses.map((pose) => project(pose, "side"));
  const top = timeline.poses.map((pose) => project(pose, "top"));
  const props = spec.props ?? [];
  const partner = partner3D(spec, timeline);
  const extras = { side: panelExtras3(spec, timeline, "side", partner), top: panelExtras3(spec, timeline, "top", partner) };
  const sideFloor = extras.side.partner ? [...side, ...extras.side.partner.poses] : side;
  const sideBox = figureExtent(side, resolveFloors(props, sideFloor), spec, "side", extraPoints(extras.side));
  const topBox = figureExtent(top, topProps(props, handZ(timeline.poses[0])), spec, "top", extraPoints(extras.top));
  const sideLabel = sideBox.y + sideBox.h + LABEL_GAP + LABEL_SIZE;
  // Under the side panel's label, with the usual padding between the panels.
  const topShift = sideLabel + LABEL_SIZE * 0.3 + PADDING - topBox.y;
  const shifted: ViewBox = { ...topBox, y: topBox.y + topShift };
  const topLabel = shifted.y + shifted.h + LABEL_GAP + LABEL_SIZE;
  const figures = union(sideBox, shifted);
  const drawing = { ...figures, h: topLabel + LABEL_SIZE * 0.3 - figures.y };
  return {
    view: frame(drawing),
    topShift,
    side,
    top,
    extras,
    labels: { side: [sideBox.x + sideBox.w / 2, sideLabel], top: [shifted.x + shifted.w / 2, topLabel] },
  };
}

/** Animated SVG with the side panel over the top panel; no zoom inset. */
export function renderTopSvg(spec: DoodleSpec): string {
  const timeline = sampleTimeline3(spec);
  const timing = timingAttr(timeline);
  const layout = topLayout(spec, timeline);
  const focus = FOCUS_BY_ID[spec.id];
  const shift: Mapper = ([x, y]) => [x, y + layout.topShift];
  const props = spec.props ?? [];
  const { side, top } = layout.extras;
  const own = (e: PanelExtras) => ({ faces: e.faces, held: e.held });
  return svgShell(layout.view, spec.title, [
    highlightSvg(focus, layout.side, timing, identity),
    resolveFloors(props, side.partner ? [...layout.side, ...side.partner.poses] : layout.side).map(propSvg).join(""),
    partnerSvg(side, timing, identity, { panel: "side" }),
    figureSvg(spec, layout.side, timing, identity, { panel: "side", ...own(side) }),
    highlightSvg(focus, layout.top, timing, shift),
    topProps(props, handZ(timeline.poses[0]), layout.topShift).map(propSvg).join(""),
    partnerSvg(top, timing, shift, { farOpacity: 1, panel: "top" }),
    // Seen from above both sides are square on; higher parts are drawn over lower ones.
    figureSvg(spec, layout.top, timing, shift, { farOpacity: 1, order: depthOrder(spec, timeline.poses, (p) => -p[1]), panel: "top", ...own(top) }),
    label("side", ...layout.labels.side),
    label("top", ...layout.labels.top),
  ]);
}
