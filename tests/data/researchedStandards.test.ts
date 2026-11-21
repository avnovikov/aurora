import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { stepBand, type Band } from "../../scripts/lib/tierDerivation";
import { BAND_FAMILIES, bandFamilyFor } from "../../src/data/enrich/bandFamilies";
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

/** A band from the research table or a family band (#262): the bands this issue set. */
const isResearched = (exercise: SeedExercise | undefined): exercise is SeedExercise =>
  ["sourced", "derived", "family"].includes(exercise?.standardsSource?.kind ?? "");

/**
 * Variant-order conflicts left after the computed derivation and the family
 * bands, as the pair of anchors each one traces back to (#262). A computed band always keeps order
 * with its parent, so every conflict is two fixed anchors whose bands leave no
 * room for the moves the catalogue puts between them. Listed in the spec as
 * data questions; a new pair fails this test.
 */
const KNOWN_ANCHOR_CONFLICTS = [
  // Skills: not changed (user decision, 2026-11-21).
  "hf_33 > hf_34",
  "wger_1704 > hf_105",
  "pullup > fedb_kipping_muscle_up",
  "pullup > muscle_up",
  "scapular_pull > pullup",
  // Follow-up: hip hinge against the single-leg bridge test.
  "hip_hinge > wger_1294",
  // A family band against a move outside the family.
  "ntc_australian_chin_up > hf_44",
  "ntc_feet_elevated_australian_pull_up > pullup",
  "step_up > bulgarian_split",
  "wger_1907 > cossack_squat",
  "wger_1286 > hf_2",
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

  it("labels sourced rows by publisher, derived rows by parent and family rows by family, without URLs", () => {
    const familyLabels = BAND_FAMILIES.map((family) => family.label);
    for (const row of Object.values(RESEARCHED_STANDARDS)) {
      expect(row.source).not.toMatch(/https?:/);
      if (row.kind === "sourced") {
        expect(row.source).toMatch(/^Sourced: /);
      } else if (row.kind === "derived") {
        expect(row.source).toMatch(/^Derived from /);
      } else if (row.kind === "family") {
        expect(familyLabels).toContain(row.source);
      }
    }
  });

  it("applies researched bands by id: Archer Australian Pull-Up and Hindu Push-Up", () => {
    const archer = EXERCISE_GRAPH.ntc_archer_inverted_row!;
    // The row family band 7/10/13/20/25 ÷ 1.2, floored (feet-elevated row is a family member).
    expect(band(archer.standards)).toBe("5/8/10/16/20");
    expect(archer.standardsSource).toEqual({ kind: "derived", label: "Derived from feet-elevated australian pull-up" });
    const hindu = EXERCISE_GRAPH.hf_10!;
    expect(band(hindu.standards)).toBe("9/14/18/24/30");
    expect(hindu.standardsSource).toEqual({ kind: "derived", label: "Derived from standard push-up" });
  });

  it("removes standards from not_max_test moves", () => {
    const tierless = LIBRARY_CATALOGUE.filter((exercise) => exercise.standardsSource?.kind === "none");
    expect(tierless).toHaveLength(Object.values(RESEARCHED_STANDARDS).filter((row) => row.kind === "not_max_test").length);
    expect(tierless.every((exercise) => exercise.standards === undefined)).toBe(true);
  });

  it("matches the sit-up to the crunches through the crunch family (user decisions, 2026-11-21)", () => {
    const sitUp = EXERCISE_GRAPH[idNamed("Sit-Up")]!;
    expect(band(sitUp.standards)).toBe(band(EXERCISE_GRAPH[idNamed("Crunches")]!.standards));
    expect(band(sitUp.standards)).toBe("16/24/40/60/85");
    expect(sitUp.standardsSource).toEqual({ kind: "family", label: "Crunch and sit-up family band" });
    // Its harder variants still derive from it: the V-up is one step harder.
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
    const endura = LIBRARY_CATALOGUE.filter((exercise) => exercise.standardsSource?.kind === "endura");
    expect(endura.length).toBeGreaterThan(0);
    for (const exercise of endura) {
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
    expect(computed.length).toBeGreaterThan(100);
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

  it("walks the skill rows out from the row family: archer, then one-arm", () => {
    expect(RESEARCHED_STANDARDS.ntc_archer_inverted_row?.parent).toEqual({ id: "ntc_feet_elevated_australian_pull_up", step: "harder" });
    expect(RESEARCHED_STANDARDS.hf_42?.parent).toEqual({ id: "ntc_archer_inverted_row", step: "harder" });
    expect(["ntc_feet_elevated_australian_pull_up", "ntc_archer_inverted_row", "hf_42"].map((id) => band(EXERCISE_GRAPH[id]!.standards))).toEqual([
      "7/10/13/20/25",
      "5/8/10/16/20",
      "4/6/8/13/16",
    ]);
  });

  it("derives the Endura matcher's former variants from their neighbour", () => {
    expect(RESEARCHED_STANDARDS.hf_10?.parent).toEqual({ id: "hf_2", step: "harder" });
    expect(band(EXERCISE_GRAPH.hf_10!.standards)).toBe("9/14/18/24/30");
    expect(RESEARCHED_STANDARDS.hf_49?.parent).toEqual({ id: "pullup", step: "harder" });
    expect(band(EXERCISE_GRAPH.hf_49!.standards)).toBe("2/3/6/10/15");
    expect(RESEARCHED_STANDARDS.ntc_archer_straight_bar_dip?.parent).toEqual({ id: "hf_27", step: "harder" });
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

/**
 * Family membership (#262, user decisions 2026-11-21), listed in the spec so
 * the user can check it. A move joining or leaving a family fails this test.
 */
const FAMILY_MEMBERS: Record<string, string[]> = {
  "push-up": [
    "fedb_clock_push_up", "fedb_incline_push_up", "fedb_incline_push_up_close_grip", "fedb_incline_push_up_medium",
    "fedb_incline_push_up_reverse_grip", "fedb_incline_push_up_wide", "fedb_push_up_wide", "fedb_push_ups_close_triceps_position",
    "fedb_push_ups_with_feet_elevated", "fedb_pushups_close_and_wide_hand_positions", "fedb_suspended_push_up",
    "hf_1", "hf_11", "hf_13", "hf_14", "hf_15", "hf_2", "hf_3", "hf_4", "hf_5",
    "ntc_hand_release_push_up", "ntc_incline_push_up_low", "ntc_knee_push_up", "ntc_push_up_shoulder_tap", "ntc_staggered_push_up",
    "wger_1086", "wger_1090", "wger_1209", "wger_1716", "wger_1777", "wger_1902", "wger_2684", "wger_2764", "wger_583", "wger_985",
  ],
  lunge: [
    "bulgarian_split", "fedb_bodyweight_walking_lunge", "fedb_crossover_reverse_lunge", "fedb_split_squats", "fedb_suspended_split_squat",
    "hf_79", "hf_81", "hf_82", "ntc_reverse_lunge_knee_drive", "reverse_lunge", "wger_1324", "wger_1907", "wger_2557", "wger_986",
  ],
  row: [
    "fedb_bodyweight_mid_row", "fedb_suspended_row", "hf_39", "hf_40", "hf_41", "ntc_australian_chin_up",
    "ntc_bent_knee_australian_pull_up", "ntc_feet_elevated_australian_pull_up", "wger_2678", "wger_674", "wger_959",
  ],
  crunch: [
    "fedb_3_4_sit_up", "fedb_cross_body_crunch", "fedb_crunch_hands_overhead", "fedb_crunches", "fedb_frog_sit_ups", "fedb_janda_sit_up",
    "fedb_oblique_crunches", "fedb_oblique_crunches_on_the_floor", "fedb_sit_up", "fedb_suspended_reverse_crunch", "fedb_tuck_crunch",
    "hf_115", "hf_119", "wger_1426", "wger_1476", "wger_1478", "wger_1479", "wger_171", "wger_174", "wger_1933", "wger_576",
  ],
};

describe("band families (#262, user decisions 2026-11-21)", () => {
  it("each family has the listed members, and every member has the family band and label", () => {
    for (const family of BAND_FAMILIES) {
      const members = LIBRARY_CATALOGUE.filter((exercise) => exercise.standardsSource?.label === family.label);
      expect(members.map((exercise) => exercise.id).sort(), family.id).toEqual([...FAMILY_MEMBERS[family.id]!].sort());
      for (const exercise of members) {
        expect(exercise.standardsSource?.kind, exercise.id).toBe("family");
        expect(exercise.standards, exercise.id).toEqual(family.standards);
      }
    }
  });

  it("uses the agreed bands", () => {
    const bands = Object.fromEntries(BAND_FAMILIES.map((family) => [family.id, band(family.standards)]));
    expect(bands).toEqual({
      "push-up": "11/17/22/29/36",
      lunge: "4/6/15/28/45",
      row: "7/10/13/20/25",
      crunch: "16/24/40/60/85",
    });
  });

  it("only beginner and intermediate work moves counted in reps are members", () => {
    for (const exercise of LIBRARY_CATALOGUE.filter((item) => item.standardsSource?.kind === "family")) {
      expect(["beginner", "intermediate"], exercise.id).toContain(exercise.difficulty);
      expect(exercise.role, exercise.id).toBe("work");
      expect(exercise.effort, exercise.id).toBe("reps");
    }
  });

  it("skill moves, Hindu and pike push-ups stay out and keep bands below the push-up", () => {
    const pushUp = EXERCISE_GRAPH.hf_2!.standards!;
    const outside = ["hf_10", "hf_19", "hf_6", "hf_7", "hf_8", "hf_9", "hf_17", "hf_18", "ntc_incline_archer_push_up", "fedb_plyo_push_up", "wger_1217"];
    for (const id of outside) {
      const exercise = EXERCISE_GRAPH[id]!;
      expect(exercise.standardsSource?.kind, id).not.toBe("family");
      if (id !== "hf_19") {
        for (const tier of SKILL_TIERS) {
          expect(exercise.standards![tier], `${id} ${tier}`).toBeLessThanOrEqual(pushUp[tier]);
        }
      }
    }
    // Hindu push-up is one step harder than the push-up; pike keeps its own Endura page.
    expect(band(EXERCISE_GRAPH.hf_10!.standards)).toBe("9/14/18/24/30");
    expect(EXERCISE_GRAPH.hf_19!.standardsSource).toEqual({ kind: "endura", label: "Endura pike push-up men 20–29" });
    expect(band(EXERCISE_GRAPH.elevated_pike!.standards)).toBe("5/6/15/30/49");
  });

  it("a member's name alone does not make it a member: the scapular push-up warm-up and tierless lunges stay out", () => {
    expect(EXERCISE_GRAPH.scap_pushup!.standardsSource?.kind).toBe("seed");
    expect(EXERCISE_GRAPH.hf_96!.standardsSource?.kind).toBe("none");
    expect(bandFamilyFor({ name: "Push-up", role: "work", effort: "reps", difficulty: "advanced", pattern: "horizontal_push" })).toBeNull();
    expect(bandFamilyFor({ name: "Push-up", role: "work", effort: "reps", difficulty: "beginner", pattern: "horizontal_push" })?.id).toBe("push-up");
  });

  it("the row family takes no pull-up or chin-up band", () => {
    for (const id of FAMILY_MEMBERS.row!) {
      expect(EXERCISE_GRAPH[id]!.standardsSource?.label, id).not.toMatch(/pull-up|chin-up/i);
    }
  });

  it("leaves the skills the user kept unchanged", () => {
    const kept: Record<string, string> = {
      hf_33: "2/3/6/10/16",
      hf_34: "2/3/8/15/30",
      wger_1704: "7/10/20/30/45",
      hf_105: "5/10/30/45/60",
      muscle_up: "1/2/6/12/15",
      scapular_pull: "3/6/10/15/20",
      ntc_wall_walk_up: "4/5/15/29/48",
      hf_136: "8/15/25/50/75",
    };
    for (const [id, expected] of Object.entries(kept)) {
      expect(band(EXERCISE_GRAPH[id]!.standards), id).toBe(expected);
    }
    for (const name of ["Manna", "Ice Cream Maker", "Pelican Curl"]) {
      expect(EXERCISE_GRAPH[idNamed(name)]!.standardsSource?.kind, name).toBe("generic");
    }
  });
});
