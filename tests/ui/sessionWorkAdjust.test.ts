import { describe, expect, it } from "vitest";
import { DEFAULT_PLAN_QUEUE, SESSION_TEMPLATES, templateToStarter } from "../../src/data/seed";
import type { Readiness } from "../../src/domain/types";
import { easierChoice, undoExclude } from "../../src/plan/dayEdits";
import { loadExcluded } from "../../src/plan/exclusions";
import type { AthleteState } from "../../src/plan/dayPreview";
import { resolveTemplate } from "../../src/plan/templates";
import { planSession, type PlannedSession } from "../../src/rules/planSession";
import {
  applyEasierWork,
  applyNeverAgainWork,
  applySkipToday,
  applySwapWork,
  dayExerciseIds,
  replaceWorkMove,
} from "../../src/ui/sessionWorkAdjust";
import { useMemoryStorage } from "../helpers/storage";

useMemoryStorage(() => ({ "aurora.poc.planQueue.v1": JSON.stringify(DEFAULT_PLAN_QUEUE) }));

const readiness: Readiness = { sleepQuality: "good", restingHrBpm: 58, painJoints: [] };

function athlete(over: Partial<AthleteState> = {}): AthleteState {
  return {
    memories: {},
    history: [],
    jointHistory: [],
    equipment: ["body", "bar"],
    excluded: [],
    deloadActive: false,
    ...over,
  };
}

function planLegs(): PlannedSession {
  const template = SESSION_TEMPLATES.find((item) => item.id === "tmpl_legs")!;
  return planSession(readiness, templateToStarter(template), {});
}

describe("dayExerciseIds", () => {
  it("lists other work moves, not the current slot", () => {
    const planned = planLegs();
    const ids = dayExerciseIds(planned, 0);
    expect(ids).not.toContain(planned.work[0]!.exerciseId);
    expect(ids).toEqual(planned.work.slice(1).map((item) => item.exerciseId));
  });
});

describe("replaceWorkMove", () => {
  it("rewrites identity to the new exercise and keeps the slot id", () => {
    const planned = planLegs();
    const item = planned.work[0]!;
    const next = replaceWorkMove(item, "bodyweight_squat", readiness, false);
    expect(next.slotId).toBe(item.slotId);
    expect(next.exerciseId).toBe("bodyweight_squat");
    expect(next.exerciseName.toLowerCase()).toContain("squat");
    expect(next.dose.sets).toBeGreaterThan(0);
  });
});

describe("applyEasierWork", () => {
  it("writes the Plan slot and returns a rewritten live item", () => {
    const planned = planLegs();
    const index = planned.work.findIndex((item) => easierChoice(item.exerciseId, athlete(), dayExerciseIds(planned, planned.work.indexOf(item))));
    expect(index).toBeGreaterThanOrEqual(0);
    const before = planned.work[index]!;
    const pick = easierChoice(before.exerciseId, athlete(), dayExerciseIds(planned, index))!;
    const result = applyEasierWork({ planned, workIndex: index, athlete: athlete() });
    expect(result.finishExercise).toBe(false);
    expect(result.status).toMatch(/^Easier:/);
    expect(result.planned.work[index]!.exerciseId).toBe(pick.id);
    expect(resolveTemplate(planned.programId).slots.find((slot) => slot.id === before.slotId)!.exerciseId).toBe(pick.id);
  });
});

describe("applySwapWork", () => {
  it("puts the picked move on the Plan slot and in the live item", () => {
    const planned = planLegs();
    const item = planned.work[0]!;
    const result = applySwapWork({ planned, workIndex: 0, athlete: athlete() }, "bodyweight_squat");
    expect(result.finishExercise).toBe(false);
    expect(result.planned.work[0]!.exerciseId).toBe("bodyweight_squat");
    expect(result.status).toMatch(/Swapped to/i);
    expect(resolveTemplate(planned.programId).slots.find((slot) => slot.id === item.slotId)!.exerciseId).toBe(
      "bodyweight_squat",
    );
  });
});

describe("applySkipToday", () => {
  it("asks to finish the exercise without touching exclusions", () => {
    const before = loadExcluded();
    const result = applySkipToday();
    expect(result.finishExercise).toBe(true);
    expect(result.status).toMatch(/Skipped for today/i);
    expect(loadExcluded()).toEqual(before);
  });
});

describe("applyNeverAgainWork", () => {
  it("excludes the move and substitutes when one fits", () => {
    const planned = planLegs();
    const item = planned.work.find((row) => row.exerciseId === "nordic_curl") ?? planned.work[0]!;
    const index = planned.work.indexOf(item);
    const result = applyNeverAgainWork({ planned, workIndex: index, athlete: athlete() });
    expect(loadExcluded()).toContain(item.exerciseId);
    expect(result.undo).toBeDefined();
    expect(result.status).toMatch(/Excluded:/);
    if (result.finishExercise) {
      expect(result.planned.work[index]!.exerciseId).toBe(item.exerciseId);
    } else {
      expect(result.planned.work[index]!.exerciseId).not.toBe(item.exerciseId);
    }
    undoExclude(result.undo!);
  });
});
