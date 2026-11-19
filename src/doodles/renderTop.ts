/**
 * Side + top doodles (`views: ["side", "top"]`): floor moves seen from the side
 * and from above, one 3D-solved figure on one clock. The top panel sits under
 * the side panel with the same x, so the head, hands and feet line up; its
 * vertical is z with the near side (the side view's camera) at the bottom.
 */
import { FOCUS_BY_ID } from "./focus";
import { project } from "./project";
import { BOARD_HALF, depthOrder, handZ, label, LABEL_GAP, LABEL_SIZE, type HandZ } from "./renderDual";
import {
  figureExtent,
  figureSvg,
  frame,
  highlightSvg,
  identity,
  PADDING,
  propSvg,
  resolveFloors,
  svgShell,
  timingAttr,
  union,
  type Mapper,
  type ViewBox,
} from "./renderSvg";
import type { DoodleSpec, Prop, Solved } from "./rig";
import { sampleTimeline3, type Timeline3 } from "./rig3d";

/** Sideways half-extents seen from above (as from the front). */
const TOP_BAR_HALF = 90;
const TOP_BOX_HALF = 60;
const TOP_RAIL_HALF = 30;
/** Half-length of a parallette handle (as in the side view). */
const HANDLE_HALF = 22;

/** A footprint from x1 to x2 across ±half (screen y = -z). */
const footprint = (x1: number, x2: number, half: number): Prop => ({
  kind: "box",
  x: Math.min(x1, x2),
  y: -half,
  w: Math.abs(x2 - x1),
  h: 2 * half,
});

/** A line along x at sideways position z. */
const alongX = (x1: number, x2: number, z: number): Prop => ({ kind: "bar", y: -z, x1, x2 });

/**
 * Props seen from above: box, bench board and bar as their footprints, the
 * rails of parallel bars and parallette handles as lines along x at their z.
 * The floor is the panel itself and isn't drawn.
 */
export function topProps(props: readonly Prop[], hands: HandZ = handZ(undefined)): Prop[] {
  return props.flatMap((prop): Prop[] => {
    switch (prop.kind) {
      case "floor":
        return [];
      case "bar":
        return [footprint(prop.x1, prop.x2, TOP_BAR_HALF)];
      case "box":
        return [footprint(prop.x, prop.x + prop.w, prop.frontHalf ?? TOP_BOX_HALF)];
      case "board":
        return [footprint(prop.from[0], prop.to[0], BOARD_HALF)];
      case "parallelBars": {
        const half = prop.frontHalf ?? TOP_RAIL_HALF;
        return [alongX(prop.x1, prop.x2, -half), alongX(prop.x1, prop.x2, half)];
      }
      case "parallettes":
        return prop.xs.flatMap((x) => [hands.near, hands.far].map((z) => alongX(x - HANDLE_HALF, x + HANDLE_HALF, z)));
    }
  });
}

interface TopLayout {
  view: ViewBox;
  /** Added to top-panel y so it sits under the side panel (x is shared). */
  topShift: number;
  side: Solved[];
  top: Solved[];
  labels: { side: [number, number]; top: [number, number] };
}

export function topLayout(spec: DoodleSpec, timeline: Timeline3 = sampleTimeline3(spec)): TopLayout {
  const side = timeline.poses.map((pose) => project(pose, "side"));
  const top = timeline.poses.map((pose) => project(pose, "top"));
  const props = spec.props ?? [];
  const sideBox = figureExtent(side, resolveFloors(props, side), spec, "side");
  const topBox = figureExtent(top, topProps(props, handZ(timeline.poses[0])), spec, "side");
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
  return svgShell(layout.view, spec.title, [
    highlightSvg(focus, layout.side, timing, identity),
    resolveFloors(props, layout.side).map(propSvg).join(""),
    figureSvg(spec, layout.side, timing, identity, { panel: "side" }),
    highlightSvg(focus, layout.top, timing, shift),
    topProps(props, handZ(timeline.poses[0]))
      .map((prop) => propSvg(shiftProp(prop, layout.topShift)))
      .join(""),
    // Seen from above both sides are square on; higher parts are drawn over lower ones.
    figureSvg(spec, layout.top, timing, shift, { farOpacity: 1, order: depthOrder(spec, timeline.poses, (p) => -p[1]), panel: "side" }),
    label("side", ...layout.labels.side),
    label("top", ...layout.labels.top),
  ]);
}

/** A top-view prop moved down by `dy` (only the kinds `topProps` makes). */
function shiftProp(prop: Prop, dy: number): Prop {
  if (prop.kind === "box") return { ...prop, y: prop.y + dy };
  if (prop.kind === "bar") return { ...prop, y: prop.y + dy };
  return prop;
}
