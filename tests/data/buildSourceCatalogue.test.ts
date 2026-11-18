import { describe, expect, it } from "vitest";
import { buildSourceCatalogue, type SourceAdapter } from "../../src/data/buildSourceCatalogue";
import type { SeedExercise } from "../../src/data/seed";

interface Rec {
  name: string;
  ok?: boolean;
}

const move = (id: string, name: string): SeedExercise =>
  ({ id, name, pattern: "squat", type: "dynamic", muscles: [], joints: [], regions: [], cues: [] }) as SeedExercise;

const adapter = (over: Partial<SourceAdapter<Rec>> = {}): SourceAdapter<Rec> => ({
  isCandidate: (r) => r.ok !== false,
  map: (r) => move(`src_${r.name}`, r.name),
  aliases: {},
  ...over,
});

describe("buildSourceCatalogue", () => {
  it("maps candidates, skips non-candidates, and sorts by name", () => {
    const result = buildSourceCatalogue(
      [{ name: "Zeta" }, { name: "Alpha" }, { name: "Skip", ok: false }],
      [],
      adapter(),
    );
    expect(result.catalogue.map((m) => m.name)).toEqual(["Alpha", "Zeta"]);
    expect(result.skippedDuplicates).toEqual([]);
  });

  it("folds a record into an existing move with the same loose name", () => {
    const result = buildSourceCatalogue([{ name: "Push-Ups" }], [move("seed_pushup", "Push Up")], adapter());
    expect(result.catalogue).toEqual([]);
    expect(result.skippedDuplicates).toEqual(["Push-Ups"]);
    expect(result.duplicates).toEqual([{ record: { name: "Push-Ups" }, intoId: "seed_pushup" }]);
  });

  it("follows an alias to the move it names", () => {
    const result = buildSourceCatalogue(
      [{ name: "Chin Up" }],
      [move("hf_44", "Chin-Up Hold")],
      adapter({ aliases: { "Chin Up": "Chin-Up Hold" } }),
    );
    expect(result.duplicates[0]?.intoId).toBe("hf_44");
  });

  it("skips an aliased record even when its target is not in the Library", () => {
    const result = buildSourceCatalogue(
      [{ name: "Gone" }],
      [],
      adapter({ aliases: { Gone: "Dropped On Purpose" } }),
    );
    expect(result.catalogue).toEqual([]);
    expect(result.skippedDuplicates).toEqual(["Gone"]);
    expect(result.duplicates).toEqual([]);
  });

  it("dedupes later records against earlier ones in the same source", () => {
    const result = buildSourceCatalogue([{ name: "Lunge" }, { name: "Lunges" }], [], adapter());
    expect(result.catalogue.map((m) => m.name)).toEqual(["Lunge"]);
    expect(result.duplicates[0]?.intoId).toBe("src_Lunge");
  });

  it("keys on displayName when given, so cleaned names collide", () => {
    const result = buildSourceCatalogue(
      [{ name: "Calf Raise HD" }],
      [move("seed_calf", "Calf raise")],
      adapter({ displayName: (r) => r.name.replace(/ HD$/, "") }),
    );
    expect(result.skippedDuplicates).toEqual(["Calf Raise HD"]);
  });
});
