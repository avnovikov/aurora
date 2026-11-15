import { describe, expect, it } from "vitest";
import { descriptionProblems } from "../../src/data/describe/validate";
import { cleanLines } from "../../src/data/describe/cleanText";
import { DESCRIPTIONS } from "../../src/data/generated/descriptions";
import { LIBRARY_CATALOGUE } from "../../src/data/libraryCatalogue";
import { detailHtml } from "../../src/library/libraryDetail";

const good = {
  id: "x",
  summary: "A hinge from the floor that strengthens the glutes and hamstrings.",
  steps: ["Lie on your back with knees bent.", "Drive your hips up.", "Lower with control."],
  cues: ["Ribs down", "Squeeze at the top"],
  mistakes: ["Arching the lower back"],
};

describe("description house style", () => {
  it("accepts a well-formed entry", () => {
    expect(descriptionProblems(good)).toEqual([]);
  });

  it("rejects filler, missing steps and over-long lines", () => {
    expect(descriptionProblems({ ...good, steps: ["Only one."] })).toContain("steps count 1");
    expect(descriptionProblems({ ...good, cues: ["x".repeat(80)] })).toContain("cues[0] length");
    expect(
      descriptionProblems({ ...good, steps: [...good.steps, "This will be your starting position."] }),
    ).toContain('banned phrase "starting position"');
  });

  it("strips import boilerplate when bundling source text", () => {
    expect(
      cleanLines([
        "1. Lie on the floor. This will be your starting position.",
        "Repeat for the recommended amount of repetitions.",
        "lie on the floor",
      ]),
    ).toEqual(["Lie on the floor."]);
  });
});

describe("curated descriptions", () => {
  it("cover every Library exercise and pass house style", () => {
    const missing = LIBRARY_CATALOGUE.filter((item) => !DESCRIPTIONS[item.id]).map((item) => item.id);
    expect(missing).toEqual([]);
    const bad = Object.values(DESCRIPTIONS).flatMap((entry) =>
      descriptionProblems(entry).map((problem) => `${entry.id}: ${problem}`),
    );
    expect(bad).toEqual([]);
  });

  it("replace raw source text in the Library and keep attribution", () => {
    const wger = LIBRARY_CATALOGUE.find((item) => item.id.startsWith("wger_"))!;
    expect(wger.description).toBe(DESCRIPTIONS[wger.id].summary);
    expect(wger.steps).toEqual(DESCRIPTIONS[wger.id].steps);
    expect(wger.sources?.join(" ")).toContain("wger.de");
  });

  it("render as summary, how-to, cues and sources on the detail page", () => {
    const pistol = LIBRARY_CATALOGUE.find((item) => item.id === "pistol_squat")!;
    const html = detailHtml(pistol, new Set(), {});
    expect(html).toContain("lib-summary");
    expect(html).toContain("How to");
    expect(html).toContain("Text adapted from");
  });
});
