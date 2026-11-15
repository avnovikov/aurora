import { describe, expect, it } from "vitest";
import { LIBRARY_CATALOGUE } from "../../src/data/libraryCatalogue";
import { detailHtml } from "../../src/library/libraryDetail";
import { mediaHtml } from "../../src/library/detailSections";
import { exerciseNamed as find } from "../helpers/exercises";

const byId = Object.fromEntries(LIBRARY_CATALOGUE.map((item) => [item.id, item]));
const bridge = LIBRARY_CATALOGUE.find((item) => item.id === "glute_bridge")!;

function order(html: string, markers: readonly string[]): number[] {
  return markers.map((marker) => {
    const at = html.indexOf(marker);
    expect(at, marker).toBeGreaterThan(-1);
    return at;
  });
}

describe("exercise detail layout (mock 2205)", () => {
  it("reads in the mock's order", () => {
    const html = detailHtml(bridge, { catalogueById: byId });
    const positions = order(html, [
      "data-lib-back",
      ">Exercise<",
      "<h1",
      'class="lib-meta"',
      "Muscles:",
      "Personal best",
      'class="doodle"',
      'class="lib-summary"',
      ">How to<",
      ">Cues<",
      ">Common mistakes<",
      ">Standards<",
      "data-skill-tier",
      "data-generate-plan",
      "data-add-to-plan",
      ">Progression<",
      "data-exclude-toggle",
      "Text adapted from",
    ]);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("gives the doodle its own full-width row, with its markup unchanged", () => {
    const html = detailHtml(bridge);
    expect(html).toContain(`<div class="ex-media">${mediaHtml(bridge)}</div>`);
  });

  it("puts photos in the same row when a move has no doodle", () => {
    const photo = LIBRARY_CATALOGUE.find((item) => !item.doodlePath && mediaHtml(item).includes("lib-media"))!;
    expect(detailHtml(photo)).toContain(`<div class="ex-media">${mediaHtml(photo)}</div>`);
  });

  it("keeps safety and joint blocks after the description and before How to", () => {
    const html = detailHtml(find("Bench Dip"));
    const [summary, safety, how] = order(html, ["lib-summary", ">Safety<", ">How to<"]);
    expect(summary).toBeLessThan(safety);
    expect(safety).toBeLessThan(how);
  });

  it("highlights the user's level in the standards, matching the select", () => {
    const html = detailHtml(bridge, { memory: { declaredTier: "intermediate" } });
    const mine = html.match(/<li class="mine">.*?<\/li>/s)?.[0] ?? "";
    expect(mine).toContain("Your level");
    expect(mine).toContain("Intermediate");
    expect(mine).toContain(`>${bridge.standards!.intermediate}<`);
    expect(html.match(/class="mine"/g)).toHaveLength(1);
    expect(html).toMatch(/<option value="intermediate" selected>/);
  });

  it("shows every standard number unchanged, holds with their seconds", () => {
    const html = detailHtml(bridge);
    for (const value of Object.values(bridge.standards!)) {
      expect(html).toContain(`<strong>${value}</strong>`);
    }
    const hold = find("Wall handstand hold");
    const holdHtml = detailHtml(hold);
    for (const value of Object.values(hold.standards!)) {
      expect(holdHtml).toContain(`<strong>${value}<small>s</small></strong>`);
    }
  });

  it("labels the level select visibly and keeps its accessible name", () => {
    const html = detailHtml(bridge);
    expect(html).toMatch(/<label for="ex-tier" class="eyebrow">Your level<\/label>/);
    expect(html).toMatch(/<select id="ex-tier" data-skill-tier aria-label="Skill tier for Glute bridge">/);
  });

  it("makes Generate plan the one accent action", () => {
    const html = detailHtml(bridge);
    expect(html).toMatch(/<button type="button" class="cta" data-generate-plan>Generate plan<\/button>/);
    expect(html).toMatch(/<button type="button" data-add-to-plan>Add to the plan<\/button>/);
    expect(html.match(/class="cta"/g)).toHaveLength(1);
  });

  it("keeps the plan status line under the plan hint", () => {
    const html = detailHtml(bridge, { planStatus: "Added to Tuesday." });
    const [hint, status] = order(html, ["Generate builds a whole day", "data-plan-status"]);
    expect(hint).toBeLessThan(status);
  });

  it("keeps the Not for me hint in step with the toggle", () => {
    expect(detailHtml(bridge)).toContain("Tick to keep this move out of all your sessions.");
    expect(detailHtml(bridge, { excluded: true })).toContain("Excluded: Aurora never plans this move.");
  });
});
