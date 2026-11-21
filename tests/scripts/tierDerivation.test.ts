import { describe, expect, it } from "vitest";
import {
  deriveChains,
  stepBand,
  stepFromLinks,
  stepFromMethod,
  variantOrderViolations,
  type Anchor,
  type Band,
} from "../../scripts/lib/tierDerivation";

const PULL_UP: Band = [3, 4, 8, 13, 18];

describe("stepBand (#262)", () => {
  it("an easier variant is the parent ×1.2, rounded up", () => {
    expect(stepBand(PULL_UP, "easier", "reps")).toEqual([4, 5, 10, 16, 22]);
  });

  it("a harder variant is the parent ÷1.2, rounded down, at least 1 and strictly increasing", () => {
    expect(stepBand(PULL_UP, "harder", "reps")).toEqual([2, 3, 6, 10, 15]);
    // 1/2 ÷ 1.2 floors to 0/1: raised to 1, then 2 so the tiers still climb.
    expect(stepBand([1, 2, 5, 9, 15], "harder", "reps")).toEqual([1, 2, 4, 7, 12]);
  });

  it("same copies the parent", () => {
    expect(stepBand(PULL_UP, "same", "reps")).toEqual(PULL_UP);
  });

  it("holds of 10 s or more round to 5 s in the step's direction", () => {
    expect(stepBand([37, 55, 105, 165, 270], "easier", "hold")).toEqual([45, 70, 130, 200, 325]);
    expect(stepBand([37, 55, 105, 165, 270], "harder", "hold")).toEqual([30, 45, 85, 135, 225]);
    // Under 10 s stays in whole seconds.
    expect(stepBand([3, 5, 10, 20, 30], "harder", "hold")).toEqual([2, 4, 8, 15, 25]);
  });

  it("keeps the order with the parent by construction: easier ≥ parent ≥ harder at every tier", () => {
    const parents: Band[] = [PULL_UP, [1, 2, 3, 4, 5], [16, 24, 40, 60, 85], [10, 20, 45, 60, 90]];
    for (const parent of parents) {
      for (const effort of ["reps", "hold"] as const) {
        const easier = stepBand(parent, "easier", effort);
        const harder = stepBand(parent, "harder", effort);
        parent.forEach((value, i) => {
          expect(easier[i]).toBeGreaterThanOrEqual(value);
          expect(harder[i]).toBeLessThanOrEqual(value);
        });
        for (const band of [easier, harder]) {
          for (let i = 1; i < band.length; i += 1) {
            expect(band[i]).toBeGreaterThan(band[i - 1]!);
          }
        }
      }
    }
  });
});

describe("deriveChains (#262)", () => {
  const anchors = new Map<string, Anchor>([["pullup", { band: PULL_UP, effort: "reps" }]]);

  it("walks out from the anchors, every parent before its children", () => {
    const { bands, order } = deriveChains(anchors, [
      { id: "one_arm", parentId: "archer", step: "harder", effort: "reps" },
      { id: "archer", parentId: "pullup", step: "harder", effort: "reps" },
      { id: "jumping", parentId: "pullup", step: "easier", effort: "reps" },
    ]);
    expect(order).toEqual(["archer", "jumping", "one_arm"]);
    expect(bands.get("archer")).toEqual([2, 3, 6, 10, 15]);
    expect(bands.get("one_arm")).toEqual(stepBand([2, 3, 6, 10, 15], "harder", "reps"));
  });

  it("fails loudly on a cycle", () => {
    expect(() =>
      deriveChains(anchors, [
        { id: "a", parentId: "b", step: "harder", effort: "reps" },
        { id: "b", parentId: "a", step: "easier", effort: "reps" },
      ]),
    ).toThrow(/Cycle/);
  });

  it("fails on an unknown parent or a parent with another effort", () => {
    expect(() => deriveChains(anchors, [{ id: "a", parentId: "nope", step: "harder", effort: "reps" }])).toThrow(
      /neither an anchor nor derived/,
    );
    expect(() => deriveChains(anchors, [{ id: "a", parentId: "pullup", step: "harder", effort: "hold" }])).toThrow(
      /cannot derive/,
    );
  });
});

describe("step direction (#262)", () => {
  it("reads easier or harder from the catalogue links, either side", () => {
    expect(stepFromLinks({ id: "hindu", easierId: "push" }, { id: "push" })).toBe("harder");
    expect(stepFromLinks({ id: "hindu" }, { id: "push", harderId: "hindu" })).toBe("harder");
    expect(stepFromLinks({ id: "knee", harderId: "push" }, { id: "push" })).toBe("easier");
    expect(stepFromLinks({ id: "a" }, { id: "b" })).toBeNull();
  });

  it("falls back to the method text", () => {
    expect(stepFromMethod("Harder variant: parent / 1.2, floored.")).toBe("harder");
    expect(stepFromMethod("Easier variant, parent x1.2 ceil.")).toBe("easier");
    expect(stepFromMethod("Kept parent Bicycle Crunch standard x1.0.")).toBe("same");
    expect(stepFromMethod("No norms found.")).toBeNull();
    expect(stepFromMethod("Easier than the pistol, harder than the step-up.")).toBeNull();
  });

  it("lists easier → harder pairs where the easier move is lower at some tier", () => {
    const bands: Record<string, Band> = { a: [5, 6, 7, 8, 9], b: [4, 7, 7, 8, 9], c: [1, 2, 3, 4, 5] };
    const bandOf = (id: string) => (bands[id] ? { band: bands[id]!, effort: "reps" as const } : undefined);
    expect(
      variantOrderViolations(
        [
          ["a", "b"],
          ["a", "c"],
          ["a", "missing"],
        ],
        bandOf,
      ),
    ).toEqual(["a > b"]);
  });
});
