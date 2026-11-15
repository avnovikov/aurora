import { describe, expect, it } from "vitest";
import { exerciseNameKey } from "../../src/data/nameKey";

describe("exerciseNameKey", () => {
  it("collapses punctuation, case and plurals", () => {
    expect(exerciseNameKey("Push-Ups")).toBe(exerciseNameKey("push up"));
    expect(exerciseNameKey("Mountain Climbers")).toBe(exerciseNameKey("Mountain Climber"));
    expect(exerciseNameKey("Ring Dips")).toBe(exerciseNameKey("Ring Dip"));
    expect(exerciseNameKey("Crunches")).toBe(exerciseNameKey("Crunch"));
    expect(exerciseNameKey("World's Greatest Stretch")).toBe(
      exerciseNameKey("Worlds greatest stretch"),
    );
  });

  it("keeps distinct moves distinct", () => {
    expect(exerciseNameKey("Glute Bridge")).not.toBe(exerciseNameKey("Single Leg Glute Bridge"));
    expect(exerciseNameKey("Press")).not.toBe(exerciseNameKey("Pres"));
  });
});
