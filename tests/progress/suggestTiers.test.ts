import { describe, expect, it } from "vitest";
import type { SkillTier } from "../../src/domain/types";
import type { FamilyLadderIndex, FamilyLadderMember } from "../../src/progress/familyLadderIndex";
import { suggestionFor, suggestTiers } from "../../src/progress/suggestTiers";
import { emptyMemory } from "../../src/session/history";

function indexOf(families: Record<string, string[]>): FamilyLadderIndex {
  const byId = new Map<string, FamilyLadderMember>();
  const byFamily = new Map<string, FamilyLadderMember[]>();
  for (const [familyId, ids] of Object.entries(families)) {
    const members = ids.map((id, rank) => ({ id, name: id, familyId, rank }));
    byFamily.set(familyId, members);
    for (const m of members) byId.set(m.id, m);
  }
  return { byId, byFamily };
}

describe("suggestTiers (#112 rule 6)", () => {
  const index = indexOf({ f1: ["a1", "a2"], f2: ["b1", "b2"], f3: ["c1", "c2"], f4: ["d1", "d2"], f5: ["e1", "e2"], f6: ["g1", "g2"] });
  const patternOf = () => "squat";
  const declared = (id: string) => ({ ...emptyMemory(id), declaredTier: "advanced" as const });

  it("one tested family suggests nothing", () => {
    expect(suggestTiers({ memories: { a2: declared("a2") }, index, patternOf }).size).toBe(0);
  });

  it("≥ 1/3 of families (min 2) tested suggests tier − 1 for untested families only", () => {
    const out = suggestTiers({ memories: { a2: declared("a2"), b2: declared("b2") }, index, patternOf });
    expect(out.get("c1")).toEqual({ tier: "intermediate", testedFamilies: 2, totalFamilies: 6 });
    expect(out.has("a1")).toBe(false);
  });

  const fam = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`f${i}`, [`m${i}a`, `m${i}b`]]));
  const at = (tier: SkillTier, id: string) => ({
    ...emptyMemory(id),
    declaredTier: tier,
  });

  it("(a) the highest qualifying tier wins", () => {
    const idx = indexOf(fam(6));
    const out = suggestTiers({
      memories: { m0b: at("elite", "m0b"), m1b: at("elite", "m1b"), m2b: at("intermediate", "m2b") },
      index: idx,
      patternOf,
    });
    expect(out.get("m3a")?.tier).toBe("advanced");
    expect(out.get("m5b")?.tier).toBe("advanced");
  });

  it("(b) novice gives nothing", () => {
    const idx = indexOf(fam(6));
    const memories = { m0a: at("novice", "m0a"), m1a: at("novice", "m1a") };
    expect(suggestTiers({ memories, index: idx, patternOf }).size).toBe(0);
  });

  it("(c) inferred and plan defaults are not evidence", () => {
    // 4 families, needed = 2. If inferred/planTier counted, 3 families would be tested
    // and the untouched family m3 would receive a suggestion, so size 0 proves the exclusion.
    const idx = indexOf(fam(4));
    const inferred = { tier: "advanced" as const, from: ["x"], at: "2026-11-17T00:00:00Z" };
    const memories = {
      m0a: { ...emptyMemory("m0a"), inferred },
      m1a: { ...emptyMemory("m1a"), inferred },
      m2a: { ...emptyMemory("m2a"), planTier: "advanced" as const },
    };
    expect(suggestTiers({ memories, index: idx, patternOf }).size).toBe(0);
  });

  it("(d) needs ceil(families / 3) tested families", () => {
    const idx = indexOf(fam(7));
    const two = { m0a: at("advanced", "m0a"), m1a: at("advanced", "m1a") };
    expect(suggestTiers({ memories: two, index: idx, patternOf }).size).toBe(0);
    const three = { ...two, m2a: at("advanced", "m2a") };
    expect(suggestTiers({ memories: three, index: idx, patternOf }).get("m3a")?.tier).toBe("intermediate");
  });

  it("(e) patterns count separately", () => {
    const idx = indexOf(fam(6));
    const pat = (id: string) => (Number(id[1]) < 3 ? "squat" : "hinge");
    const out = suggestTiers({
      memories: { m0a: at("advanced", "m0a"), m1a: at("advanced", "m1a") },
      index: idx,
      patternOf: pat,
    });
    expect([...out.keys()].sort()).toEqual(["m2a", "m2b"]);
  });

  describe("suggestionFor", () => {
    const idx = indexOf(fam(6));
    const memories = { m0a: at("advanced", "m0a"), m1a: at("advanced", "m1a"), m2a: at("novice", "m2a") };
    it("a move with its own tested level gets no suggestion", () => {
      // Holds by construction: the move's own family is tested, so suggestTiers never suggests for it.
      const m = { ...memories, m2a: at("beginner", "m2a") };
      expect(suggestionFor("m2a", m, patternOf, idx)).toBeUndefined();
    });
    it("gives an untested move in an untested family its suggestion", () => {
      expect(suggestionFor("m3a", memories, patternOf, idx)?.tier).toBe("intermediate");
    });
  });
});
