import { describe, expect, it } from "vitest";
import { formatMuscles, formatPattern } from "../../src/library/present";

describe("formatPattern", () => {
  it("replaces underscores for display", () => {
    expect(formatPattern("core_anti_extension")).toBe("core anti extension");
  });
});

describe("formatMuscles", () => {
  it("uses British stabiliser spelling", () => {
    const text = formatMuscles([
      { group: "shoulders", role: "stabilizer" },
      { group: "chest", role: "primary" },
    ]);
    expect(text).toContain("stabiliser");
    expect(text).toContain("primary");
  });
});