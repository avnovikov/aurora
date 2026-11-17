import { describe, expect, it } from "vitest";
import type { FamilyLadderIndex, FamilyLadderMember } from "../../src/progress/familyLadderIndex";
import { suggestTiers } from "../../src/progress/suggestTiers";
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
});
