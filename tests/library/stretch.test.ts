import { describe, expect, it } from "vitest";
import { LIBRARY_CATALOGUE } from "../../src/data/libraryCatalogue";
import type { JointHistoryEntry } from "../../src/domain/program";
import { STRETCH_FILTERS, isStretch } from "../../src/library/facets";
import { listHtml } from "../../src/library/libraryList";
import { selectLibraryResults } from "../../src/library/results";
import { searchExercises } from "../../src/library/search";
import { exerciseNamed as find } from "../helpers/exercises";

const SHOULDER: JointHistoryEntry = { joint: "shoulder", side: "left", kind: "dislocation" };

const input = (query: Parameters<typeof selectLibraryResults>[0]["query"], extra = {}) => ({
  catalogue: LIBRARY_CATALOGUE,
  query,
  forJoints: false,
  onlyGear: false,
  jointHistory: [] as JointHistoryEntry[],
  equipment: ["body", "bar"] as const,
  ...extra,
});

describe("isStretch", () => {
  it("is true for static holds and anything named stretch", () => {
    for (const name of ["Hamstring Stretch", "Child's Pose", "Pigeon Pose", "World's Greatest Stretch", "Front Split"]) {
      expect(isStretch(find(name)), name).toBe(true);
    }
  });

  it("is false for dynamic drills, strengthening holds and training moves", () => {
    for (const name of [
      "Hip circles", "Leg swings", "Cat-Cow", "Neck CARs", "Side-lying External Rotation",
      "Band pull-apart with external rotation", "Isometric Neck Exercise - Sides",
      "Single-Leg Balance with Eyes Closed", "Deep Squat Hold", "Standard Push-Up", "Pull-up", "Forearm Plank",
    ]) {
      expect(isStretch(find(name)), name).toBe(false);
    }
  });

  it("never marks a non-mobility move", () => {
    expect(LIBRARY_CATALOGUE.filter(isStretch).every((item) => item.pattern === "mobility")).toBe(true);
  });

  it("finds a meaningful number of stretches", () => {
    const count = LIBRARY_CATALOGUE.filter(isStretch).length;
    expect(count).toBeGreaterThan(100);
    expect(count).toBeLessThan(LIBRARY_CATALOGUE.length / 2);
  });
});

describe("stretch filter", () => {
  it("hide / only / all partition the catalogue", () => {
    const hide = searchExercises(LIBRARY_CATALOGUE, { stretch: "hide" });
    const only = searchExercises(LIBRARY_CATALOGUE, { stretch: "only" });
    const all = searchExercises(LIBRARY_CATALOGUE, { stretch: "all" });
    expect(hide.length + only.length).toBe(all.length);
    expect(all).toHaveLength(LIBRARY_CATALOGUE.length);
    expect(hide.some(isStretch)).toBe(false);
    expect(only.every(isStretch)).toBe(true);
  });

  it("is off when omitted, so existing callers are unchanged", () => {
    expect(searchExercises(LIBRARY_CATALOGUE, {})).toHaveLength(LIBRARY_CATALOGUE.length);
  });

  it("offers the three choices, hiding first", () => {
    expect(STRETCH_FILTERS.map((option) => option.id)).toEqual(["hide", "only", "all"]);
  });
});

describe("selectLibraryResults", () => {
  it("hides stretches by default but keeps mobility drills", () => {
    const { results } = selectLibraryResults(input({ stretch: "hide" }));
    expect(results.some(isStretch)).toBe(false);
    expect(results.some((item) => item.name === "Hip circles")).toBe(true);
  });

  it("reports hidden matches while searching so the UI can offer them", () => {
    const hidden = selectLibraryResults(input({ text: "hamstring", stretch: "hide" }));
    expect(hidden.hiddenStretches).toBeGreaterThan(0);
    expect(hidden.results.some(isStretch)).toBe(false);
    const shown = selectLibraryResults(input({ text: "hamstring", stretch: "all" }));
    expect(shown.hiddenStretches).toBe(0);
    expect(shown.results.length).toBeGreaterThanOrEqual(hidden.results.length + hidden.hiddenStretches);
    expect(selectLibraryResults(input({ stretch: "hide" })).hiddenStretches).toBe(0);
  });

  it("never applies the stretch filter to the curated joints list", () => {
    const names = selectLibraryResults(
      input({ stretch: "hide" }, { forJoints: true, jointHistory: [SHOULDER] }),
    ).results.map((item) => item.name);
    expect(names).toContain("Serratus Wall Slide Stretch");
  });

  it("still applies gear filtering", () => {
    const { results } = selectLibraryResults(input({ stretch: "all" }, { onlyGear: true, equipment: ["body"] }));
    expect(results.some((item) => item.name === "Pull-up")).toBe(false);
  });
});

describe("Library list stretch chips", () => {
  const base = { text: "", level: "all" as const };

  it("renders the three chips and marks the choice", () => {
    const html = listHtml([], new Set(), { ...base, stretch: "hide" });
    expect(html).toContain('data-stretch="hide" class="selected"');
    expect(html).toContain('data-stretch="only"');
    expect(html).toContain("No stretches");
  });

  it("offers to show hidden matches", () => {
    expect(listHtml([], new Set(), { ...base, stretch: "hide", hiddenStretches: 3 })).toContain(
      "3 stretches match — show",
    );
    expect(listHtml([], new Set(), { ...base, stretch: "hide", hiddenStretches: 1 })).toContain(
      "1 stretch match — show",
    );
    expect(listHtml([], new Set(), { ...base, stretch: "hide", hiddenStretches: 0 })).not.toContain("match — show");
  });
});
