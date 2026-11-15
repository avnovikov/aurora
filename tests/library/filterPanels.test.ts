import { describe, expect, it } from "vitest";
import type { JointHistoryEntry } from "../../src/domain/program";
import {
  filterPanelsHtml,
  stretchHintHtml,
  withPanelState,
} from "../../src/library/filterPanels";
import { listHtml } from "../../src/library/libraryList";

const base = { text: "", level: "all" as const };
const HISTORY: JointHistoryEntry[] = [{ joint: "knee", side: "both", kind: "other" }];

/** Panel ids in document order. */
const panelIds = (html: string): string[] =>
  [...html.matchAll(/<details class="lib-filters" data-panel="(\w+)"/g)].map((m) => m[1]!);

describe("filter panels", () => {
  const html = listHtml([], new Set(), base, HISTORY);

  it("has three panels in order: aux, area & muscle, level", () => {
    expect(panelIds(html)).toEqual(["show", "body", "level"]);
    expect(html).toMatch(/<summary>Show<\/summary>/);
    expect(html).toMatch(/<summary>Area &amp; muscle<\/summary>/);
    expect(html).toMatch(/<summary>Level<\/summary>/);
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
    expect(html.match(/<details class="lib-filters" data-panel="\w+"( open)?><summary>/g)).toHaveLength(3);
    expect(html.match(/<\/details>/g)).toHaveLength(3);
  });

  it("collapses all three by default, even with the stretch default selected", () => {
    expect(html).not.toMatch(/data-panel="\w+" open/);
    expect(html).toMatch(/data-stretch="hide" class="selected"/);
  });

  it("only offers For my joints when there is joint history", () => {
    expect(listHtml([], new Set(), base, [])).not.toContain("data-for-joints");
  });
});

describe("panel summaries and open state", () => {
  const state = {
    level: "all" as const,
    area: "all" as const,
    muscle: "all" as const,
    stretch: "hide" as const,
    forJoints: false,
    onlyGear: false,
    openPanels: [] as never[],
  };

  it("names what is active and opens that panel", () => {
    const html = filterPanelsHtml(
      { ...state, forJoints: true, onlyGear: true, stretch: "only", level: "beginner" },
      true,
    );
    expect(html).toContain("Show · my joints, my gear, stretches only");
    expect(html).toContain("Level · Beginner");
    expect(html).toMatch(/data-panel="show" open/);
    expect(html).toMatch(/data-panel="level" open/);
    expect(html).not.toMatch(/data-panel="body" open/);
  });

  it("treats every stretch choice but the default as active", () => {
    expect(filterPanelsHtml({ ...state, stretch: "all" }, false)).toContain("Show · everything");
    expect(filterPanelsHtml({ ...state, stretch: "hide" }, false)).toContain("<summary>Show</summary>");
  });

  it("keeps a panel the user opened open, even when nothing is active", () => {
    const html = filterPanelsHtml({ ...state, openPanels: ["level"] as never[] }, false);
    expect(html).toMatch(/data-panel="level" open/);
    expect(html).toContain("<summary>Level</summary>");
    expect(html).not.toMatch(/data-panel="show" open/);
  });
});

describe("hidden-stretch hint", () => {
  it("sits under the search box, outside the collapsed panels", () => {
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
    const html = filterPanelsHtml(
      {
        level: "all",
        area: "all",
        muscle: "all",
        stretch: "hide",
        forJoints: false,
        onlyGear: false,
        openPanels: afterOpen,
      },
      false,
    );
    expect(html).toMatch(/data-panel="body" open/);
  });
});
