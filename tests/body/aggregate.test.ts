import { describe, expect, it } from "vitest";
import {
  OVERALL_ANCHOR_DAYS,
  OVERALL_ANCHOR_WEIGHT,
  OVERALL_FULL_DAYS,
  aggregateBodyView,
  aggregateMuscleExercises,
  aggregateOverallMuscleLoad,
  isBodyViewMode,
  muscleGroupsOf,
  sessionAgeWeight,
  strongestWeightPerGroup,
  type BodyPeriod,
} from "../../src/body/aggregate";
import type { HistoryEntry } from "../../src/domain/program";
import type { Exercise } from "../../src/domain/types";
import { entry as baseEntry } from "../helpers/history";

const NOW = Date.parse("2026-11-14T08:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

const entry = (overrides: Partial<HistoryEntry> = {}): HistoryEntry =>
  baseEntry({
    id: "1",
    completedAt: "2026-11-13T08:00:00.000Z",
    templateId: "tmpl_test",
    templateName: "Test",
    exerciseIds: ["hollow_hold"],
    ...overrides,
  });

function daysAgo(days: number): string {
  return new Date(NOW - days * DAY_MS).toISOString();
}

describe("sessionAgeWeight", () => {
  it("is full credit through the two-week plateau", () => {
    expect(sessionAgeWeight(0)).toBe(1);
    expect(sessionAgeWeight(OVERALL_FULL_DAYS)).toBe(1);
  });

  it("hits the McMaster anchor at seven weeks", () => {
    expect(sessionAgeWeight(OVERALL_ANCHOR_DAYS)).toBeCloseTo(OVERALL_ANCHOR_WEIGHT, 10);
  });

  it("keeps fading after the anchor", () => {
    expect(sessionAgeWeight(OVERALL_ANCHOR_DAYS * 2)).toBeLessThan(OVERALL_ANCHOR_WEIGHT);
  });

  it("rejects non-finite ages", () => {
    expect(() => sessionAgeWeight(Number.NaN)).toThrow(/finite/);
  });
});

describe("aggregateOverallMuscleLoad", () => {
  it("scores recent sessions at full set × role weight", () => {
    const loads = aggregateOverallMuscleLoad([entry()], NOW);
    expect(loads.abdominals).toBe(4);
  });

  it("applies decay after the plateau", () => {
    const loads = aggregateOverallMuscleLoad(
      [entry({ completedAt: daysAgo(OVERALL_ANCHOR_DAYS), setCount: 4 })],
      NOW,
    );
    expect(loads.abdominals).toBeCloseTo(4 * OVERALL_ANCHOR_WEIGHT, 10);
  });

  it("weights primary 1.0 and secondary 0.5 of setCount", () => {
    const loads = aggregateOverallMuscleLoad(
      [entry({ setCount: 4, exerciseIds: ["bodyweight_squat"] })],
      NOW,
    );
    expect(loads.quadriceps).toBe(4);
    expect(loads.glutes).toBe(2);
  });

  it("skips bad setCount and bad dates", () => {
    expect(aggregateOverallMuscleLoad([entry({ setCount: 0 })], NOW)).toEqual({});
    expect(aggregateOverallMuscleLoad([entry({ completedAt: "nope" })], NOW)).toEqual({});
  });
});

describe("aggregateMuscleExercises", () => {
  it("counts each exercise once per muscle group", () => {
    const loads = aggregateMuscleExercises(
      [entry({ setCount: 99, exerciseIds: ["bodyweight_squat"] })],
      "month",
      NOW,
    );
    expect(loads.quadriceps).toBe(1);
    expect(loads.glutes).toBe(1);
  });

  it("sums appearances across sessions", () => {
    const loads = aggregateMuscleExercises(
      [
        entry({ id: "a", exerciseIds: ["hollow_hold"] }),
        entry({ id: "b", exerciseIds: ["hollow_hold"] }),
      ],
      "month",
      NOW,
    );
    expect(loads.abdominals).toBe(2);
  });

  it("ignores unknown exercise ids without dropping known ones", () => {
    const loads = aggregateMuscleExercises(
      [entry({ exerciseIds: ["not_a_real_exercise", "hollow_hold"] })],
      "year",
      NOW,
    );
    expect(loads).toEqual({ abdominals: 1 });
  });
});

describe("aggregateMuscleExercises period cutoffs", () => {
  const cases: Array<[BodyPeriod, number]> = [
    ["month", 30],
    ["quarter", 91],
    ["half_year", 182],
    ["year", 365],
  ];

  it.each(cases)("%s includes an entry exactly at the cutoff", (period, days) => {
    const loads = aggregateMuscleExercises([entry({ completedAt: daysAgo(days) })], period, NOW);
    expect(loads.abdominals).toBe(1);
  });

  it.each(cases)("%s excludes an entry one second past the cutoff", (period, days) => {
    const stale = new Date(NOW - days * DAY_MS - 1000).toISOString();
    expect(aggregateMuscleExercises([entry({ completedAt: stale })], period, NOW)).toEqual({});
  });

  it("counts an old session only in the longer periods", () => {
    const history = [entry({ completedAt: daysAgo(45) })];
    expect(aggregateMuscleExercises(history, "month", NOW)).toEqual({});
    expect(aggregateMuscleExercises(history, "quarter", NOW).abdominals).toBe(1);
  });
});

describe("aggregateBodyView", () => {
  it("routes overall to decayed load and periods to exercise counts", () => {
    const history = [entry({ setCount: 4, exerciseIds: ["hollow_hold"] })];
    expect(aggregateBodyView(history, "overall", NOW).abdominals).toBe(4);
    expect(aggregateBodyView(history, "month", NOW).abdominals).toBe(1);
  });

  it("throws on an unknown period", () => {
    expect(() => aggregateBodyView([entry()], "decade" as BodyPeriod, NOW)).toThrow(
      /Unknown body period/,
    );
  });
});

describe("strongestWeightPerGroup and muscleGroupsOf", () => {
  const exercise = {
    muscles: [
      { group: "lats", role: "secondary" },
      { group: "lats", role: "primary" },
      { group: "biceps", role: "stabilizer" },
    ],
  } as Exercise;

  it("credits a repeated group once at its strongest role", () => {
    const weights = strongestWeightPerGroup(exercise);
    expect(weights.get("lats")).toBe(1);
    expect(weights.get("biceps")).toBe(0.25);
    expect(weights.size).toBe(2);
  });

  it("lists each muscle group once when counting exercises", () => {
    expect(muscleGroupsOf(exercise).sort()).toEqual(["biceps", "lats"]);
  });
});

describe("isBodyViewMode", () => {
  it("accepts overall and period chips only", () => {
    expect(isBodyViewMode("overall")).toBe(true);
    expect(isBodyViewMode("month")).toBe(true);
    expect(isBodyViewMode("week")).toBe(false);
    expect(isBodyViewMode("decade")).toBe(false);
  });
});
