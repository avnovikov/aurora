import { describe, expect, it } from "vitest";
import { detailHtml } from "../../src/library/libraryDetail";
import {
  formatPersonalBestValue,
  personalBestHeroHtml,
  personalBestProgressHtml,
  personalBestUnit,
} from "../../src/library/personalBest";
import { EXERCISE_GRAPH } from "../../src/data/exerciseGraph";
import { SESSION_TEMPLATES } from "../../src/data/seed";
import { emptyMemory } from "../../src/session/history";
import { buildPlanProgress } from "../../src/progress/planProgress";

describe("personalBest helpers", () => {
  it("formats hold and rep units", () => {
    expect(personalBestUnit({ effort: "hold" })).toBe("s");
    expect(personalBestUnit({})).toBe("reps");
    expect(formatPersonalBestValue(12)).toBe("12");
    expect(formatPersonalBestValue(40)).toBe("40");
  });

  it("renders a Library hero with empty and filled states", () => {
    expect(personalBestHeroHtml(undefined, "reps")).toContain("No personal best yet");
    const filled = personalBestHeroHtml(12, "reps");
    expect(filled).toContain("data-personal-best");
    expect(filled).toContain(">12<");
    expect(filled).toContain("reps");
  });

  it("renders a compact Progress line only when a PB exists", () => {
    expect(personalBestProgressHtml(undefined, "reps")).toBe("");
    expect(personalBestProgressHtml(20, "s")).toBe(
      `<p class="personal-best-inline">PB · 20s</p>`,
    );
  });
});

describe("Library detail personal best", () => {
  it("shows the hero and does not use Best logged hint", () => {
    const exercise = EXERCISE_GRAPH.wall_handstand!;
    const html = detailHtml(exercise, { memory: { bestReps: 25 } });
    expect(html).toContain("data-personal-best");
    expect(html).toContain("Personal best");
    expect(html).not.toContain("Best logged");
  });
});

describe("Progress path personal best", () => {
  it("attaches bestReps for the current path step", () => {
    const memories = {
      wall_handstand: {
        ...emptyMemory("wall_handstand"),
        bestReps: 30,
        sessionsAtStandard: 1,
      },
    };
    const model = buildPlanProgress({
      templates: SESSION_TEMPLATES.filter((t) => t.id === "tmpl_skill_hs"),
      graph: EXERCISE_GRAPH,
      memories,
    });
    const hs = model.cards.find((card) => card.targetId === "freestanding_hs");
    expect(hs?.personalBestReps).toBe(30);
    expect(hs?.personalBestIsHold).toBe(true);
  });
});
