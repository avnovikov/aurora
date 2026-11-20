import type { Level } from "../body/balance";
import {
  BODY_CONTOUR_PATH,
  CONTOUR_HEAD,
  polygonCentroid,
  polygonsForRegion,
  regionsForView,
  toSvgPoints,
  type BodyView,
} from "../body/silhouette";
import type { MuscleGroup } from "../domain/types";

const VIEWS: ReadonlyArray<{ view: BodyView; x: number; label: string }> = [
  { view: "front", x: 14, label: "Front" },
  { view: "back", x: 194, label: "Back" },
];

/** Short codes on `data-l`, driving scale, fill and outline in CSS. */
export const LEVEL_CODE: Readonly<Record<Level, string>> = {
  heavy: "h",
  moderate: "m",
  light: "l",
  none: "n",
};

/** Paint order: Not trained and Light first, Heavy last, so fuller regions sit on top. */
const PAINT_ORDER: readonly string[] = ["n", "l", "m", "h"];

interface RegionShape {
  order: number;
  group: MuscleGroup;
  points: string;
  cx: number;
  cy: number;
}

function shapesFor(view: BodyView): readonly RegionShape[] {
  return regionsForView(view)
    .flatMap((region) => polygonsForRegion(region).map((points) => ({ region, points })))
    .map(({ region, points }, order) => {
      const [cx, cy] = polygonCentroid(points);
      return {
        order,
        group: region.group,
        points: toSvgPoints(points),
        cx: Math.round(cx * 100) / 100,
        cy: Math.round(cy * 100) / 100,
      };
    });
}

/** Region polygons and centroids never change; work them out once. */
const SHAPES: Readonly<Record<BodyView, readonly RegionShape[]>> = {
  front: shapesFor("front"),
  back: shapesFor("back"),
};

/** Each figure gets its own SVG ids, so two on one page never share a mask. */
let figureCount = 0;

function renderView(
  view: BodyView,
  x: number,
  label: string,
  levels: Record<MuscleGroup, Level>,
  uid: string,
): string {
  const rank = (shape: RegionShape): number => PAINT_ORDER.indexOf(LEVEL_CODE[levels[shape.group]]);
  const shapes = [...SHAPES[view]]
    .sort((a, b) => rank(a) - rank(b) || a.order - b.order)
    .map(
      (shape) =>
        `<polygon class="bb-r" data-order="${shape.order}" data-area="${shape.group}" data-l="${LEVEL_CODE[levels[shape.group]]}" style="--cx:${shape.cx};--cy:${shape.cy}" points="${shape.points}"/>`,
    )
    .join("");
  return `
      <svg x="${x}" y="1" width="150" height="315" viewBox="0 0 100 210" overflow="visible" aria-label="${label}">
        <use class="bb-contour" href="#${uid}-body"/><use class="bb-contour" href="#${uid}-head"/>
        <g mask="url(#${uid}-inside)" data-bb-view="${view}">${shapes}</g>
      </svg>`;
}

/**
 * Front and back figure for the balance view (#234). Each region scales about
 * its centroid by level inside a fixed contour; Not trained regions are dashed
 * see-through outlines. No text sits on the figure.
 */
export function renderBalanceFigure(levels: Record<MuscleGroup, Level>): string {
  figureCount += 1;
  const uid = `bb${figureCount}`;
  return `
    <svg class="bb-hero" viewBox="0 0 358 292" role="img"
      aria-label="Front and back of the body. Regions swell past the fixed contour when heavy and shrink inside it when light or not trained.">
      <defs>
        <path id="${uid}-body" d="${BODY_CONTOUR_PATH}"/>
        <circle id="${uid}-head" cx="${CONTOUR_HEAD.cx}" cy="${CONTOUR_HEAD.cy}" r="${CONTOUR_HEAD.r}"/>
        <mask id="${uid}-inside" maskUnits="userSpaceOnUse" x="-10" y="-10" width="120" height="230">
          <use href="#${uid}-body" fill="#fff" stroke="#fff" stroke-width="4" stroke-linejoin="round"/>
          <use href="#${uid}-head" fill="#fff"/>
        </mask>
      </defs>
      ${VIEWS.map(({ view, x, label }) => renderView(view, x, label, levels, uid)).join("")}
    </svg>`;
}

function reorder(figure: Element): void {
  figure.querySelectorAll("g[data-bb-view]").forEach((group) => {
    const rank = (polygon: Element): number => PAINT_ORDER.indexOf(polygon.getAttribute("data-l") ?? "");
    const order = (polygon: Element): number => Number(polygon.getAttribute("data-order"));
    [...group.querySelectorAll("polygon.bb-r")]
      .sort((a, b) => rank(a) - rank(b) || order(a) - order(b))
      .forEach((polygon) => group.appendChild(polygon));
  });
}

/**
 * Move an already drawn figure to new levels in place, so the CSS transition
 * animates the change. Paint order is restored once the transition is over
 * (at once when `settleMs` is 0).
 */
export function updateBalanceFigure(
  figure: Element,
  levels: Record<MuscleGroup, Level>,
  settleMs = 320,
): void {
  figure.querySelectorAll("polygon.bb-r").forEach((polygon) => {
    const group = polygon.getAttribute("data-area") as MuscleGroup;
    polygon.setAttribute("data-l", LEVEL_CODE[levels[group]]);
  });
  if (settleMs <= 0) {
    reorder(figure);
  } else {
    setTimeout(() => reorder(figure), settleMs);
  }
}
