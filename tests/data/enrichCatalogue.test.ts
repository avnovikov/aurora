import { describe, expect, it } from "vitest";
import { placeOnLadder } from "../../src/data/enrich/ladder";
import { LIBRARY_CATALOGUE } from "../../src/data/libraryCatalogue";
import { SEED_GRAPH } from "../../src/data/seed";
import type { SkillTier } from "../../src/domain/types";
import { detailHtml } from "../../src/library/libraryDetail";

const byName = (name: string) => {
  const found = LIBRARY_CATALOGUE.find((item) => item.name.toLowerCase() === name.toLowerCase());
  if (!found) {
    throw new Error(`missing ${name}`);
  }
  return found;
};
const byId = Object.fromEntries(LIBRARY_CATALOGUE.map((item) => [item.id, item]));
const ORDER: Record<SkillTier, number> = { novice: 0, beginner: 1, intermediate: 2, advanced: 3, elite: 4 };

describe("movement ladders", () => {
  it("orders push-ups by measured load (Wurm & Ebben 2011)", () => {
    const ranks = [
      "Wall Push-Up",
      "Incline Push-Up",
      "Knee push-up",
      "Low incline push-up",
      "Standard Push-Up",
      "Decline Push-Up",
      "Archer Push-Up",
      "One-Arm Push-Up",
    ].map((name) => placeOnLadder(name)?.rank ?? -1);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(new Set(ranks).size).toBe(ranks.length);
  });

  it("orders glute work clamshell → abduction → bridge → single-leg → hip thrust (DiStefano 2009)", () => {
    const ranks = ["Clamshell", "Side Lying Hip Abduction", "Glute bridge", "Single Leg Glute Bridge", "Hip Thrust"].map(
      (name) => placeOnLadder(name)?.rank ?? -1,
    );
    expect(ranks).toEqual([0, 1, 2, 3, 4]);
  });

  it("puts bench dips below bar dips below ring dips (McKenzie 2022)", () => {
    const [bench, bar, ring] = ["Bench Dip", "Parallel Bar Dip", "Ring Dip"].map(
      (name) => placeOnLadder(name)?.rank ?? -1,
    );
    expect(bench).toBeLessThan(bar);
    expect(bar).toBeLessThan(ring);
  });

  it("keeps hanging ab work out of the pull-up family", () => {
    expect(placeOnLadder("Hanging Leg Raise")?.family.id).toBe("compression");
    expect(placeOnLadder("Chin tuck")).toBeUndefined();
  });
});

describe("enriched library", () => {
  it("gives every exercise a level", () => {
    expect(LIBRARY_CATALOGUE.every((item) => item.difficulty)).toBe(true);
  });

  it("never links an easier move to a harder level (or vice versa)", () => {
    const inverted = LIBRARY_CATALOGUE.flatMap((item) => {
      const out: string[] = [];
      const easier = item.easierId ? byId[item.easierId] : undefined;
      const harder = item.harderId ? byId[item.harderId] : undefined;
      if (easier && ORDER[easier.difficulty!] > ORDER[item.difficulty!]) {
        out.push(`${item.name} easier→ ${easier.name}`);
      }
      if (harder && ORDER[harder.difficulty!] < ORDER[item.difficulty!]) {
        out.push(`${item.name} harder→ ${harder.name}`);
      }
      return out;
    });
    expect(inverted).toEqual([]);
  });

  it("keeps hand-curated seed chains and standards", () => {
    const pistol = LIBRARY_CATALOGUE.find((item) => item.id === "pistol_squat");
    expect(pistol?.easierId).toBe("bulgarian_split");
    expect(pistol?.standards).toEqual(SEED_GRAPH.pistol_squat.standards);
  });

  it("wires new-source moves into ladders", () => {
    const sliding = byName("Sliding Leg Curl");
    expect(byId[sliding.harderId!]?.name).toMatch(/nordic/i);
    const pike = byName("Pike Push-Up");
    expect(byId[pike.harderId!]?.name).toMatch(/elevated pike/i);
  });

  it("uses norm-anchored standards where tests exist", () => {
    expect(byName("Forearm Plank").standards).toEqual({
      novice: 30, beginner: 60, intermediate: 90, advanced: 150, elite: 220,
    });
    expect(byName("Side Plank").standards?.intermediate).toBe(60);
    expect(byName("Single-Leg Calf Raise").standards?.intermediate).toBeGreaterThanOrEqual(20);
    expect(byName("Single Leg Glute Bridge").standards?.beginner).toBe(20);
  });

  it("treats static skills as holds and hanging raises as reps", () => {
    expect(byName("Tuck Planche").effort).toBe("hold");
    expect(byName("Wall Sit").effort).toBe("hold");
    expect(byName("Hanging Leg Raise").effort).toBe("reps");
  });

  it("skips standards for stretches and warm-ups", () => {
    expect(byName("Pigeon Pose").standards).toBeUndefined();
    expect(byName("Jumping jacks").standards).toBeUndefined();
  });

  it("adds evidence-based safety notes", () => {
    expect(byName("Bench Dip").cautions?.join(" ")).toMatch(/McKenzie/);
    expect(byName("Crunches").cautions?.join(" ")).toMatch(/flexion/);
    expect(byName("Full Planche").cautions?.join(" ")).toMatch(/connective-tissue/);
    expect(byName("Wall Sit").cautions?.join(" ")).toMatch(/breath/i);
    expect(byName("Standard Push-Up").cautions).toBeUndefined();
  });

  it("excludes behind-the-neck pulling (Kolber 2010)", () => {
    expect(LIBRARY_CATALOGUE.some((item) => /rear pull-up/i.test(item.name))).toBe(false);
  });

  it("shows level and safety notes on the detail page", () => {
    const html = detailHtml(byName("Bench Dip"), new Set(), byId);
    expect(html).toContain("Level: Beginner");
    expect(html).toContain("Safety");
  });
});
