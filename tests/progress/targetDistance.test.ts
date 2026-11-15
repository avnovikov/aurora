import { describe, expect, it } from "vitest";
import { distanceToTarget } from "../../src/progress/targetDistance";

describe("distanceToTarget", () => {
  it("counts steps from bodyweight squat toward pistol", () => {
    const distance = distanceToTarget("bodyweight_squat", "pistol_squat");
    expect(distance.reachable).toBe(true);
    expect(distance.stepsToTarget).toBe(2);
  });

  it("returns zero when already on the target", () => {
    const distance = distanceToTarget("pistol_squat", "pistol_squat");
    expect(distance.stepsToTarget).toBe(0);
  });
});
