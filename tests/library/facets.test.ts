import { beforeEach, describe, expect, it } from "vitest";
import { LIBRARY_CATALOGUE } from "../../src/data/libraryCatalogue";
import {
  AREAS,
  MUSCLE_BUCKETS,
  areaOf,
  isStretch,
  matchesFacetText,
  matchesFacets,
  primaryBuckets,
} from "../../src/library/facets";
import { listHtml } from "../../src/library/libraryList";
import { searchExercises } from "../../src/library/search";
import { exerciseSelectHtml, setPickerFacetsForTests } from "../../src/ui/planView";
import { exerciseNamed as find } from "../helpers/exercises";

const entry = (group: string, role: "primary" | "secondary" | "stabilizer") =>
  ({ group, role }) as never;

describe("primary muscle buckets", () => {
  it("rolls primaries up and ignores secondaries", () => {
    expect(primaryBuckets(find("Pull-up"))).toEqual(["back"]);
    expect(primaryBuckets(find("Standard Push-Up")).sort()).toEqual(["arms", "chest", "shoulders"]);
    expect(primaryBuckets({ muscles: [entry("neck", "primary")] })).toEqual([]);
  });

  it("offers eight buckets", () => {
    expect(MUSCLE_BUCKETS).toHaveLength(8);
  });
});

describe("area", () => {
  it("classifies from primary muscles", () => {
    expect(areaOf(find("Standard Push-Up"))).toBe("upper");
    expect(areaOf(find("Pull-up"))).toBe("upper");
    expect(areaOf(find("Pistol squat"))).toBe("lower");
    expect(areaOf(find("Burpee"))).toBe("full");
    expect(areaOf(find("Forearm Plank"))).toBe("core");
  });

  it("counts a core move with a shoulder primary as upper", () => {
    const plank = { muscles: [entry("abdominals", "primary"), entry("shoulders", "primary")] };
    expect(areaOf(plank)).toBe("upper");
  });

  it("covers the whole Library except neck drills", () => {
    const missing = LIBRARY_CATALOGUE.filter((item) => !areaOf(item)).map((item) => item.name);
    expect(missing.every((name) => /neck|chin to chest/i.test(name)), missing.join(", ")).toBe(true);
  });

  it("has four areas", () => {
    expect(AREAS.map((area) => area.id)).toEqual(["upper", "lower", "core", "full"]);
  });
});

describe("facet filtering", () => {
  it("filters by area and by muscle, primary only", () => {
    const upper = searchExercises(LIBRARY_CATALOGUE, { area: "upper" });
    expect(upper.length).toBeGreaterThan(100);
    expect(upper.every((item) => areaOf(item) === "upper")).toBe(true);
    const back = searchExercises(LIBRARY_CATALOGUE, { muscle: "back" });
    expect(back.some((item) => item.name === "Pull-up")).toBe(true);
    expect(back.every((item) => primaryBuckets(item).includes("back"))).toBe(true);
    expect(matchesFacets(find("Pull-up"), "all", "arms")).toBe(false);
  });

  it("combines with level and stretch filters", () => {
    const results = searchExercises(LIBRARY_CATALOGUE, {
      area: "upper",
      muscle: "chest",
      stretch: "hide",
      level: "beginner",
    });
    expect(results.length).toBeGreaterThan(0);
    expect(
      results.every(
        (item) =>
          areaOf(item) === "upper" &&
          primaryBuckets(item).includes("chest") &&
          !isStretch(item) &&
          item.difficulty === "beginner",
      ),
    ).toBe(true);
  });
});

describe("text search by muscle and area", () => {
  it("finds moves by muscle words and aliases", () => {
    expect(searchExercises(LIBRARY_CATALOGUE, { text: "chest" }).some((i) => i.name === "Standard Push-Up")).toBe(true);
    expect(searchExercises(LIBRARY_CATALOGUE, { text: "lats" }).some((i) => i.name === "Pull-up")).toBe(true);
    expect(searchExercises(LIBRARY_CATALOGUE, { text: "abs" }).some((i) => i.name === "Forearm Plank")).toBe(true);
  });

  it("finds moves by area words", () => {
    const upper = searchExercises(LIBRARY_CATALOGUE, { text: "upper body" });
    expect(upper.some((i) => i.name === "Pull-up")).toBe(true);
    expect(upper.some((i) => i.name === "Pistol squat")).toBe(false);
  });

  it("ignores very short queries for muscle matching", () => {
    expect(matchesFacetText(find("Forearm Plank"), "ab")).toBe(false);
    expect(matchesFacetText(find("Forearm Plank"), "abs")).toBe(true);
  });

  it("still matches names and patterns as before", () => {
    expect(searchExercises(LIBRARY_CATALOGUE, { text: "hollow" }).some((i) => i.id === "hollow_hold")).toBe(true);
  });
});

describe("Library list chips", () => {
  const base = { text: "", level: "all" as const };

  it("renders area and muscle chips, panel closed by default", () => {
    const html = listHtml([], new Set(), base);
    expect(html).toContain('data-area="upper"');
    expect(html).toContain('data-muscle="glutes_hips"');
    expect(html).not.toMatch(/data-panel="body" open/);
  });

  it("opens the panel and marks the choice while a facet is active", () => {
    const html = listHtml([], new Set(), { ...base, area: "upper", muscle: "chest" });
    expect(html).toMatch(/data-panel="body" open/);
    expect(html).toMatch(/data-area="upper" class="selected"/);
    expect(html).toMatch(/data-muscle="chest" class="selected"/);
    expect(html).toContain("Area &amp; muscle · Upper body, Chest");
  });
});

describe("Plan editor pickers", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    globalThis.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    } as unknown as Storage;
    setPickerFacetsForTests("all", "all");
  });

  it("lists every plannable move with no filter", () => {
    const html = exerciseSelectHtml(undefined, "data-x", "Pick");
    expect(html).toContain(">Pull-up");
    expect(html).toContain(">Bodyweight squat");
  });

  it("narrows by area and muscle but keeps the current pick", () => {
    setPickerFacetsForTests("lower", "all");
    const lower = exerciseSelectHtml(undefined, "data-x", "Pick");
    expect(lower).toContain(">Bodyweight squat");
    expect(lower).not.toContain(">Pull-up");
    const kept = exerciseSelectHtml("pullup", "data-x", "Pick");
    expect(kept).toContain(">Pull-up");
    setPickerFacetsForTests("all", "back");
    const back = exerciseSelectHtml(undefined, "data-x", "Pick");
    expect(back).toContain(">Pull-up");
    expect(back).not.toContain(">Bodyweight squat");
  });
});
