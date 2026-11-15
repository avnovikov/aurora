import { describe, expect, it } from "vitest";
import { LIBRARY_CATALOGUE } from "../../src/data/libraryCatalogue";
import type { JointHistoryEntry } from "../../src/domain/program";
import { detailHtml } from "../../src/library/libraryDetail";
import { listHtml } from "../../src/library/libraryList";
import { PREHAB_NAMES, prehabFor } from "../../src/safety/prehab";

const SHOULDER: JointHistoryEntry = { joint: "shoulder", side: "left", kind: "dislocation" };
const KNEES: JointHistoryEntry = { joint: "knee", side: "both", kind: "other" };
const find = (name: string) => LIBRARY_CATALOGUE.find((item) => item.name === name)!;

describe("prehab list", () => {
  it("resolves every named move to a Library exercise", () => {
    const names = new Set(LIBRARY_CATALOGUE.map((item) => item.name.toLowerCase()));
    const missing = Object.values(PREHAB_NAMES)
      .flat()
      .filter((name) => !names.has(name.toLowerCase()));
    expect(missing).toEqual([]);
  });

  it("returns moves for the declared joints without repeats", () => {
    const moves = prehabFor([KNEES, { joint: "hip", side: "both", kind: "other" }], LIBRARY_CATALOGUE);
    const ids = moves.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(moves.some((item) => item.name === "Copenhagen Adduction Exercise")).toBe(true);
    expect(prehabFor([], LIBRARY_CATALOGUE)).toEqual([]);
  });
});

describe("side-lying external rotation (new import)", () => {
  const move = find("Side-lying External Rotation");

  it("is curated and credited to the wger author", () => {
    expect(move.steps?.length).toBeGreaterThan(1);
    expect(move.sources?.join(" ")).toMatch(/CC-BY-SA-4\.0, apeschel/);
  });

  it("does not become a progression link of any other move", () => {
    const linked = LIBRARY_CATALOGUE.filter(
      (item) => item.easierId === move.id || item.harderId === move.id,
    );
    expect(linked).toEqual([]);
  });
});

describe("evidence-based cautions", () => {
  it("warns on end-range shoulder and lateral knee moves", () => {
    expect(find("Skin the Cat").cautions?.join(" ")).toMatch(/shoulder instability/);
    expect(find("Cossack squat").cautions?.join(" ")).toMatch(/Sideways load/);
    expect(find("Lateral Lunge").cautions?.join(" ")).toMatch(/Sideways load/);
  });
});

describe("Library flags for the user's joints", () => {
  const query = { text: "", region: "all" as const };

  it("badges avoided and cautioned moves in the list", () => {
    const html = listHtml(
      [find("Skin the Cat"), find("Parallel Bar Dip"), find("Standard Push-Up")],
      new Set(),
      query,
      [SHOULDER],
    );
    expect(html).toContain("Skipped for your joints");
    expect(html).toContain("Mind your joints");
    expect(html.match(/lib-badge/g)).toHaveLength(2);
  });

  it("offers the joints filter only when history exists", () => {
    expect(listHtml([], new Set(), query, [])).not.toContain("data-for-joints");
    expect(listHtml([], new Set(), query, [KNEES])).toContain("data-for-joints");
  });

  it("explains the verdict on the detail page", () => {
    const html = detailHtml(find("Cossack squat"), new Set(), {}, {}, [KNEES]);
    expect(html).toContain("For your joints");
    expect(html).toContain("skips this move");
    expect(detailHtml(find("Standard Push-Up"), new Set(), {}, {}, [KNEES])).not.toContain(
      "For your joints",
    );
  });
});
