import { describe, expect, it } from "vitest";
import { buildFamilyLadderIndex } from "../../src/progress/familyLadderIndex";

describe("buildFamilyLadderIndex", () => {
  it("rejects duplicate catalogue ids", () => {
    expect(() =>
      buildFamilyLadderIndex([
        { id: "x", name: "Plank" },
        { id: "x", name: "Plank" },
      ]),
    ).toThrow(/Duplicate exercise id/);
  });
});
