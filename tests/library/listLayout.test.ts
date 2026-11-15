import { describe, expect, it } from "vitest";
import type { JointHistoryEntry } from "../../src/domain/program";
import { DEFAULT_FILTERS, filterPanelsHtml } from "../../src/library/filterPanels";
import { listHtml } from "../../src/library/libraryList";
import { exerciseMetaHtml, exerciseMetaLine } from "../../src/library/metaLine";
import { exerciseNamed as find } from "../helpers/exercises";

const base = { text: "", level: "all" as const };
const KNEES: JointHistoryEntry[] = [{ joint: "knee", side: "both", kind: "other" }];
const state = { ...DEFAULT_FILTERS, openPanels: [] as never[] };
const SHOW_NONE = { hasJointHistory: false, hasExcluded: false };

/** The trigger text (label, value) of one panel's summary. */
function trigger(html: string, panel: string): [string, string] {
  const match = new RegExp(
    `data-panel="${panel}"[^>]*><summary[^>]*><span class="t-label">([^<]*)</span><span class="t-val">([^<]*)</span></summary>`,
  ).exec(html);
  expect(match, panel).not.toBeNull();
  return [match![1]!, match![2]!];
}

describe("Library list layout", () => {
  const pullUp = find("Pull-up");
  const html = listHtml([pullUp, find("Hollow body hold")], new Set(), base);

  it("heads the screen with the eyebrow, title and the count as the accent figure", () => {
    const header = html.slice(html.indexOf("<header"), html.indexOf("</header>"));
    expect(header).toContain('<p class="eyebrow">Library</p>');
    expect(header).toContain("<h1>Exercises</h1>");
    expect(header).toMatch(/class="lib-count" aria-live="polite"><span class="n">2<\/span> exercises/);
  });

  it("puts the list first and the search and filter dock after it, within thumb reach", () => {
    const list = html.indexOf('class="lib-list"');
    const dock = html.indexOf('class="lib-dock"');
    expect(list).toBeGreaterThan(html.indexOf("</header>"));
    expect(dock).toBeGreaterThan(list);
    expect(html.indexOf("data-search")).toBeGreaterThan(dock);
    expect(html.indexOf('data-panel="show"')).toBeGreaterThan(html.indexOf("data-search"));
  });

  it("gives the search box an accessible name", () => {
    expect(html).toMatch(/<input[^>]*aria-label="Search exercises"[^>]*data-search/);
  });

  it("emphasises the level in each row's meta line", () => {
    expect(html).toContain(`<span class="lvl">`);
    expect(exerciseMetaHtml(pullUp)).toMatch(/^Upper body · Back · <span class="lvl">\w+<\/span> · needs bar$/);
    // Same words as the plain line the detail page uses.
    const plain = exerciseMetaHtml(pullUp).replace('<span class="lvl">', "").replace("</span>", "");
    expect(plain).toBe(exerciseMetaLine(pullUp));
  });

  it("keeps the row hook, name, meta and description", () => {
    expect(html).toMatch(/<button type="button" class="lib-row" data-exercise-id="[^"]+">\s*<strong>/);
    expect(html).toContain('class="lib-desc"');
  });
});

describe("filter triggers show their current value", () => {
  it("reads the defaults", () => {
    const html = filterPanelsHtml(state, SHOW_NONE);
    expect(trigger(html, "show")).toEqual(["Show", "Hide stretches"]);
    expect(trigger(html, "body")).toEqual(["Area &amp; muscle", "All areas · All muscles"]);
    expect(trigger(html, "level")).toEqual(["Level", "All levels"]);
  });

  it("reads the chosen values", () => {
    const html = filterPanelsHtml(
      { ...state, forJoints: true, onlyGear: true, stretch: "only", area: "upper", level: "beginner" },
      { hasJointHistory: true, hasExcluded: false },
    );
    expect(trigger(html, "show")).toEqual(["Show", "My joints · My gear · Only stretches"]);
    expect(trigger(html, "body")).toEqual(["Area &amp; muscle", "Upper body · All muscles"]);
    expect(trigger(html, "level")).toEqual(["Level", "Beginner"]);
  });

  it("opens a panel only when the user opened it, one at a time", () => {
    const active = filterPanelsHtml({ ...state, level: "beginner" }, SHOW_NONE);
    expect(active).not.toMatch(/data-panel="\w+"[^>]* open/);
    const opened = filterPanelsHtml({ ...state, openPanels: ["body"] as never[] }, SHOW_NONE);
    expect(opened).toMatch(/data-panel="body"[^>]* open/);
    expect(opened.match(/name="lib-filter"/g)).toHaveLength(3);
  });

  it("puts each panel's chips in a sheet", () => {
    const html = listHtml([], new Set(), base, { jointHistory: KNEES });
    expect(html.match(/<div class="lib-sheet">/g)).toHaveLength(3);
  });
});
