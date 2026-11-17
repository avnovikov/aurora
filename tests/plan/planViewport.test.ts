import { describe, expect, it, vi } from "vitest";
import { DEFAULT_PLAN_QUEUE } from "../../src/data/seed";
import { buildPlanModel, type PlanUiState } from "../../src/ui/planModel";
import { planPageHtml } from "../../src/ui/planPage";
import { resetTabScroll } from "../../src/ui/tabScroll";
import { useMemoryStorage } from "../helpers/storage";

useMemoryStorage(() => ({ "aurora.poc.planQueue.v1": JSON.stringify(DEFAULT_PLAN_QUEUE) }));

const ui = (over: Partial<PlanUiState> = {}): PlanUiState => ({
  openDays: new Set([0]),
  swap: null,
  openExercises: new Set(),
  addOpen: false,
  levelOpen: false,
  ...over,
});

describe("Plan first viewport (#124)", () => {
  it("keeps Make this day and Move behind a closed disclosure so an open day stays short", () => {
    const html = planPageHtml(buildPlanModel(DEFAULT_PLAN_QUEUE, {
      memories: {},
      history: [],
      jointHistory: [],
      equipment: ["body", "bar", "sliders"],
      excluded: [],
      deloadActive: false,
    }, ui()));

    expect(html).toContain('class="plan-day-edit"');
    expect(html).toContain("<summary>Change or move</summary>");
    expect(html).toMatch(
      /<details class="plan-day-edit"[\s\S]*?Make this day[\s\S]*?Move this day[\s\S]*?>Remove<\/button>[\s\S]*?<\/details>/,
    );
    expect(html).not.toMatch(/<details class="plan-day-edit"[^>]*\sopen[\s>]/);
  });

  it("resets window scroll when a main tab opens", () => {
    const scrollTo = vi.fn();
    resetTabScroll({ scrollTo });
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });
});
