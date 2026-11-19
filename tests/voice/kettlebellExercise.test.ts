import { describe, expect, it } from "vitest";
import { isKettlebellExercise } from "../../src/voice/kettlebellExercise";

describe("isKettlebellExercise", () => {
  it("matches kettlebell / kettlebells in the name", () => {
    expect(isKettlebellExercise({ name: "Kettlebell Swing" })).toBe(true);
    expect(isKettlebellExercise({ name: "Two kettlebells clean" })).toBe(true);
  });

  it("rejects dumbbell-only and bodyweight names", () => {
    expect(isKettlebellExercise({ name: "Dumbbell Row" })).toBe(false);
    expect(isKettlebellExercise({ name: "Pull-up" })).toBe(false);
  });

  it("rejects empty names", () => {
    expect(() => isKettlebellExercise({ name: "" })).toThrow(/non-empty/);
    expect(() => isKettlebellExercise({ name: "   " })).toThrow(/non-empty/);
  });
});
