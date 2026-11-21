import { describe, expect, it } from "vitest";
import {
  AREA_ORDER,
  PAIRS,
  buildBalanceModel,
  chooseCaricature,
  computePairs,
  headlineFor,
  pairShares,
  levelsFromScores,
  patternSets,
  setsPerExercise,
  suggestMoves,
  sublineFor,
  takeaway,
  type CaricatureId,
  type Level,
  type MoveSuggestion,
  type PairId,
  type PairResult,
} from "../../src/body/balance";
import type { MuscleLoadMap } from "../../src/body/aggregate";
import { CARICATURES } from "../../src/body/caricatureSvgs";
import { EXERCISE_GRAPH } from "../../src/data/exerciseGraph";
import type { SeedExercise } from "../../src/data/seed";
import type { EquipmentId, JointHistoryEntry, JointId } from "../../src/domain/program";
import type { ExerciseMemory, ExerciseStandards, MuscleGroup } from "../../src/domain/types";
import { emptyMemory } from "../../src/session/history";
import { entry, move, sets } from "../helpers/history";

const STANDARDS: ExerciseStandards = {
  novice: 1,
  beginner: 3,
  intermediate: 8,
  advanced: 12,
  elite: 20,
};

function sortedMoveIds(moves: readonly MoveSuggestion[]): string[] {
  return moves.map((m) => m.exerciseId).sort();
}

function declared(joint: JointId): JointHistoryEntry[] {
  return [{ joint, side: "both", kind: "other" }];
}

/** Push-heavy / pull-empty suggest input with a custom pull candidate graph. */
function pullSuggestInput(graph: Record<string, SeedExercise>) {
  return {
    pairs: pairs({ push_pull: [5, 0] }),
    levels: allLevels("moderate", { lats: "none" }),
    graph,
    equipment: [] as EquipmentId[],
  };
}

