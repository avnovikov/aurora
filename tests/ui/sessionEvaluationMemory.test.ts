/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlannedSession } from "../../src/rules/planSession";
import { emptyMemory, loadMemories, saveMemories } from "../../src/session/history";
import type { WorkoutLog } from "../../src/session/setLog";
import { EVALUATION_ARM_MS, renderEvaluationView } from "../../src/ui/evaluationView";
import { commitSessionEvaluation } from "../../src/ui/sessionEvaluation";
import { useMemoryStorage } from "../helpers/storage";

useMemoryStorage();

function plannedStub(exerciseIds: string[]): PlannedSession {
  return {
    programId: "tmpl_legs",
    sessionLabel: "Lower body · A",
    lightDay: false,
    deload: false,
    warmup: [],
    work: exerciseIds.map((exerciseId, index) => ({
      slotId: `slot_${index}`,
      exerciseId,
      name: exerciseId,
      dose: { sets: 2, reps: 8, effort: "reps" as const },
      restSeconds: 60,
      ruleIds: [],
      reason: "test",
    })),
  } as PlannedSession;
}

function logAtTarget(exerciseId: string): WorkoutLog {
  return {
    entries: [
      Object.freeze({
        id: "s1",
        slotId: "slot_0",
        exerciseId,
        setIndex: 1,
        prescribedReps: 8,
        completedReps: 8,
        addedLoadKg: 0,
        stopReason: "completed" as const,
        loggedAt: "2026-11-17T07:00:00.000Z",
      }),
    ],
  };
}

describe("session evaluation memory", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows Difficult, not Difficult / failed", () => {
    const root = document.createElement("div");
    renderEvaluationView(root, 3, () => undefined);
    const labels = [...root.querySelectorAll("[data-eval]")].map((el) => el.textContent);
    expect(labels).toContain("Difficult");
    expect(labels.some((label) => label?.includes("failed"))).toBe(false);
    expect(root.querySelector('[data-eval="difficult"]')).not.toBeNull();
    expect(root.querySelector('[data-eval="failed"]')).toBeNull();
  });

  it("does not stamp the session rating onto exercises — set log drives memory", () => {
    saveMemories({
      squat: { ...emptyMemory("squat"), sessionsAtStandard: 0, sessionsBelowFloor: 0 },
      curl: { ...emptyMemory("curl"), sessionsAtStandard: 3, sessionsBelowFloor: 0 },
    });
    const planned = plannedStub(["squat", "curl"]);
    const log = logAtTarget("squat");

    const result = commitSessionEvaluation({
      evaluation: "difficult",
      planned,
      log,
      memories: loadMemories(),
    });

    expect(result.history.evaluation).toBe("difficult");
    expect(result.memories.squat?.sessionsAtStandard).toBe(1);
    expect(result.memories.squat?.sessionsBelowFloor).toBe(0);
    expect(result.memories.curl).toEqual({
      ...emptyMemory("curl"),
      sessionsAtStandard: 3,
      sessionsBelowFloor: 0,
    });
  });

  it("picking Difficult after arming commits through the set-log path", () => {
    saveMemories({
      squat: emptyMemory("squat"),
      curl: { ...emptyMemory("curl"), sessionsAtStandard: 2 },
    });
    const root = document.createElement("div");
    let committed = false;
    renderEvaluationView(root, 1, (evaluation) => {
      const result = commitSessionEvaluation({
        evaluation,
        planned: plannedStub(["squat", "curl"]),
        log: logAtTarget("squat"),
        memories: loadMemories(),
      });
      saveMemories(result.memories);
      committed = true;
      expect(evaluation).toBe("difficult");
    });

    vi.advanceTimersByTime(EVALUATION_ARM_MS);
    root.querySelector<HTMLButtonElement>('[data-eval="difficult"]')?.click();
    expect(committed).toBe(true);
    const stored = loadMemories();
    expect(stored.squat?.sessionsAtStandard).toBe(1);
    expect(stored.curl?.sessionsAtStandard).toBe(2);
    expect(stored.curl?.sessionsBelowFloor).toBe(0);
  });
});
