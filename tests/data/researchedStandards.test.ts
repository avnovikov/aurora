import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { enduraStandardsFor } from "../../src/data/enrich/enduraStandards";
import { RESEARCHED_STANDARDS } from "../../src/data/enrich/researchedStandards";
import { standardsFor } from "../../src/data/enrich/standards";
import { EXERCISE_GRAPH } from "../../src/data/exerciseGraph";
import { LIBRARY_CATALOGUE } from "../../src/data/libraryCatalogue";
import type { SeedExercise } from "../../src/data/seed";
import { SKILL_TIERS } from "../../src/domain/skillTier";
import type { ExerciseStandards } from "../../src/domain/types";

interface ResearchRow {
  id: string;
  name: string;
  status: string;
  verdict: string;
  final: string;
}

const RESEARCH: ResearchRow[] = JSON.parse(
  readFileSync("docs/superpowers/specs/2026-11-21-researched-tier-standards/tier-research.json", "utf8"),
);

const band = (standards: ExerciseStandards | undefined): string =>
  standards ? SKILL_TIERS.map((tier) => standards[tier]).join("/") : "";

const idNamed = (name: string): string => {
  const row = RESEARCH.find((item) => item.name === name);
  if (!row) {
    throw new Error(`No research row named ${name}`);
  }
  return row.id;
};

const isResearched = (exercise: SeedExercise | undefined): exercise is SeedExercise =>
  exercise?.standardsSource?.kind === "sourced" || exercise?.standardsSource?.kind === "derived";

/**
 * Easier → harder pairs where the easier move has a lower number at some
 * tier, as the research delivered them (#262). Reported in the spec, not
 * fixed here; a new pair fails this test.
 */
const KNOWN_VARIANT_ORDER_VIOLATIONS = [
  "fedb_3_4_sit_up > fedb_jackknife_sit_up",
  "fedb_alternate_heel_touchers > fedb_toe_touchers",
  "fedb_cross_body_crunch > fedb_sit_up",
  "fedb_crunch_hands_overhead > fedb_sit_up",
  "fedb_crunches > fedb_sit_up",
  "fedb_hanging_pike > hf_123",
  "fedb_hyperextensions_with_no_hyperextension_bench > hf_85",
  "hf_115 > fedb_frog_sit_ups",
  "hf_115 > fedb_janda_sit_up",
  "hf_115 > fedb_sit_up",
  "hf_115 > wger_1479",
  "hf_115 > wger_260",
  "hf_33 > hf_34",
  "hf_85 > wger_1294",
  "wger_1286 > hf_124",
  "wger_1476 > fedb_jackknife_sit_up",
  "wger_1704 > hf_105",
  "wger_174 > fedb_sit_up",
  "wger_1933 > fedb_sit_up",
];