const NOW = Date.parse("2026-11-20T08:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (days: number): string => new Date(NOW - days * DAY_MS).toISOString();

const GRAPH: Record<string, SeedExercise> = Object.fromEntries(
  [
    move("push", "horizontal_push", ["chest", "triceps"]),
    move("press", "vertical_push", ["shoulders"]),
    move("row", "horizontal_pull", ["lats", "middle back"], { requires: ["bar"] }),
    move("band_pull", "horizontal_pull", ["traps", "middle back"], { requires: ["band"] }),
    move("towel_row", "horizontal_pull", ["lats"]),
    move("chin", "vertical_pull", ["lats", "biceps"], { requires: ["bar"] }),
    move("squat", "squat", ["quadriceps"]),
    move("hinge", "hinge", ["hamstrings", "glutes"]),
    move("superman", "hinge", ["lower back"]),
    move("plank", "core_anti_extension", ["abdominals"]),
    move("stretch", "mobility", ["lats"]),
  ].map((exercise) => [exercise.id, exercise]),
);

function pairById(pairs: readonly PairResult[], id: PairId): PairResult {
  return pairs.find((pair) => pair.id === id)!;
}

function allLevels(level: Level, overrides: Partial<Record<MuscleGroup, Level>> = {}): Record<MuscleGroup, Level> {
  return Object.fromEntries(AREA_ORDER.map((area) => [area, overrides[area] ?? level])) as Record<MuscleGroup, Level>;
}

/** Pairs from raw amounts, each built in isolation; missing pairs have no work. */
function pairs(amounts: Partial<Record<PairId, [number, number]>>): PairResult[] {
  const build: Record<PairId, (a: number, b: number) => PairResult> = {
    push_pull: (a, b) => computePairs({}, { horizontal_push: a, horizontal_pull: b })[0]!,
    upper_lower: (a, b) => computePairs({}, { horizontal_push: a, squat: b })[1]!,
    front_back: (a, b) => computePairs({ chest: a, lats: b }, {})[2]!,
    squat_hinge: (a, b) => computePairs({}, { squat: a, hinge: b })[3]!,
    abs_lower_back: (a, b) => computePairs({ abdominals: a, "lower back": b }, {})[4]!,
  };
  return PAIRS.map((spec) => {
    const [a, b] = amounts[spec.id] ?? [0, 0];
    return build[spec.id](a, b);
  });
}

describe("levels: the median rule", () => {
  it("Not trained is 0; Heavy ≥1.5m, Moderate ≥0.75m, Light above 0", () => {
    // trained scores 1, 3, 4, 6, 9 → median 4: heavy ≥ 6, moderate ≥ 3
    const levels = levelsFromScores({ chest: 9, lats: 6, quadriceps: 4, glutes: 3, calves: 1 });
    expect(levels.chest).toBe("heavy");
    expect(levels.lats).toBe("heavy");
    expect(levels.quadriceps).toBe("moderate");
    expect(levels.glutes).toBe("moderate");
    expect(levels.calves).toBe("light");
    expect(levels.neck).toBe("none");
  });

  it("uses the mean of the middle two for an even count", () => {
    // 2, 4, 6, 8 → median 5: moderate from 3.75, heavy from 7.5
    const levels = levelsFromScores({ chest: 2, lats: 4, quadriceps: 6, glutes: 8 });
    expect([levels.chest, levels.lats, levels.quadriceps, levels.glutes]).toEqual([
      "light", "moderate", "moderate", "heavy",
    ]);
  });

  it("one trained area is Moderate", () => {
    const levels = levelsFromScores({ chest: 0.25 });
    expect(levels.chest).toBe("moderate");
    expect(AREA_ORDER.filter((area) => levels[area] === "none")).toHaveLength(AREA_ORDER.length - 1);
  });
});

describe("takeaway: the ⅓ rule", () => {
  const pushPull = PAIRS[0]!;
  it("is Even when the smaller share is exactly one third", () => {
    expect(takeaway(pushPull, 2, 1)).toMatchObject({ kind: "even", word: "Even" });
    expect(takeaway(pushPull, 1, 2)).toMatchObject({ kind: "even", word: "Even" });
  });
  it("is Mostly <bigger side> just under one third", () => {
    expect(takeaway(pushPull, 2.01, 1)).toMatchObject({ kind: "mostly", word: "Mostly push", heavySide: 0 });
    expect(takeaway(pushPull, 1, 2.01)).toMatchObject({ kind: "mostly", word: "Mostly pull", heavySide: 1 });
  });
  it("is No <smaller side> at 0", () => {
    expect(takeaway(pushPull, 5, 0)).toMatchObject({ kind: "no", word: "No pulling" });
    expect(takeaway(pushPull, 0, 5)).toMatchObject({ kind: "no", word: "No pushing" });
  });
  it("is Even at an exact 2:1 that floating point sums a hair short", () => {
    // Legacy rows split 10 sets into thirds and Overall decays them.
    const third = (10 / 3) * Math.exp(-0.37);
    let push = 0;
    let pull = 0;
    for (let session = 0; session < 3; session += 1) {
      push += third;
      push += third;
      pull += third;
    }
    expect(3 * pull >= push + pull).toBe(false);
    expect(takeaway(pushPull, push, pull)).toMatchObject({ kind: "even" });
  });
  it("is Neither when both sides are 0", () => {
    expect(takeaway(pushPull, 0, 0)).toMatchObject({ kind: "neither", word: "Neither in this window" });
  });
  it("names every pair's sides", () => {
    const words = PAIRS.map((spec) => [takeaway(spec, 1, 0).word, takeaway(spec, 0, 1).word, takeaway(spec, 9, 1).word]);
    expect(words).toEqual([
      ["No pulling", "No pushing", "Mostly push"],
      ["No lower body", "No upper body", "Mostly upper"],
      ["No back", "No front", "Mostly front"],
      ["No hinging", "No squatting", "Mostly squat"],
      ["No lower back work", "No ab work", "Mostly abs"],
    ]);
    expect(takeaway(PAIRS[4]!, 1, 9).word).toBe("Mostly lower back");
  });
});

describe("pairs", () => {
  it("come from movement pattern for Push v Pull, Upper v Lower and Squat v Hinge", () => {
    const result = computePairs(
      {},
      { horizontal_push: 3, vertical_push: 1, horizontal_pull: 2, vertical_pull: 2, squat: 3, hinge: 1, core_compression: 50 },
    );
    expect(pairById(result, "push_pull").amounts).toEqual([4, 4]);
    expect(pairById(result, "upper_lower").amounts).toEqual([8, 4]);
    expect(pairById(result, "squat_hinge").amounts).toEqual([3, 1]);
    expect(pairShares(pairById(result, "squat_hinge"))).toEqual([75, 25]);
  });

  it("Front v Back sums its muscle areas and leaves out shoulders, forearms, neck, adductors, abductors", () => {
    const scores: MuscleLoadMap = {
      chest: 1, abdominals: 1, quadriceps: 1, biceps: 1,
      traps: 1, lats: 1, "middle back": 1, "lower back": 1, glutes: 1, hamstrings: 1, calves: 1, triceps: 1,
      shoulders: 100, forearms: 100, neck: 100, adductors: 100, abductors: 100,
    };
    expect(pairById(computePairs(scores, {}), "front_back").amounts).toEqual([4, 8]);
  });

  it("Abs v Lower back reads the abdominals and lower back scores", () => {
    const result = computePairs({ abdominals: 6, "lower back": 2 }, {});
    expect(pairById(result, "abs_lower_back")).toMatchObject({ amounts: [6, 2], kind: "mostly", word: "Mostly abs" });
    expect(pairById(computePairs({ abdominals: 3 }, {}), "abs_lower_back").word).toBe("No lower back work");
    expect(pairById(computePairs({ "lower back": 3 }, {}), "abs_lower_back").word).toBe("No ab work");
    expect(pairById(computePairs({}, {}), "abs_lower_back")).toMatchObject({
      kind: "neither",
      word: "Neither in this window",
    });
  });

  it("are listed with Abs v Lower back last", () => {
    expect(PAIRS.map((pair) => pair.label)).toEqual([
      "Push v Pull", "Upper v Lower", "Front v Back", "Squat v Hinge", "Abs v Lower back",
    ]);
  });
});

describe("set counting", () => {
  it("counts per exercise from sets[] when present, skipping skipped sets", () => {
    const counted = setsPerExercise(
      entry({ setCount: 9, exerciseIds: ["push", "row"], sets: [...sets("push", 3), ...sets("row", 1), ...sets("row", 1, "skipped")] }),
    );
    expect(Object.fromEntries(counted)).toEqual({ push: 3, row: 1 });
  });

  it("spreads setCount evenly over exerciseIds for legacy entries", () => {
    expect(Object.fromEntries(setsPerExercise(entry({ setCount: 6, exerciseIds: ["push", "row", "squat"] })))).toEqual({
      push: 2, row: 2, squat: 2,
    });
  });

  it("legacy and set-log entries give different pattern totals for the same moves", () => {
    const legacy = entry({ setCount: 4, exerciseIds: ["push", "row"] });
    const logged = entry({ ...legacy, sets: [...sets("push", 3), ...sets("row", 1)] });
    expect(patternSets([legacy], "month", NOW, GRAPH)).toEqual({ horizontal_push: 2, horizontal_pull: 2 });
    expect(patternSets([logged], "month", NOW, GRAPH)).toEqual({ horizontal_push: 3, horizontal_pull: 1 });
  });

  it("decays older sessions in Overall and drops them outside a period", () => {
    const old = entry({ completedAt: daysAgo(100), setCount: 2, exerciseIds: ["push"] });
    const overall = patternSets([old], "overall", NOW, GRAPH).horizontal_push!;
    expect(overall).toBeGreaterThan(0);
    expect(overall).toBeLessThan(2);
    expect(patternSets([old], "month", NOW, GRAPH)).toEqual({});
    expect(patternSets([old], "half_year", NOW, GRAPH)).toEqual({ horizontal_push: 2 });
  });
});

describe("caricature choice", () => {
  it("is even when no pair is uneven", () => {
    expect(chooseCaricature(pairs({ push_pull: [1, 1], squat_hinge: [2, 1] }))).toBe("even");
  });

  it("is untrained when no pair has work", () => {
    expect(chooseCaricature(pairs({}))).toBe("untrained");
  });

  it.each([
    [{ push_pull: [5, 0] }, "mostly-push"],
    [{ push_pull: [1, 5] }, "mostly-pull"],
    [{ upper_lower: [5, 1] }, "upper-heavy"],
    [{ upper_lower: [1, 5] }, "lower-heavy"],
    [{ squat_hinge: [5, 1] }, "mostly-squat"],
    [{ squat_hinge: [1, 5] }, "mostly-hinge"],
    [{ front_back: [5, 1] }, "front-heavy"],
    [{ front_back: [1, 5] }, "back-heavy"],
    [{ abs_lower_back: [5, 0] }, "front-heavy"],
    [{ abs_lower_back: [0, 5] }, "back-heavy"],
  ] as Array<[Partial<Record<PairId, [number, number]>>, string]>)("one uneven pair %j → %s", (amounts, expected) => {
    expect(chooseCaricature(pairs(amounts))).toBe(expected);
  });

  it.each([
    [{ push_pull: [5, 0], upper_lower: [9, 1] }, "push-upper"],
    [{ push_pull: [5, 0], front_back: [9, 1] }, "push-front"],
    [{ push_pull: [0, 5], upper_lower: [9, 1] }, "pull-upper"],
    [{ upper_lower: [1, 9], squat_hinge: [8, 1] }, "lower-squat"],
    [{ upper_lower: [1, 9], squat_hinge: [1, 8] }, "lower-hinge"],
    [{ upper_lower: [9, 1], front_back: [8, 1] }, "upper-front"],
  ] as Array<[Partial<Record<PairId, [number, number]>>, string]>)("two uneven pairs %j → %s", (amounts, expected) => {
    expect(chooseCaricature(pairs(amounts))).toBe(expected);
  });

  it("falls back to the most uneven pair's single when no combination exists", () => {
    // push heavy + back heavy: no push-back figure; push is more uneven.
    expect(chooseCaricature(pairs({ push_pull: [5, 0], front_back: [1, 4] }))).toBe("mostly-push");
    expect(chooseCaricature(pairs({ push_pull: [4, 1], front_back: [0, 5] }))).toBe("back-heavy");
  });

  it("combines only the two most uneven pairs", () => {
    // squat 10:1 and push 9:1 are the top two (no combination); upper 4:1 is third.
    expect(chooseCaricature(pairs({ squat_hinge: [10, 1], push_pull: [9, 1], upper_lower: [4, 1] }))).toBe("mostly-squat");
  });

  it("Abs v Lower back combines where a front figure exists, with abs as front", () => {
    expect(chooseCaricature(pairs({ push_pull: [5, 0], abs_lower_back: [9, 1] }))).toBe("push-front");
    expect(chooseCaricature(pairs({ upper_lower: [9, 1], abs_lower_back: [5, 0] }))).toBe("upper-front");
  });

  it("Abs v Lower back and Front v Back uneven the same way stay a single figure", () => {
    expect(chooseCaricature(pairs({ front_back: [5, 0], abs_lower_back: [5, 0] }))).toBe("front-heavy");
    expect(chooseCaricature(pairs({ front_back: [0, 5], abs_lower_back: [1, 9] }))).toBe("back-heavy");
  });

  it("Abs v Lower back against an unrelated pair falls back to the most uneven single", () => {
    expect(chooseCaricature(pairs({ squat_hinge: [9, 1], abs_lower_back: [0, 5] }))).toBe("back-heavy");
  });

  it("has an inline SVG for every choice", () => {
    for (const svg of Object.values(CARICATURES)) {
      expect(svg).toMatch(/^<svg[^>]+viewBox="-185 -355 370 370"/);
      expect(svg).not.toContain("<style>");
      expect(svg).toMatch(/class="cv-[a-z-]+-s"/);
    }
    expect(Object.keys(CARICATURES)).toHaveLength(16);
    const ids: Record<CaricatureId, true> = {
      "mostly-push": true, "mostly-pull": true, "upper-heavy": true, "lower-heavy": true,
      "mostly-squat": true, "mostly-hinge": true, "front-heavy": true, "back-heavy": true,
      "push-upper": true, "push-front": true, "pull-upper": true, "lower-squat": true,
      "lower-hinge": true, "upper-front": true, "even": true, "untrained": true,
    };
    expect(Object.keys(CARICATURES).sort()).toEqual(Object.keys(ids).sort());
  });
});

describe("headline and sub-line", () => {
  it("names one even pair, then the most uneven pair", () => {
    expect(headlineFor(pairs({ squat_hinge: [45, 55], push_pull: [5, 0] }))).toBe(
      "Squat and hinge are even. Pushing has no pulling to match.",
    );
  });

  it("counts several even pairs and uses 'outweighs' for Mostly", () => {
    expect(headlineFor(pairs({ push_pull: [5, 1], upper_lower: [1, 1], squat_hinge: [1, 1], front_back: [1, 1] }))).toBe(
      "Three pairs are even. Pushing outweighs pulling.",
    );
  });

  it.each([
    [0, "Pushing has no pulling to match."],
    [1, "Squat and hinge are even. Pushing has no pulling to match."],
    [2, "Two pairs are even. Pushing has no pulling to match."],
    [3, "Three pairs are even. Pushing has no pulling to match."],
    [4, "Four pairs are even. Pushing has no pulling to match."],
  ])("reads well with %i even pairs beside an uneven one", (count, expected) => {
    const evenIds: PairId[] = ["squat_hinge", "upper_lower", "front_back", "abs_lower_back"];
    const amounts: Partial<Record<PairId, [number, number]>> = { push_pull: [5, 0] };
    for (const id of evenIds.slice(0, count)) {
      amounts[id] = [1, 1];
    }
    expect(headlineFor(pairs(amounts))).toBe(expected);
  });

  it("names each even pair from its sides", () => {
    const phrases: Record<PairId, string> = {
      push_pull: "Push and pull are even.",
      upper_lower: "Upper and lower are even.",
      front_back: "Front and back are even.",
      squat_hinge: "Squat and hinge are even.",
      abs_lower_back: "Abs and lower back are even.",
    };
    for (const id of PAIRS.map((pair) => pair.id)) {
      const other: PairId = id === "push_pull" ? "squat_hinge" : "push_pull";
      expect(headlineFor(pairs({ [id]: [1, 1], [other]: [5, 0] }))).toMatch(new RegExp(`^${phrases[id]}`));
    }
  });

  it("includes Abs v Lower back", () => {
    expect(headlineFor(pairs({ abs_lower_back: [4, 0] }))).toBe("Abs have no lower-back work to match.");
    expect(headlineFor(pairs({ abs_lower_back: [1, 4] }))).toBe("Lower back outweighs ab work.");
  });

  it("says when everything is even, or when no pair has work", () => {
    expect(
      headlineFor(pairs({ push_pull: [1, 1], upper_lower: [1, 1], squat_hinge: [1, 1], front_back: [1, 1], abs_lower_back: [1, 1] })),
    ).toBe("All five pairs are even in this window.");
    expect(headlineFor(pairs({ push_pull: [1, 1] }))).toBe("Every pair with work is even in this window.");
    expect(headlineFor(pairs({}))).toBe("No push, pull, squat, hinge or core work in this window.");
  });

  it("never names a body area in the headline", () => {
    const text = headlineFor(pairs({ push_pull: [5, 0], squat_hinge: [1, 1] }));
    for (const area of AREA_ORDER.filter((a) => a !== "lower back")) {
      expect(text.toLowerCase()).not.toContain(area);
    }
  });

  it("sub-line names the light side's untrained areas first", () => {
    const levels = allLevels("moderate", { lats: "none", "middle back": "none", traps: "none", neck: "none" });
    expect(sublineFor(pairs({ push_pull: [5, 0] }), levels)).toBe("Traps, lats and middle back had none in this window.");
    expect(sublineFor(pairs({ squat_hinge: [1, 1] }), levels)).toBe("Neck, traps, lats and 1 more had none in this window.");
    expect(sublineFor(pairs({ squat_hinge: [1, 1] }), allLevels("light"))).toBe("Every area had some work in this window.");
  });
});

describe("Consider adding", () => {
  const levels = allLevels("moderate", { lats: "none", "middle back": "none", traps: "light", "lower back": "none", biceps: "moderate" });

  it("suggests light-side moves with Not trained or Light primaries, ranked by coverage", () => {
    const moves = suggestMoves({ pairs: pairs({ push_pull: [5, 0] }), levels, graph: GRAPH, equipment: ["bar", "band"] });
    expect(moves.map((m) => m.exerciseId)).toEqual(["band_pull", "row", "chin"]);
    expect(moves[0]!.areas).toEqual(["traps", "middle back"]);
    expect(moves.length).toBeLessThanOrEqual(3);
  });

  it("respects the user's equipment", () => {
    const equipment: EquipmentId[] = [];
    const moves = suggestMoves({ pairs: pairs({ push_pull: [5, 0] }), levels, graph: GRAPH, equipment });
    expect(moves.map((m) => m.exerciseId)).toEqual(["towel_row"]);
    for (const m of moves) {
      expect(GRAPH[m.exerciseId]!.requires ?? []).toEqual([]);
    }
  });

  it("skips excluded moves and moves on the heavy side", () => {
    const moves = suggestMoves({
      pairs: pairs({ push_pull: [5, 0] }), levels, graph: GRAPH, equipment: ["bar", "band"], excluded: ["band_pull"],
    });
    expect(moves.map((m) => m.exerciseId)).not.toContain("band_pull");
    expect(moves.every((m) => GRAPH[m.exerciseId]!.pattern.endsWith("pull"))).toBe(true);
  });

  it("shows names in sentence case, keeping proper nouns", () => {
    const named: Record<string, SeedExercise> = {
      inverted_row: move("inverted_row", "horizontal_pull", ["lats"], { name: "Neutral-Grip Inverted Row" }),
      kneeling_superman: move("kneeling_superman", "hinge", ["lower back"], { name: "Kneeling Superman" }),
    };
    const pull = suggestMoves({ pairs: pairs({ push_pull: [5, 0] }), levels, graph: named, equipment: [] });
    expect(pull.map((m) => m.name)).toEqual(["Neutral-grip inverted row"]);
    const back = suggestMoves({ pairs: pairs({ abs_lower_back: [5, 0] }), levels, graph: named, equipment: [] });
    expect(back.map((m) => m.name)).toEqual(["Kneeling Superman"]);
  });

  it("uses areas for Abs v Lower back", () => {
    const moves = suggestMoves({ pairs: pairs({ abs_lower_back: [5, 0] }), levels, graph: GRAPH, equipment: [] });
    expect(moves.map((m) => m.exerciseId)).toEqual(["superman"]);
  });

  it("lists only Not trained areas when every pair is even, and nothing without work", () => {
    const even = suggestMoves({ pairs: pairs({ push_pull: [1, 1] }), levels, graph: GRAPH, equipment: ["bar", "band"] });
    expect(even.every((m) => m.areas.every((area) => levels[area] === "none"))).toBe(true);
    expect(suggestMoves({ pairs: pairs({}), levels, graph: GRAPH, equipment: [] })).toEqual([]);
  });

  it("real Library suggestions exist and need only owned gear", () => {
    const history = [
      entry({ setCount: 8, exerciseIds: ["bodyweight_squat", "glute_bridge"], sets: undefined }),
      entry({ exerciseIds: ["scap_pushup"] }),
    ];
    // No-gear Library pulls are beginner; seed a pull median so difficulty filter can match.
    const memories: Record<string, ExerciseMemory> = {
      ntc_reverse_snow_angel: {
        ...emptyMemory("ntc_reverse_snow_angel"),
        bestReps: 20,
        sessionsAtStandard: 1,
      },
    };
    const model = buildBalanceModel({
      mode: "overall",
      nowMs: NOW,
      history,
      graph: EXERCISE_GRAPH,
      equipment: [],
      memories,
    });
    expect(model.moves.length).toBeGreaterThan(0);
    for (const suggestion of model.moves) {
      const exercise = EXERCISE_GRAPH[suggestion.exerciseId];
      expect(exercise).toBeDefined();
      expect(exercise!.requires ?? []).toEqual([]);
      expect(exercise!.difficulty ?? "intermediate").toBe("beginner");
    }
  });

  it("drops high catalogue load on a declared joint; keeps moderate and undeclared", () => {
    const base = pullSuggestInput({
      safe_row: move("safe_row", "horizontal_pull", ["lats"], { name: "Towel row", difficulty: "intermediate" }),
      high_elbow: move("high_elbow", "horizontal_pull", ["lats"], { name: "One-arm row", difficulty: "intermediate" }),
      mod_pull: move("mod_pull", "horizontal_pull", ["lats"], { name: "Pull-up", difficulty: "intermediate" }),
    });
    expect(sortedMoveIds(suggestMoves({ ...base, jointHistory: declared("elbow") }))).toEqual([
      "mod_pull",
      "safe_row",
    ]);
    expect(sortedMoveIds(suggestMoves({ ...base, jointHistory: declared("knee") }))).toEqual([
      "high_elbow",
      "mod_pull",
      "safe_row",
    ]);
    expect(sortedMoveIds(suggestMoves(base))).toEqual(["high_elbow", "mod_pull", "safe_row"]);
  });

  it("keeps only difficulty matching By pattern median; missing pattern → intermediate; novice → beginner", () => {
    const base = pullSuggestInput({
      trained: move("trained", "horizontal_pull", ["lats"], {
        name: "Trained row",
        difficulty: "intermediate",
        standards: STANDARDS,
      }),
      beg: move("beg", "horizontal_pull", ["lats"], { name: "Beginner row", difficulty: "beginner" }),
      mid: move("mid", "horizontal_pull", ["lats"], { name: "Middle row", difficulty: "intermediate" }),
      adv: move("adv", "horizontal_pull", ["lats"], { name: "Advanced row", difficulty: "advanced" }),
    });
    const withBest = (bestReps: number): Record<string, ExerciseMemory> => ({
      trained: { ...emptyMemory("trained"), bestReps, sessionsAtStandard: 1 },
    });

    expect(sortedMoveIds(suggestMoves(base))).toEqual(["mid", "trained"]);
    expect(sortedMoveIds(suggestMoves({ ...base, memories: withBest(10) }))).toEqual(["mid", "trained"]);
    expect(suggestMoves({ ...base, memories: withBest(1) }).map((m) => m.exerciseId)).toEqual(["beg"]);
  });
});

describe("buildBalanceModel", () => {
  it("is empty with no history", () => {
    const model = buildBalanceModel({ mode: "overall", nowMs: NOW, history: [], graph: GRAPH, equipment: [] });
    expect(model).toMatchObject({ state: "empty", caricature: "untrained", moves: [] });
    expect(Object.values(model.levels).every((level) => level === "none")).toBe(true);
  });

  it("has no sessions in a window with none, and offers a wider one", () => {
    const history = [entry({ completedAt: daysAgo(120) })];
    const model = buildBalanceModel({ mode: "month", nowMs: NOW, history, graph: GRAPH, equipment: [] });
    expect(model).toMatchObject({ state: "no_sessions", headline: "No sessions in the last 30 days", tryMode: "half_year", caricature: "untrained" });
    expect(model.pairs.every((pair) => pair.word === "No data in this window")).toBe(true);
    expect(model.accent).toBeUndefined();
  });

  it("puts the accent on the most uneven pair and none when all are even", () => {
    const scores: MuscleLoadMap = { chest: 4, triceps: 4, lats: 4, quadriceps: 4, abdominals: 4, "lower back": 4 };
    const uneven = buildBalanceModel({
      mode: "month", nowMs: NOW, graph: GRAPH, equipment: [], scores,
      history: [entry({ setCount: 6, exerciseIds: ["push", "squat", "hinge"] })],
    });
    expect(uneven.accent).toBe("push_pull");
    const even = buildBalanceModel({
      mode: "month", nowMs: NOW, graph: GRAPH, equipment: [], scores,
      history: [entry({ setCount: 4, exerciseIds: ["push", "row", "squat", "hinge"] })],
    });
    expect(even.pairs.filter((pair) => pair.kind !== "even")).toEqual([]);
    expect(even.accent).toBeUndefined();
    expect(even.caricature).toBe("even");
  });

  it("Abs v Lower back can carry the accent", () => {
    const model = buildBalanceModel({
      mode: "month", nowMs: NOW, graph: GRAPH, equipment: [],
      scores: { chest: 1, lats: 1, abdominals: 5 },
      history: [entry({ setCount: 4, exerciseIds: ["push", "row", "squat", "hinge"] })],
    });
    expect(model.accent).toBe("abs_lower_back");
    expect(model.caricature).toBe("front-heavy");
  });
});
