import { maxLoad, type MuscleLoadMap } from "../body/aggregate";
import { formatLoadScore, heatOpacity } from "../body/heat";
import {
  BODY_VIEWBOX,
  HEAD,
  outlinePoints,
  polygonsForRegion,
  regionsForView,
  toSvgPoints,
  type BodyRegion,
  type BodyView,
} from "../body/silhouette";

const VIEWS: readonly BodyView[] = ["front", "back"];

/** Front + back silhouettes with brass fill opacity driven by muscle load. */
export function renderBodyMap(loads: MuscleLoadMap): string {
  const maxScore = maxLoad(loads);
  return `
    <div class="body-map">
      ${VIEWS.map((view) => renderFigure(view, loads, maxScore)).join("")}
    </div>`;
}

function renderFigure(view: BodyView, loads: MuscleLoadMap, maxScore: number): string {
  const regions = regionsForView(view)
    .map((region) => renderRegion(region, loads, maxScore))
    .join("");
  return `
    <figure class="body-figure">
      <svg viewBox="0 0 ${BODY_VIEWBOX.width} ${BODY_VIEWBOX.height}" role="img"
        aria-label="${view} view muscle load map">
        <polygon class="body-outline" points="${toSvgPoints(outlinePoints())}" />
        <circle class="body-outline" cx="${HEAD.cx}" cy="${HEAD.cy}" r="${HEAD.r}" />
        ${regions}
      </svg>
      <figcaption>${view}</figcaption>
    </figure>`;
}

function renderRegion(region: BodyRegion, loads: MuscleLoadMap, maxScore: number): string {
  const score = loads[region.group] ?? 0;
  const heat = heatOpacity(score, maxScore);
  const label = `${region.group}: ${formatLoadScore(score)}`;
  return polygonsForRegion(region)
    .map(
      (points) => `
        <polygon class="body-region" data-group="${region.group}"
          style="--heat:${heat.toFixed(3)}" points="${toSvgPoints(points)}">
          <title>${label}</title>
        </polygon>`,
    )
    .join("");
}
