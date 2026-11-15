import { describe, expect, it } from "vitest";
import type { ExerciseMemory, SkillTier } from "../../src/domain/types";
import { cascadeFamilyTiers } from "../../src/progress/cascadeFamilyTiers";
import { buildFamilyLadderIndex } from "../../src/progress/familyLadderIndex";
import { declareSkillTier, emptyMemory } from "../../src/session/history";

const ANTI_EXTENSION_CATALOGUE = [
  { id: "hf_108", name: "Dragon Flag" },
  { id: "ab_wheel", name: "Ab Wheel Rollout" },
  { id: "hollow_hold", name: "Hollow Hold" },
  { id: "dead_bug", name: "Dead Bug" },
  { id: "plank", name: "Plank" },
] as const;

function cascadeOn(
  memories: Record<string, ExerciseMemory>,
  sourceId: string,
  declaredTier: SkillTier,
  catalogue: ReadonlyArray<{ id: string; name: string; requires?: readonly string[] }> = ANTI_EXTENSION_CATALOGUE,
) {
  return cascadeFamilyTiers({
    memories,
    sourceId,
    declaredTier,
    index: buildFamilyLadderIndex(catalogue),
  });
}

describe("cascadeFamilyTiers", () => {
  it("raises easier and same-rank family floors from Advanced dragon flag", () => {
    const { memories, raisedIds } = cascadeOn({}, "hf_108", "advanced");

    expect(raisedIds.sort()).toEqual(
      ["ab_wheel", "dead_bug", "hollow_hold", "plank"].sort(),
    );
    // rank 4 → 3: +1 → elite; rank 1/0: +3/+4 → elite
    expect(memories.ab_wheel?.skillTier).toBe("elite");
    expect(memories.plank?.skillTier).toBe("elite");
    expect(memories.hollow_hold?.skillTier).toBe("elite");
    expect(memories.dead_bug?.skillTier).toBe("elite");
    expect(memories.hf_108).toBeUndefined();
  });

  it("matches same-rank siblings to the declared floor", () => {
    const catalogue = [
      { id: "ab_wheel", name: "Ab Wheel Rollout" },
      { id: "body_saw", name: "Body Saw" },
      { id: "hf_108", name: "Dragon Flag" },
    ];
    const { memories } = cascadeOn({}, "ab_wheel", "intermediate", catalogue);
    expect(memories.body_saw?.skillTier).toBe("intermediate");
    expect(memories.hf_108).toBeUndefined();
  });

  it("never lowers an existing higher tier", () => {
    const start = {
      plank: { ...emptyMemory("plank"), skillTier: "elite" as const },
    };
    const { memories, raisedIds } = cascadeOn(start, "hf_108", "beginner");
    expect(memories.plank?.skillTier).toBe("elite");
    expect(raisedIds).not.toContain("plank");
  });

  it("raises skillTier without rewriting declaredTier on related moves", () => {
    const start = {
      hollow_hold: {
        ...emptyMemory("hollow_hold"),
        declaredTier: "beginner" as const,
        skillTier: "beginner" as const,
      },
    };
    const { memories } = cascadeOn(start, "hf_108", "advanced");
    expect(memories.hollow_hold?.declaredTier).toBe("beginner");
    expect(memories.hollow_hold?.skillTier).toBe("elite");
  });

  it("leaves harder family rungs untouched", () => {
    const catalogue = [
      { id: "ab_wheel", name: "Ab Wheel Rollout" },
      { id: "hf_108", name: "Dragon Flag" },
    ];
    const { memories, raisedIds } = cascadeOn({}, "ab_wheel", "advanced", catalogue);
    expect(raisedIds).toEqual([]);
    expect(memories.hf_108).toBeUndefined();
  });

  it("does not mutate the input memories object", () => {
    const start = { plank: emptyMemory("plank") };
    const { memories } = cascadeOn(start, "hf_108", "advanced");
    expect(start.plank.skillTier).toBeUndefined();
    expect(memories.plank?.skillTier).toBe("elite");
    expect(memories).not.toBe(start);
  });

  it("skips band moves and exercises with no ladder placement", () => {
    const catalogue = [
      { id: "chin_tuck", name: "Chin tuck" },
      { id: "band_row", name: "Seated band row", requires: ["band"] as const },
      { id: "hf_108", name: "Dragon Flag" },
    ];
    expect(cascadeOn({}, "chin_tuck", "advanced", catalogue).raisedIds).toEqual([]);
    const fromFlag = cascadeOn({}, "hf_108", "advanced", catalogue);
    expect(fromFlag.raisedIds).not.toContain("band_row");
    expect(fromFlag.memories.band_row).toBeUndefined();
  });

  it("rejects duplicate catalogue ids when building an index", () => {
    expect(() =>
      buildFamilyLadderIndex([
        { id: "plank", name: "Plank" },
        { id: "plank", name: "Plank Hold" },
      ]),
    ).toThrow(/Duplicate exercise id/);
  });
});

describe("declareSkillTier cascade", () => {
  it("declares the source and cascades related Library floors", () => {
    const result = declareSkillTier({}, "hf_108", "advanced");
    expect(result.memories.hf_108?.declaredTier).toBe("advanced");
    expect(result.cascadedCount).toBeGreaterThan(0);
    expect(result.memories.hollow_hold?.skillTier).toBe("elite");
    expect(result.memories.dead_bug?.skillTier).toBe("elite");
  });
});
