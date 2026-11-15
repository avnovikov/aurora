import { describe, expect, it } from "vitest";
import {
  BODY_VIEWBOX,
  mappedGroups,
  mirrorPoints,
  outlinePoints,
  polygonsForRegion,
  regionsForView,
  type BodyView,
  type Point,
} from "../../src/body/silhouette";
import type { MuscleGroup } from "../../src/domain/types";

const ALL_GROUPS: MuscleGroup[] = [
  "abdominals", "abductors", "adductors", "biceps", "calves", "chest",
  "forearms", "glutes", "hamstrings", "lats", "lower back", "middle back",
  "neck", "quadriceps", "shoulders", "traps", "triceps",
];

const VIEWS: BodyView[] = ["front", "back"];

function everyPoint(): Point[] {
  return [...VIEWS.flatMap((view) => regionsForView(view).flatMap(polygonsForRegion).flat()), ...outlinePoints()];
}

describe("body silhouette", () => {
  it("maps every muscle group to at least one view", () => {
    expect([...mappedGroups()].sort()).toEqual([...ALL_GROUPS].sort());
  });

  it("keeps every vertex inside the viewBox", () => {
    for (const [x, y] of everyPoint()) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(BODY_VIEWBOX.width);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(BODY_VIEWBOX.height);
    }
  });

  it("mirrors across the centre line", () => {
    expect(mirrorPoints([[30, 10], [50, 20]])).toEqual([[70, 10], [50, 20]]);
  });

  it("emits two polygons for paired regions and one for centre regions", () => {
    const front = regionsForView("front");
    const paired = front.find((region) => region.group === "chest")!;
    const centre = front.find((region) => region.group === "abdominals")!;
    expect(polygonsForRegion(paired)).toHaveLength(2);
    expect(polygonsForRegion(centre)).toHaveLength(1);
  });

  it("keeps centre regions symmetric about x = 50", () => {
    for (const view of VIEWS) {
      for (const region of regionsForView(view).filter((item) => !item.paired)) {
        const xs = region.points.map(([x]) => x);
        expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(50, 5);
      }
    }
  });
});
