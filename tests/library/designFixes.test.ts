import { describe, expect, it } from "vitest";
import type { JointHistoryEntry } from "../../src/domain/program";
import { MUSCLE_BUCKETS } from "../../src/library/facets";
import { DEFAULT_FILTERS, hasActiveFilters, resultCountHtml } from "../../src/library/filterPanels";
import { detailHtml } from "../../src/library/libraryDetail";
import { listHtml } from "../../src/library/libraryList";
import { exerciseMetaLine } from "../../src/library/metaLine";
import { searchExercises } from "../../src/library/search";
import { LIBRARY_CATALOGUE } from "../../src/data/libraryCatalogue";
import { exerciseNamed as find } from "../helpers/exercises";

const KNEES: JointHistoryEntry[] = [{ joint: "knee", side: "both", kind: "other" }];
const base = { text: "", level: "all" as const };
const defaults = { ...DEFAULT_FILTERS };

describe("result count and Clear filters (#37)", () => {
  it("counts the rows shown, singular for one", () => {
    expect(resultCountHtml(38, false)).toContain("38 exercises");
    expect(resultCountHtml(1, false)).toContain("1 exercise<");
    expect(resultCountHtml(38, false)).toContain('aria-live="polite"');
  });

  it("offers Clear filters only while a filter differs from its default", () => {
    expect(hasActiveFilters(defaults)).toBe(false);
    expect(resultCountHtml(5, false)).not.toContain("data-clear-filters");
    for (const change of [
      { level: "beginner" as const },
      { area: "upper" as const },
      { muscle: "back" as const },
      { stretch: "all" as const },
      { forJoints: true },
      { onlyGear: true },
    ]) {
      expect(hasActiveFilters({ ...defaults, ...change }), JSON.stringify(change)).toBe(true);
    }
    expect(resultCountHtml(5, true)).toContain("data-clear-filters");
  });

  it("puts the count above the filter panels, so it stays in view while tapping chips", () => {
    const results = searchExercises(LIBRARY_CATALOGUE, { stretch: "hide" });
    const html = listHtml(results, new Set(), { ...base, area: "upper" });
    expect(html).toContain(`${results.length} exercises`);
    expect(html.indexOf("lib-count")).toBeLessThan(html.indexOf('data-panel="show"'));
    expect(html).toContain("data-clear-filters");
  });
});

describe("list rows (#37)", () => {
  it("describe moves in the filter vocabulary, not internal labels", () => {
    expect(exerciseMetaLine(find("Pull-up"))).toMatch(/^Upper body · Back · \w+ · needs bar$/);
    expect(exerciseMetaLine(find("Ring Dip"))).toContain("needs rings");
    const html = listHtml([find("Suspended crossess")], new Set(), base);
    expect(html).not.toMatch(/conditioning|general, legs|horizontal push/);
  });

  it("put the name first, then muted metadata, then the description", () => {
    const html = listHtml([find("Pull-up")], new Set(), base);
    const name = html.indexOf("<strong>");
    const meta = html.indexOf('class="lib-meta"');
    const desc = html.indexOf('class="lib-desc"');
    expect(name).toBeGreaterThan(-1);
    expect(name).toBeLessThan(meta);
    expect(meta).toBeLessThan(desc);
  });

  it("no longer colour-code rows by the removed core region", () => {
    expect(listHtml([find("Hollow body hold")], new Set(), base)).not.toContain("core-hit");
  });
});

describe("filter clarity and accessibility (#37)", () => {
  const html = listHtml([], new Set(), base, KNEES);

  it("labels each chip row", () => {
    for (const label of ["Limit to", "Stretches", "Area", "Primary muscle"]) {
      expect(html).toContain(`<p class="chip-row-label">${label}</p>`);
    }
  });

  it("groups each chip row so its name is announced", () => {
    for (const name of ["Stretches", "Body area", "Primary muscle", "Skill level"]) {
      expect(html).toContain(`role="group" aria-label="${name}"`);
    }
  });

  it("no longer shows Core twice: the muscle bucket says what it is", () => {
    expect(MUSCLE_BUCKETS.find((bucket) => bucket.id === "core")?.label).toBe("Abs & lower back");
  });

  it("names the stretch choices by what they do", () => {
    expect(html).toContain("Hide stretches");
    expect(html).toContain("Only stretches");
    expect(html).toContain("Include stretches");
  });

  it("exposes selection to assistive tech on every chip and toggle", () => {
    const buttons = html.match(/<button type="button" data-(?!exercise-id|clear)[^>]*>/g) ?? [];
    expect(buttons.length).toBeGreaterThan(20);
    expect(buttons.every((tag) => /aria-pressed="(true|false)"/.test(tag))).toBe(true);
    expect(html).toMatch(/data-stretch="hide" class="selected" aria-pressed="true"/);
  });

  it("marks on/off toggles differently from pick-one chips", () => {
    expect(html).toMatch(/data-for-joints class="" data-kind="toggle" aria-pressed="false"/);
    expect(html).toMatch(/data-only-gear class="" data-kind="toggle"/);
    expect(html).not.toMatch(/data-area="[^"]+"[^>]*data-kind="toggle"/);
  });
});

describe("detail page (#37)", () => {
  it("merges the joint verdict and the general safety notes into one block", () => {
    const html = detailHtml(find("Cossack squat"), new Set(), {}, {}, KNEES);
    expect(html.match(/class="joint-caution"/g)).toHaveLength(1);
    expect(html).toContain("For your joints");
    expect(html).toContain("General safety");
    expect(html).not.toMatch(/<p class="eyebrow">Safety<\/p>/);
  });

  it("keeps a plain Safety block when the move is fine for the user", () => {
    const html = detailHtml(find("Bench Dip"), new Set(), {}, {}, []);
    expect(html).toMatch(/<p class="eyebrow">Safety<\/p>/);
    expect(html).not.toContain("joint-caution");
  });

  it("uses the list vocabulary and drops Pattern and Regions", () => {
    const html = detailHtml(find("Pull-up"), new Set(), {}, {}, []);
    expect(html).toMatch(/class="lib-meta">Upper body · Back/);
    expect(html).not.toMatch(/Pattern:|Regions:/);
  });

  it("shows plan actions right after the summary, before media and how-to", () => {
    const html = detailHtml(find("Pistol squat"), new Set(), {}, {}, []);
    const plan = html.indexOf("data-generate-plan");
    expect(plan).toBeGreaterThan(-1);
    expect(plan).toBeLessThan(html.indexOf("How to"));
    expect(html.indexOf("lib-summary")).toBeLessThan(plan);
  });
});

describe("tab bar (#37)", () => {
  it("marks the active tab for assistive tech", async () => {
    const { renderShell } = await import("../../src/ui/shell");
    const root = { innerHTML: "", querySelectorAll: () => [] } as unknown as HTMLElement;
    renderShell(root, "library", "", () => undefined);
    expect(root.innerHTML).toMatch(/data-tab="library" aria-current="page"/);
    expect(root.innerHTML.match(/aria-current/g)).toHaveLength(1);
  });
});
