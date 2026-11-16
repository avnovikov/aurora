import { EXERCISE_GRAPH } from "../data/exerciseGraph";
import { GENERATED_DOODLES } from "../data/generated/doodleMap";
import { escapeHtml } from "../library/present";
import { renderDoodleSvg } from "./renderSvg";
import type { DoodleSpec } from "./rig";
import { DOODLE_SPECS } from "./specs";

/** Generated path → spec, so call sites that only hold a path still inline. */
const SPEC_BY_PATH = new Map<string, DoodleSpec>(
  DOODLE_SPECS.flatMap((spec): [string, DoodleSpec][] => {
    const path = GENERATED_DOODLES[spec.id];
    return path ? [[path, spec]] : [];
  }),
);

/** Rendered SVG per spec id: sampling the timeline is the expensive part. */
const SVG_CACHE = new Map<string, string>();

function svgFor(spec: DoodleSpec): string {
  let svg = SVG_CACHE.get(spec.id);
  if (svg === undefined) {
    svg = renderDoodleSvg(spec).trim();
    SVG_CACHE.set(spec.id, svg);
  }
  return svg;
}

/** The doodle path an exercise shows (hand-drawn or animated), or the path itself. */
function resolvePath(idOrPath: string): string | undefined {
  return idOrPath.startsWith("/") ? idOrPath : EXERCISE_GRAPH[idOrPath]?.doodlePath;
}

/**
 * Doodle markup for an exercise id or a doodle path. An animated doodle is
 * inlined as `<svg class="doodle">` so its `var(--doodle-…)` colours follow the
 * active palette; a hand-drawn JPG stays an `<img class="doodle">`.
 */
export function doodleMarkup(idOrPath: string | undefined, title: string): string {
  const path = idOrPath ? resolvePath(idOrPath) : undefined;
  if (!path) {
    return "";
  }
  const label = `Doodle for ${escapeHtml(title)}`;
  const spec = SPEC_BY_PATH.get(path);
  if (!spec) {
    return `<img class="doodle" src="${escapeHtml(path)}" alt="${label}" />`;
  }
  return svgFor(spec).replace(
    /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"([^>]*) aria-label="[^"]*">\s*<title>[^<]*<\/title>/,
    `<svg class="doodle" xmlns="http://www.w3.org/2000/svg"$1 aria-label="${label}">`,
  );
}
