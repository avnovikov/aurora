import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { stepBand, type Band } from "../../scripts/lib/tierDerivation";
import { enduraRuleFor } from "../../src/data/enrich/enduraStandards";
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
 * Variant-order conflicts left after the computed derivation, as the pair of
 * anchors each one traces back to (#262). A computed band always keeps order
 * with its parent, so every conflict is two fixed anchors whose bands leave no
 * room for the moves the catalogue puts between them. Listed in the spec as
 * data questions; a new pair fails this test.
 */
const KNOWN_ANCHOR_CONFLICTS = [
  "fedb_3_4_sit_up > fedb_sit_up",
  "fedb_bodyweight_mid_row > ntc_bent_knee_australian_pull_up",
  "fedb_incline_push_up > hf_2",
  "fedb_incline_push_up_medium > hf_2",
  "fedb_suspended_row > ntc_bent_knee_australian_pull_up",
  "hf_1 > fedb_incline_push_up",
  "hf_1 > hf_2",
  "hf_115 > fedb_sit_up",
  "hf_15 > hf_2",
  "hf_33 > hf_34",
  "hf_4 > hf_2",
  "hip_hinge > wger_1294",
  "ntc_bent_knee_australian_pull_up > hf_44",
  "ntc_bent_knee_australian_pull_up > pullup",
  "pullup > fedb_kipping_muscle_up",
  "pullup > muscle_up",
  "reverse_lunge > bulgarian_split",
  "scapular_pull > pullup",
  "wger_1086 > hf_2",
  "wger_1286 > hf_2",
  "wger_1704 > hf_105",
  "wger_1933 > fedb_sit_up",
  "wger_2557 > bulgarian_split",
  "wger_2557 > cossack_squat",
  "wger_674 > ntc_bent_knee_australian_pull_up",
  "wger_959 > ntc_bent_knee_australian_pull_up",
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

  it("leaves no_data, rejected and coaching-covered rows out of the table", () => {
    for (const row of RESEARCH) {
      const left =
        row.status === "no_data" ||
        row.verdict === "reject" ||
        (row.status === "sourced" && !row.final) ||
        row.name === "Side Plank";
      expect(RESEARCHED_STANDARDS[row.id] === undefined, `${row.id} ${row.name}`).toBe(left);
    }
  });

  it("labels sourced rows by publisher and derived rows by parent, without URLs", () => {
    for (const row of Object.values(RESEARCHED_STANDARDS)) {
      expect(row.source).not.toMatch(/https?:/);
      if (row.kind === "sourced") {
        expect(row.source).toMatch(/^Sourced: /);
      } else if (row.kind === "derived") {
        expect(row.source).toMatch(/^(Derived from|Matched to) /);
      }
    }
  });

  it("applies researched bands by id: Inverted Row and Crunches", () => {
    const row = EXERCISE_GRAPH[idNamed("Inverted Row")]!;
    // TopEndSports bent-knee row 8/12/17/24/30 ÷ 1.2, floored.
    expect(band(row.standards)).toBe("6/10/14/20/25");
    expect(row.standardsSource).toEqual({ kind: "derived", label: "Derived from bent-knee Australian pull-up" });
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

  it("matches the sit-up to the crunches (user decision, 2026-11-21)", () => {
    const sitUp = EXERCISE_GRAPH[idNamed("Sit-Up")]!;
    expect(band(sitUp.standards)).toBe(band(EXERCISE_GRAPH[idNamed("Crunches")]!.standards));
    expect(band(sitUp.standards)).toBe("16/24/40/60/85");
    expect(sitUp.standardsSource).toEqual({ kind: "derived", label: "Matched to crunches" });
    // Its variants derive from it: the V-up is one step harder.
    expect(band(EXERCISE_GRAPH[idNamed("V-Up")]!.standards)).toBe("13/20/33/50/70");
  });

  it("caps the muscle-up below the pull-up at every tier (user decision, 2026-11-21)", () => {
    const pullUp = EXERCISE_GRAPH.pullup!;
    for (const id of ["muscle_up", "fedb_kipping_muscle_up"]) {
      const muscleUp = EXERCISE_GRAPH[id]!;
      expect(band(muscleUp.standards), id).toBe("1/2/6/12/15");
      expect(muscleUp.standardsSource?.label, id).toMatch(/elite capped below pull-up/);
      for (const tier of SKILL_TIERS) {
        expect(muscleUp.standards![tier]).toBeLessThan(pullUp.standards![tier]);
      }
    }
  });

  it("keeps the generic table for rows the research left open", () => {
    expect(EXERCISE_GRAPH[idNamed("Manna")]!.standardsSource?.kind).toBe("generic");
    expect(EXERCISE_GRAPH[idNamed("Pelican Curl")]!.standardsSource?.kind).toBe("generic");
  });
});

describe("band precedence (#262)", () => {
  const query = { effort: "reps" as const, difficulty: "beginner" as const, placement: undefined };

  it("an Endura twin keeps its Endura band even when the id has a researched row", () => {
    const pick = standardsFor({ ...query, id: idNamed("Crunches"), name: "Push-up" });
    expect(pick.standards).toEqual(enduraRuleFor("Push-up", "reps")?.standards);
    expect(pick.source.kind).toBe("endura");
  });

  it("Library Endura moves keep Endura labels", () => {
    const pullup = LIBRARY_CATALOGUE.filter((exercise) => exercise.standardsSource?.kind === "endura");
    expect(pullup.length).toBeGreaterThan(0);
    for (const exercise of pullup) {
      expect(exercise.standards, exercise.name).toEqual(enduraRuleFor(exercise.name, exercise.effort!)?.standards);
      expect(exercise.standardsSource!.label, exercise.name).toMatch(/Endura/);
    }
  });

  it("the coaching list wins over research: Side Plank stays McGill", () => {
    const sidePlank = EXERCISE_GRAPH[idNamed("Side Plank")]!;
    expect(RESEARCHED_STANDARDS[sidePlank.id]).toBeUndefined();
    expect(sidePlank.standardsSource).toEqual({ kind: "coaching", label: "McGill 1999" });
  });

  it("every researched row is the band its move gets: none is shadowed by Endura or the coaching list", () => {
    for (const [id, row] of Object.entries(RESEARCHED_STANDARDS)) {
      const exercise = EXERCISE_GRAPH[id];
      expect(exercise?.standardsSource?.kind, id).toBe(row.kind === "not_max_test" ? "none" : row.kind);
    }
  });

  it("falls through to the generic table with a generic label", () => {
    const pick = standardsFor({ ...query, id: "no_such_id", name: "Mystery move" });
    expect(pick.source).toEqual({ kind: "generic", label: "Generic by difficulty" });
    expect(band(pick.standards)).toBe("10/20/35/50/75");
  });
});

const bandOf = (id: string): Band | undefined => {
  const standards = EXERCISE_GRAPH[id]?.standards;
  return standards ? (SKILL_TIERS.map((tier) => standards[tier]) as unknown as Band) : undefined;
};

/** The anchor a computed row's chain starts from (itself for an anchor). */
function rootOf(id: string): string {
  const seen = new Set<string>();
  let current = id;
  while (RESEARCHED_STANDARDS[current]?.parent) {
    if (seen.has(current)) {
      throw new Error(`Cycle at ${current}`);
    }
    seen.add(current);
    current = RESEARCHED_STANDARDS[current]!.parent!.id;
  }
  return current;
}

/** Easier → harder Library pairs with the same effort where the easier move has a lower number at some tier. */
function variantOrderViolations(include: (easier: SeedExercise, harder: SeedExercise) => boolean): string[] {
  const pairs = new Set<string>();
  for (const exercise of LIBRARY_CATALOGUE) {
    if (exercise.easierId) {
      pairs.add(`${exercise.easierId} > ${exercise.id}`);
    }
    if (exercise.harderId) {
      pairs.add(`${exercise.id} > ${exercise.harderId}`);
    }
  }
  return [...pairs]
    .filter((pair) => {
      const [easierId, harderId] = pair.split(" > ");
      const easier = EXERCISE_GRAPH[easierId!];
      const harder = EXERCISE_GRAPH[harderId!];
      if (!easier?.standards || !harder?.standards || easier.effort !== harder.effort || !include(easier, harder)) {
        return false;
      }
      return SKILL_TIERS.some((tier) => easier.standards![tier] < harder.standards![tier]);
    })
    .sort();
}

describe("computed derivation (#262, fourth step)", () => {
  const computed = Object.entries(RESEARCHED_STANDARDS).filter(([, row]) => row.parent);

  it("every computed band is its parent's band one step on, so a chain holds by construction", () => {
    expect(computed.length).toBeGreaterThan(150);
    for (const [id, row] of computed) {
      const exercise = EXERCISE_GRAPH[id]!;
      const parent = EXERCISE_GRAPH[row.parent!.id]!;
      expect(parent.effort, id).toBe(exercise.effort);
      expect(band(row.standards), `${id} <- ${row.parent!.id} ${row.parent!.step}`).toBe(
        stepBand(bandOf(parent.id)!, row.parent!.step, exercise.effort!).join("/"),
      );
      for (const tier of SKILL_TIERS) {
        const child = row.standards![tier];
        const base = parent.standards![tier];
        if (row.parent!.step === "easier") {
          expect(child, `${id} ${tier}`).toBeGreaterThanOrEqual(base);
        } else if (row.parent!.step === "harder") {
          expect(child, `${id} ${tier}`).toBeLessThanOrEqual(base);
        } else {
          expect(child, `${id} ${tier}`).toBe(base);
        }
      }
    }
  });

  it("every chain reaches a fixed anchor without a cycle", () => {
    for (const [id] of computed) {
      const root = rootOf(id);
      expect(RESEARCHED_STANDARDS[root]?.parent, `${id} -> ${root}`).toBeUndefined();
      expect(EXERCISE_GRAPH[root]?.standards, `${id} -> ${root}`).toBeDefined();
    }
  });

  it("walks the row chain in order: bent-knee row, inverted row, ring rows, feet-elevated, archer, one-arm", () => {
    const chain = [
      "ntc_bent_knee_australian_pull_up",
      "hf_39",
      "ntc_feet_elevated_australian_pull_up",
      "ntc_archer_inverted_row",
      "hf_42",
    ];
    for (let i = 1; i < chain.length; i += 1) {
      expect(RESEARCHED_STANDARDS[chain[i]!]?.parent, chain[i]).toEqual({ id: chain[i - 1], step: "harder" });
    }
    expect(band(EXERCISE_GRAPH.ntc_bent_knee_australian_pull_up!.standards)).toBe("8/12/17/24/30");
    expect(chain.map((id) => band(EXERCISE_GRAPH[id]!.standards))).toEqual([
      "8/12/17/24/30",
      "6/10/14/20/25",
      "5/8/11/16/20",
      "4/6/9/13/16",
      "3/5/7/10/13",
    ]);
    for (const ring of [idNamed("Ring Row"), idNamed("Incline Row - Rings")]) {
      expect(RESEARCHED_STANDARDS[ring]?.parent, ring).toEqual({ id: "hf_39", step: "easier" });
    }
  });

  it("walks the lunge family out from the supported split squat", () => {
    const supported = "wger_2557"; // Supported Split Squat: Endura split squat × 1.2
    for (const name of ["Bodyweight lunge", "Forward Lunge", "Bodyweight Walking Lunge", "Unilateral Lunges"]) {
      expect(RESEARCHED_STANDARDS[idNamed(name)]?.parent, name).toEqual({ id: supported, step: "harder" });
      expect(band(EXERCISE_GRAPH[idNamed(name)]!.standards), name).toBe("4/6/15/28/45");
    }
    for (const name of ["Curtsy Lunge", "Crossover Reverse Lunge"]) {
      expect(RESEARCHED_STANDARDS[idNamed(name)]?.parent, name).toEqual({ id: idNamed("Bodyweight lunge"), step: "harder" });
    }
  });

  it("derives the Endura matcher's former variants from their neighbour", () => {
    expect(RESEARCHED_STANDARDS.hf_10?.parent).toEqual({ id: "hf_2", step: "harder" });
    expect(band(EXERCISE_GRAPH.hf_10!.standards)).toBe("9/14/18/24/30");
    expect(RESEARCHED_STANDARDS.hf_49?.parent).toEqual({ id: "pullup", step: "harder" });
    expect(band(EXERCISE_GRAPH.hf_49!.standards)).toBe("2/3/6/10/15");
    expect(RESEARCHED_STANDARDS.ntc_archer_straight_bar_dip?.parent).toEqual({ id: "hf_27", step: "harder" });
    expect(RESEARCHED_STANDARDS.ntc_knee_push_up?.parent).toEqual({ id: "hf_2", step: "easier" });
  });
});

describe("variant order (#262)", () => {
  it("every conflict that touches a researched band traces back to two anchors, listed as data questions", () => {
    const violations = variantOrderViolations((easier, harder) => isResearched(easier) || isResearched(harder));
    const roots = new Set<string>();
    for (const pair of violations) {
      const [easier, harder] = pair.split(" > ");
      const [a, b] = [rootOf(easier!), rootOf(harder!)];
      // Two moves on the same chain never conflict: each step keeps order with its parent.
      expect(a, pair).not.toBe(b);
      roots.add(`${a} > ${b}`);
    }
    expect([...roots].sort()).toEqual([...KNOWN_ANCHOR_CONFLICTS].sort());
  });
});