describe("researched tier table (#262)", () => {
  it("every researched band has five tiers ≥ 1, strictly increasing", () => {
    for (const [id, row] of Object.entries(RESEARCHED_STANDARDS)) {
      if (row.kind === "not_max_test") {
        expect(row.standards, id).toBeUndefined();
        continue;
      }
      const values = SKILL_TIERS.map((tier) => row.standards![tier]);
      expect(values.every((value) => Number.isInteger(value) && value >= 1), id).toBe(true);
      for (let i = 1; i < values.length; i += 1) {
        expect(values[i]!, `${id} ${band(row.standards)}`).toBeGreaterThan(values[i - 1]!);
      }
    }
  });

  it("leaves no_data, rejected and empty rows out of the table", () => {
    for (const row of RESEARCH) {
      const left = row.status === "no_data" || row.verdict === "reject" || (!row.final && row.status !== "not_max_test");
      expect(RESEARCHED_STANDARDS[row.id] === undefined, `${row.id} ${row.name}`).toBe(left);
    }
  });

  it("labels sourced rows by publisher and derived rows by parent, without URLs", () => {
    for (const row of Object.values(RESEARCHED_STANDARDS)) {
      expect(row.source).not.toMatch(/https?:/);
      if (row.kind === "sourced") {
        expect(row.source).toMatch(/^Sourced: /);
      } else if (row.kind === "derived") {
        expect(row.source).toMatch(/^Derived from /);
      }
    }
  });

  it("applies researched bands by id: Inverted Row and Crunches", () => {
    const row = EXERCISE_GRAPH[idNamed("Inverted Row")]!;
    expect(band(row.standards)).toBe("5/8/19/33/47");
    expect(row.standardsSource?.kind).toBe("sourced");
    const crunches = EXERCISE_GRAPH[idNamed("Crunches")]!;
    expect(band(crunches.standards)).toBe("16/24/40/60/85");
    expect(crunches.standardsSource?.label).toMatch(/^Sourced: /);
  });

  it("marks a derived band with its parent", () => {
    const ringRow = EXERCISE_GRAPH[idNamed("Ring Row")]!;
    expect(ringRow.standardsSource).toEqual({ kind: "derived", label: "Derived from inverted row" });
  });

  it("removes standards from not_max_test moves", () => {
    const tierless = LIBRARY_CATALOGUE.filter((exercise) => exercise.standardsSource?.kind === "none");
    expect(tierless).toHaveLength(Object.values(RESEARCHED_STANDARDS).filter((row) => row.kind === "not_max_test").length);
    expect(tierless.every((exercise) => exercise.standards === undefined)).toBe(true);
  });

  it("keeps the generic table for rows the research left open", () => {
    expect(EXERCISE_GRAPH[idNamed("Manna")]!.standardsSource?.kind).toBe("generic");
    expect(EXERCISE_GRAPH[idNamed("Torso Twist")]!.standardsSource?.kind).toBe("generic");
  });
});

describe("band precedence (#262)", () => {
  const query = { effort: "reps" as const, difficulty: "beginner" as const, placement: undefined };

  it("an Endura twin keeps its Endura band even when the id has a researched row", () => {
    const pick = standardsFor({ ...query, id: idNamed("Crunches"), name: "Push-up" });
    expect(pick.standards).toEqual(enduraStandardsFor("Push-up", "reps"));
    expect(pick.source.kind).toBe("endura");
  });

  it("Library Endura moves keep Endura labels", () => {
    const pullup = LIBRARY_CATALOGUE.filter((exercise) => exercise.standardsSource?.kind === "endura");
    expect(pullup.length).toBeGreaterThan(0);
    for (const exercise of pullup) {
      expect(exercise.standards, exercise.name).toEqual(enduraStandardsFor(exercise.name, exercise.effort!));
      expect(exercise.standardsSource!.label, exercise.name).toMatch(/Endura/);
    }
  });

  it("the coaching list wins over research: Side Plank stays McGill", () => {
    const sidePlank = EXERCISE_GRAPH[idNamed("Side Plank")]!;
    expect(RESEARCHED_STANDARDS[sidePlank.id]?.kind).toBe("derived");
    expect(sidePlank.standardsSource).toEqual({ kind: "coaching", label: "McGill 1999" });
  });

  it("falls through to the generic table with a generic label", () => {
    const pick = standardsFor({ ...query, id: "no_such_id", name: "Mystery move" });
    expect(pick.source).toEqual({ kind: "generic", label: "Generic by difficulty" });
    expect(band(pick.standards)).toBe("10/20/35/50/75");
  });
});

describe("variant order of researched bands (#262)", () => {
  it("easier variants sit at or above harder ones, apart from the reported pairs", () => {
    const pairs = new Set<string>();
    for (const exercise of LIBRARY_CATALOGUE) {
      if (exercise.easierId) {
        pairs.add(`${exercise.easierId} > ${exercise.id}`);
      }
      if (exercise.harderId) {
        pairs.add(`${exercise.id} > ${exercise.harderId}`);
      }
    }
    const violations = [...pairs]
      .filter((pair) => {
        const [easierId, harderId] = pair.split(" > ");
        const easier = EXERCISE_GRAPH[easierId!];
        const harder = EXERCISE_GRAPH[harderId!];
        if (!isResearched(easier) || !isResearched(harder) || easier.effort !== harder.effort) {
          return false;
        }
        return SKILL_TIERS.some((tier) => easier.standards![tier] < harder.standards![tier]);
      })
      .sort();
    expect(violations).toEqual([...KNOWN_VARIANT_ORDER_VIOLATIONS].sort());
  });
});
