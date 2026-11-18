import { describe, expect, it } from "vitest";
import {
  aggregateMuscleLoad,
  maxLoad,
  strongestWeightPerGroup,
  topMuscles,
  type BodyPeriod,
} from "../../src/body/aggregate";
import type { HistoryEntry } from "../../src/domain/program";
import type { Exercise } from "../../src/domain/types";

const NOW = Date.parse("2026-11-14T08:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function entry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: "1",
    completedAt: "2026-11-13T08:00:00.000Z",
    templateId: "tmpl_test",
    templateName: "Test",
    evaluation: "on_target",
    setCount: 4,
    exerciseIds: ["hollow_hold"],
    ...overrides,
  };
}

function daysAgo(days: number): string {
  return new Date(NOW - days * DAY_MS).toISOString();
}

describe("aggregateMuscleLoad", () => {
  it("scores primary muscles from recent history", () => {
    const loads = aggregateMuscleLoad([entry()], "week", NOW);
    expect(loads.abdominals).toBe(4);
  });

  it("returns an empty map when there is no history", () => {
    expect(aggregateMuscleLoad([], "year", NOW)).toEqual({});
  });

  it("weights primary 1.0 and secondary 0.5 of setCount", () => {
    const loads = aggregateMuscleLoad(
      [entry({ setCount: 4, exerciseIds: ["bodyweight_squat"] })],
      "week",
      NOW,
    );
    expect(loads.quadriceps).toBe(4);
    expect(loads.glutes).toBe(2);
  });

  it("weights stabilizers at 0.25 of setCount", () => {
    const loads = aggregateMuscleLoad(
      [entry({ setCount: 4, exerciseIds: ["scap_pushup"] })],
      "week",
      NOW,
    );
    expect(loads.chest).toBe(4);
    expect(loads.shoulders).toBe(1);
  });

  it("sums the same muscle across exercises and sessions", () => {
    const loads = aggregateMuscleLoad(
      [
        entry({ id: "a", setCount: 3, exerciseIds: ["bodyweight_squat"] }),
        entry({ id: "b", setCount: 2, exerciseIds: ["bodyweight_squat"] }),
      ],
      "week",
      NOW,
    );
    expect(loads.quadriceps).toBe(5);
    expect(loads.glutes).toBe(2.5);
  });

  it("ignores unknown exercise ids without dropping known ones", () => {
    const loads = aggregateMuscleLoad(
      [entry({ exerciseIds: ["not_a_real_exercise", "hollow_hold"] })],
      "week",
      NOW,
    );
    expect(loads).toEqual({ abdominals: 4 });
  });

  it.each([0, -3, Number.NaN, Number.POSITIVE_INFINITY])(
    "skips entries with unusable setCount %s",
    (setCount) => {
      expect(aggregateMuscleLoad([entry({ setCount })], "week", NOW)).toEqual({});
    },
  );

  it("skips entries with an unparseable completedAt", () => {
    expect(aggregateMuscleLoad([entry({ completedAt: "yesterday-ish" })], "year", NOW)).toEqual({});
  });

  it("throws on an unknown period instead of silently returning nothing", () => {
    expect(() => aggregateMuscleLoad([entry()], "decade" as BodyPeriod, NOW)).toThrow(
      /Unknown body period/,
    );
  });
});

describe("aggregateMuscleLoad period cutoffs", () => {
  const cases: Array<[BodyPeriod, number]> = [
    ["week", 7],
    ["month", 30],
    ["quarter", 91],
    ["half_year", 182],
    ["year", 365],
  ];

  it.each(cases)("%s includes an entry exactly at the cutoff", (period, days) => {
    const loads = aggregateMuscleLoad([entry({ completedAt: daysAgo(days) })], period, NOW);
    expect(loads.abdominals).toBe(4);
  });

  it.each(cases)("%s excludes an entry one second past the cutoff", (period, days) => {
    const stale = new Date(NOW - days * DAY_MS - 1000).toISOString();
    expect(aggregateMuscleLoad([entry({ completedAt: stale })], period, NOW)).toEqual({});
  });

  it("counts an old session only in the longer periods", () => {
    const history = [entry({ completedAt: daysAgo(45) })];
    expect(aggregateMuscleLoad(history, "week", NOW)).toEqual({});
    expect(aggregateMuscleLoad(history, "month", NOW)).toEqual({});
    expect(aggregateMuscleLoad(history, "quarter", NOW).abdominals).toBe(4);
    expect(aggregateMuscleLoad(history, "year", NOW).abdominals).toBe(4);
  });

  it("sums only the sessions inside the window", () => {
    const history = [
      entry({ id: "recent", setCount: 3, completedAt: daysAgo(2) }),
      entry({ id: "old", setCount: 5, completedAt: daysAgo(20) }),
    ];
    expect(aggregateMuscleLoad(history, "week", NOW).abdominals).toBe(3);
    expect(aggregateMuscleLoad(history, "month", NOW).abdominals).toBe(8);
  });
});

describe("strongestWeightPerGroup", () => {
  it("credits a repeated group once at its strongest role", () => {
    const exercise = {
      muscles: [
        { group: "lats", role: "secondary" },
        { group: "lats", role: "primary" },
        { group: "biceps", role: "stabilizer" },
      ],
    } as Exercise;
    const weights = strongestWeightPerGroup(exercise);
    expect(weights.get("lats")).toBe(1);
    expect(weights.get("biceps")).toBe(0.25);
    expect(weights.size).toBe(2);
  });
});

describe("topMuscles and maxLoad", () => {
  const loads = { chest: 2, lats: 8, glutes: 5 };

  it("orders by score and honours the limit", () => {
    expect(topMuscles(loads, 2)).toEqual([
      ["lats", 8],
      ["glutes", 5],
    ]);
  });

  it("reports the largest score, or 0 when empty", () => {
    expect(maxLoad(loads)).toBe(8);
    expect(maxLoad({})).toBe(0);
  });
});
