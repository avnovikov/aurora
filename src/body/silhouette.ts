import type { MuscleGroup } from "../domain/types";

/**
 * Original abstract body map: flat geometric regions on a 100×210 canvas.
 * Not traced from any third-party anatomy art. Regions marked `paired`
 * are authored for the figure's left half and mirrored across x = 50.
 */
export type BodyView = "front" | "back";
export type Point = readonly [x: number, y: number];

export interface BodyRegion {
  group: MuscleGroup;
  view: BodyView;
  points: readonly Point[];
  paired: boolean;
}

export const BODY_VIEWBOX = { width: 100, height: 210 } as const;
const MIRROR_AXIS_X = 50;

export const HEAD = { cx: 50, cy: 13, r: 10 } as const;

/** Left half of the outer silhouette, neck to ankle; mirrored to close the shape. */
const OUTLINE_HALF: readonly Point[] = [
  [45, 24], [45, 31], [33, 36], [21, 40], [19, 70], [20, 96], [30, 96],
  [31, 74], [32, 100], [32, 150], [35, 190], [45, 190], [45, 132], [50, 132],
];

const ARM_BICEPS: readonly Point[] = [[22, 53], [30, 54], [30, 70], [24, 70]];
const ARM_FOREARM: readonly Point[] = [[24, 71], [30, 71], [28, 94], [22, 94]];
const DELTOID: readonly Point[] = [[34, 37], [25, 40], [22, 52], [29, 53], [34, 44]];
const CALF: readonly Point[] = [[36, 152], [44, 152], [43, 185], [38, 185]];

const FRONT_REGIONS: readonly BodyRegion[] = [
  { group: "neck", view: "front", paired: false, points: [[45, 24], [55, 24], [56, 31], [44, 31]] },
  { group: "traps", view: "front", paired: true, points: [[44, 31], [34, 37], [41, 39], [50, 40]] },
  { group: "shoulders", view: "front", paired: true, points: DELTOID },
  { group: "chest", view: "front", paired: true, points: [[50, 40], [41, 39], [34, 44], [35, 56], [50, 58]] },
  { group: "biceps", view: "front", paired: true, points: ARM_BICEPS },
  { group: "forearms", view: "front", paired: true, points: ARM_FOREARM },
  { group: "abdominals", view: "front", paired: false, points: [[41, 59], [59, 59], [58, 92], [42, 92]] },
  { group: "abductors", view: "front", paired: true, points: [[33, 92], [41, 93], [40, 103], [33, 103]] },
  { group: "adductors", view: "front", paired: true, points: [[50, 100], [45, 108], [46, 130], [50, 130]] },
  { group: "quadriceps", view: "front", paired: true, points: [[33, 104], [43, 108], [44, 148], [36, 148]] },
  { group: "calves", view: "front", paired: true, points: CALF },
];

const BACK_REGIONS: readonly BodyRegion[] = [
  { group: "neck", view: "back", paired: false, points: [[45, 24], [55, 24], [56, 31], [44, 31]] },
  { group: "traps", view: "back", paired: true, points: [[44, 31], [34, 37], [39, 44], [50, 52]] },
  { group: "shoulders", view: "back", paired: true, points: DELTOID },
  { group: "middle back", view: "back", paired: true, points: [[50, 54], [43, 50], [44, 70], [50, 70]] },
  { group: "lats", view: "back", paired: true, points: [[33, 47], [41, 50], [42, 72], [36, 74], [33, 60]] },
  { group: "triceps", view: "back", paired: true, points: ARM_BICEPS },
  { group: "forearms", view: "back", paired: true, points: ARM_FOREARM },
  { group: "lower back", view: "back", paired: false, points: [[43, 72], [57, 72], [56, 90], [44, 90]] },
  { group: "abductors", view: "back", paired: true, points: [[32, 92], [37, 93], [35, 106], [32, 104]] },
  { group: "glutes", view: "back", paired: true, points: [[50, 92], [38, 93], [36, 106], [42, 112], [50, 108]] },
  { group: "hamstrings", view: "back", paired: true, points: [[33, 114], [44, 114], [45, 148], [36, 148]] },
  { group: "calves", view: "back", paired: true, points: CALF },
];

const REGIONS_BY_VIEW: Record<BodyView, readonly BodyRegion[]> = {
  front: FRONT_REGIONS,
  back: BACK_REGIONS,
};

export function regionsForView(view: BodyView): readonly BodyRegion[] {
  return REGIONS_BY_VIEW[view];
}

export function mirrorPoints(points: readonly Point[]): Point[] {
  return points.map(([x, y]): Point => [2 * MIRROR_AXIS_X - x, y]);
}

/** Every polygon to draw for a region: the authored shape plus its mirror when paired. */
export function polygonsForRegion(region: BodyRegion): Point[][] {
  const authored = [...region.points];
  return region.paired ? [authored, mirrorPoints(region.points)] : [authored];
}

export function outlinePoints(): Point[] {
  return [...OUTLINE_HALF, ...mirrorPoints(OUTLINE_HALF).reverse()];
}

/** Muscle groups drawn in at least one view; used to prove the map covers the type. */
export function mappedGroups(): Set<MuscleGroup> {
  return new Set([...FRONT_REGIONS, ...BACK_REGIONS].map((region) => region.group));
}

export function toSvgPoints(points: readonly Point[]): string {
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}
