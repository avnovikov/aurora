// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { SEED_GRAPH } from "../../src/data/seed";
import { mountLibraryDetail } from "../../src/library/libraryDetail";

describe("level source, retest and suggestion (#112)", () => {
  it("renders them and Set declares the suggested tier", () => {
    const exercise = SEED_GRAPH.pullup;
    const root = document.createElement("div");
    const calls: [string, string][] = [];
    mountLibraryDetail(root, {
      exercise,
      catalogueById: SEED_GRAPH,
      scrollToTop: false,
      actions: {
        onBack: () => {},
        onOpenExercise: () => {},
        onDeclareTier: (id, tier) => calls.push([id, tier]),
      },
      memory: {
        source: { label: "Your pick", retest: true },
        suggestion: { tier: "intermediate", testedFamilies: 2, totalFamilies: 6 },
      },
    });
    expect(root.querySelector("[data-level-source]")?.textContent).toContain("Your pick");
    expect(root.querySelector("[data-level-retest]")).not.toBeNull();
    expect(root.querySelector("[data-level-suggestion]")?.textContent).toContain("2 of 6 related families tested");
    root.querySelector<HTMLButtonElement>("[data-accept-suggestion]")?.click();
    expect(calls).toEqual([[exercise.id, "intermediate"]]);
  });
});
