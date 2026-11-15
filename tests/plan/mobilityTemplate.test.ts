import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_PLAN_QUEUE,
  SESSION_TEMPLATES,
  TEMPLATE_BY_ID,
  templateToStarter,
} from "../../src/data/seed";
import type { HistoryEntry } from "../../src/domain/program";
import type { ExerciseMemory } from "../../src/domain/types";
import { completeNext } from "../../src/plan/queue";
import {
  resetTemplateOverridesForTests,
  resolveTemplate,
} from "../../src/plan/templates";
import { planSession } from "../../src/rules/planSession";
import { estimateSessionDuration } from "../../src/rules/sessionDuration";

const MOBILITY_EXERCISES = [
  "wrist_load",
  "hip_circles",
  "ankle_rocks",
  "scap_pushup",
  "glute_bridge",
];

function mobility() {
  return TEMPLATE_BY_ID.tmpl_mobility;
}

describe("tmpl_mobility", () => {
  beforeEach(() => {
    resetTemplateOverridesForTests();
  });

  it("is offered alongside the other session templates", () => {
    expect(SESSION_TEMPLATES.map((template) => template.id)).toContain(
      "tmpl_mobility",
    );
    expect(resolveTemplate("tmpl_mobility").focus).toBe("mobility");
  });

  it("uses the prehab exercises from the issue", () => {
    expect(mobility().slots.map((slot) => slot.exerciseId)).toEqual(
      MOBILITY_EXERCISES,
    );
  });

  it("pins every slot so strength chains never advance", () => {
    expect(mobility().slots.every((slot) => slot.pinned)).toBe(true);
  });

  it("estimates 10–20 minutes", () => {
    expect(mobility().targetMinutes).toEqual({ minMinutes: 10, maxMinutes: 20 });
    const estimate = estimateSessionDuration(mobility());
    expect(estimate.withinTarget).toBe(true);
  });

  it("is optional: not in the default queue and not re-appended on completion", () => {
    expect(DEFAULT_PLAN_QUEUE.items).not.toContain("tmpl_mobility");
    expect(mobility().repeat).toBe(false);
    const next = completeNext({ items: ["tmpl_mobility", "tmpl_legs"] });
    expect(next.items).toEqual(["tmpl_legs"]);
  });

  it("keeps the strength default queue unchanged", () => {
    expect(DEFAULT_PLAN_QUEUE.items).toEqual([
      "tmpl_legs",
      "tmpl_legs",
      "tmpl_legs",
      "tmpl_skill_hs",
      "tmpl_abs",
      "tmpl_bars",
    ]);
  });
});

describe("planSession for Mobility", () => {
  const starter = templateToStarter(mobility());

  it("does not advance pinned slots even when the standard is met", () => {
    const memories: Record<string, ExerciseMemory> = {
      scap_pushup: {
        exerciseId: "scap_pushup",
        sessionsAtStandard: 5,
        sessionsBelowFloor: 0,
        lastAddedLoadKg: 0,
        weakLinkSessionsRemaining: 0,
        bestReps: 40,
      },
    };
    const session = planSession({ painJoints: [] }, starter, memories);
    expect(session.work.map((item) => item.exerciseId)).toEqual(
      MOBILITY_EXERCISES,
    );
    for (const item of session.work) {
      expect(item.ruleIds).toContain("pin");
      expect(item.ruleIds).not.toContain("advance");
    }
  });

  it("repeats the same moves on back-to-back Mobility days", () => {
    const history: HistoryEntry[] = [
      {
        id: "1",
        completedAt: "2026-11-14T08:00:00.000Z",
        templateId: "tmpl_mobility",
        templateName: "Mobility",
        evaluation: "on_target",
        setCount: 10,
        exerciseIds: MOBILITY_EXERCISES,
      },
    ];
    const session = planSession({ painJoints: [] }, starter, {}, {
      focus: "mobility",
      history,
    });
    expect(session.work.map((item) => item.exerciseId)).toEqual(
      MOBILITY_EXERCISES,
    );
  });
});
