import { describe, expect, it } from "vitest";
import {
  filterPanelsHtml,
  stretchHintHtml,
  withPanelState,
} from "../../src/library/filterPanels";
import { listHtml } from "../../src/library/libraryList";
import {
  BASE_QUERY as base,
  filterTrigger,
  KNEE_HISTORY,
  openPanelIds,
  PANEL_STATE as state,
  SHOW_ALL,
  SHOW_NONE,
} from "../helpers/libraryFilters";

/** Panel ids in document order. */
const panelIds = (html: string): string[] =>
  [...html.matchAll(/<details class="lib-filters" data-panel="(\w+)"/g)].map((m) => m[1]!);

describe("filter panels", () => {
  const html = listHtml([], new Set(), base, { jointHistory: KNEE_HISTORY });

  it("has three panels in order: aux, area & muscle, level", () => {
    expect(panelIds(html)).toEqual(["show", "body", "level"]);
    expect(filterTrigger(html, "show").label).toBe("Show");
    expect(filterTrigger(html, "body").label).toBe("Area &amp; muscle");
    expect(filterTrigger(html, "level").label).toBe("Level");
  });

  it("no longer shows the region chips", () => {
    expect(html).not.toContain("data-region");
    expect(html).not.toContain("data-regions");
    expect(html).not.toContain("Core is an area filter");
  });

  it("puts joints, gear and stretches in the one aux panel", () => {
    const show = html.slice(html.indexOf('data-panel="show"'), html.indexOf('data-panel="body"'));
    expect(show).toContain("data-for-joints");
    expect(show).toContain("data-only-gear");
    expect(show).toContain('data-stretch="hide"');
    expect(html.indexOf("data-for-joints")).toBeLessThan(html.indexOf('data-panel="body"'));
  });

  it("puts levels in their own panel with an All chip, styled like the rest", () => {
    const level = html.slice(html.indexOf('data-panel="level"'));
    expect(level).toContain('data-level="all"');
    expect(level).toContain('data-level="beginner"');
    expect(level).toContain('data-level="elite"');
    expect(level).not.toContain('data-level="novice"');
    expect(html).not.toContain("lib-levels");
  });

  it("gives every panel the same markup shape", () => {
    expect(html.match(/<details class="lib-filters" data-panel="\w+" name="lib-filter"( open)?><summary>/g)).toHaveLength(3);
    expect(html.match(/<\/details>/g)).toHaveLength(3);
  });

  it("puts a Filters header and close control in every sheet", () => {
    const sheets = [...html.matchAll(/<div class="lib-sheet">([\s\S]*?)<\/div><\/details>/g)].map((m) => m[1]!);
    expect(sheets).toHaveLength(3);
    for (const sheet of sheets) {
      expect(sheet).toMatch(/<div class="lib-sheet-hdr">/);
      expect(sheet).toMatch(/<span class="t-label">Filters<\/span>/);
      expect(sheet).toMatch(
        /<button type="button" class="lib-sheet-close" data-close-filters aria-label="Close filters">×<\/button>/,
      );
      const bodyStart = Math.min(
        ...["chip-row-label", "data-kind", "role=\"group\""]
          .map((needle) => sheet.indexOf(needle))
          .filter((index) => index >= 0),
      );
      expect(sheet.indexOf("lib-sheet-hdr")).toBeLessThan(bodyStart);
    }
  });

  it("collapses all three by default, even with the stretch default selected", () => {
    expect(openPanelIds(html)).toEqual([]);
    expect(html).toMatch(/data-stretch="hide" class="selected"/);
  });

  it("only offers For my joints when there is joint history", () => {
    expect(listHtml([], new Set(), base)).not.toContain("data-for-joints");
  });
});

describe("panel summaries and open state", () => {
  it("names what is active on the trigger, without opening the sheet over the list", () => {
    const html = filterPanelsHtml(
      { ...state, forJoints: true, onlyGear: true, stretch: "only", level: "beginner" },
      SHOW_ALL,
    );
    expect(filterTrigger(html, "show").value).toBe("My joints · My gear · Only stretches");
    expect(filterTrigger(html, "level").value).toBe("Beginner");
    expect(openPanelIds(html)).toEqual([]);
  });

  it("always names the stretch choice, the default included", () => {
    expect(filterTrigger(filterPanelsHtml({ ...state, stretch: "all" }, SHOW_NONE), "show").value).toBe("Include stretches");
    expect(filterTrigger(filterPanelsHtml({ ...state, stretch: "hide" }, SHOW_NONE), "show").value).toBe("Hide stretches");
  });

  it("keeps a panel the user opened open, even when nothing is active", () => {
    const html = filterPanelsHtml({ ...state, openPanels: ["level"] }, SHOW_NONE);
    expect(openPanelIds(html)).toEqual(["level"]);
    expect(filterTrigger(html, "level").value).toBe("All levels");
  });
});

describe("hidden-stretch hint", () => {
  it("sits in the dock under the search box, outside the collapsed panels", () => {
    const html = listHtml([], new Set(), { ...base, hiddenStretches: 2 });
    expect(html).toContain("2 stretches match — show");
    expect(html.indexOf("match — show")).toBeLessThan(html.indexOf('data-panel="show"'));
    expect(html.indexOf("data-search")).toBeLessThan(html.indexOf("match — show"));
  });

  it("is empty with nothing hidden and singular for one", () => {
    expect(stretchHintHtml(0)).toBe("");
    expect(stretchHintHtml(1)).toContain("1 stretch match — show");
  });
});

describe("withPanelState", () => {
  it("adds an opened panel once and keeps the others", () => {
    expect(withPanelState([], "show", true)).toEqual(["show"]);
    expect(withPanelState(["show"], "level", true)).toEqual(["show", "level"]);
    expect(withPanelState(["show", "level"], "show", true)).toEqual(["level", "show"]);
  });

  it("removes a closed panel and ignores one that was not open", () => {
    expect(withPanelState(["show", "level"], "show", false)).toEqual(["level"]);
    expect(withPanelState(["level"], "body", false)).toEqual(["level"]);
  });

  it("does not mutate its input", () => {
    const open = ["show"] as const;
    withPanelState(open, "level", true);
    expect(open).toEqual(["show"]);
  });

  it("keeps a typed-into search from collapsing an opened panel (the render reads this state)", () => {
    const afterOpen = withPanelState([], "body", true);
    const html = filterPanelsHtml({ ...state, openPanels: afterOpen }, SHOW_NONE);
    expect(openPanelIds(html)).toEqual(["body"]);
  });
});
