import { beforeEach, describe, expect, it } from "vitest";
import type { SessionTemplate, TemplateSlot } from "../../src/domain/program";
import type { ExerciseMemory, ExerciseStandards } from "../../src/domain/types";
import { emptyMemory } from "../../src/progress/levelEvidence";
import {
  applyPlanLevelRaiseIfReady,
  clearPlanLevelRaiseNotice,
  loadPlanLevelRaiseNotice,
} from "../../src/plan/planLevelRaise";
import { loadPlanLevel, savePlanLevel } from "../../src/plan/planLevel";
import { useMemoryStorage } from "../helpers/storage";

useMemoryStorage();

const STANDARDS: ExerciseStandards = {
  novice: 1,
  beginner: 5,
  intermediate: 10,
  advanced: 15,
  elite: 20,
};

function slot(id: string, exerciseId: string): TemplateSlot {
  return {
    id,
    label: id,
    exerciseId,
    pattern: "squat",
    dose: { sets: 3, reps: 8, targetRir: 2, addedLoadKg: 0 },
    restSeconds: 60,
    pinned: false,
  };
}

function day(id: string, slots: TemplateSlot[]): SessionTemplate {
  return {
    id,
    name: id,
    focus: "legs",
    targetExerciseIds: [],
    warmupByLevel: { beginner: [], intermediate: [], advanced: [] },
    cooldownStationIds: [],
    slots,
    repeat: false,
  };
}

function mem(id: string, patch: Partial<ExerciseMemory> = {}): ExerciseMemory {
  return { ...emptyMemory(id), ...patch };
}

const readyDays = () => [
  day("d1", [slot("s1", "a"), slot("s2", "b")]),
  day("d2", [slot("s3", "c"), slot("s4", "d")]),
  day("d3", [slot("s5", "e")]),
];

const readyMemories = (): Record<string, ExerciseMemory> => {
  const at = { bestReps: 10, loggedTier: "intermediate" as const };
  return {
    a: mem("a", at),
    b: mem("b", at),
    c: mem("c", at),
    d: mem("d", at),
    e: mem("e", at),
  };
};

describe("applyPlanLevelRaiseIfReady", () => {
  beforeEach(() => {
    clearPlanLevelRaiseNotice();
    savePlanLevel("intermediate");
  });

  it("raises one tier and stores a notice when the gate passes", () => {
    const result = applyPlanLevelRaiseIfReady({
      days: readyDays(),
      memories: readyMemories(),
      standardsFor: () => STANDARDS,
    });
    expect(result).toEqual({ raised: true, from: "intermediate", to: "advanced" });
    expect(loadPlanLevel()).toBe("advanced");
    const notice = loadPlanLevelRaiseNotice();
    expect(notice?.from).toBe("intermediate");
    expect(notice?.to).toBe("advanced");
    expect(notice?.message).toMatch(/Advanced/i);
  });

  it("does nothing when the gate fails", () => {
    const memories = readyMemories();
    delete memories.d;
    delete memories.e; // 3/5 = 60% < 80%
    const result = applyPlanLevelRaiseIfReady({
      days: readyDays(),
      memories,
      standardsFor: () => STANDARDS,
    });
    expect(result.raised).toBe(false);
    expect(loadPlanLevel()).toBe("intermediate");
    expect(loadPlanLevelRaiseNotice()).toBeNull();
  });

  it("clears the notice after dismiss", () => {
    applyPlanLevelRaiseIfReady({
      days: readyDays(),
      memories: readyMemories(),
      standardsFor: () => STANDARDS,
    });
    clearPlanLevelRaiseNotice();
    expect(loadPlanLevelRaiseNotice()).toBeNull();
  });

  it("writes a concrete tier when plan level is auto", () => {
    savePlanLevel("auto");
    const at = { bestReps: 10, loggedTier: "intermediate" as const };
    const result = applyPlanLevelRaiseIfReady({
      days: readyDays(),
      memories: {
        a: mem("a", at),
        b: mem("b", at),
        c: mem("c", at),
        d: mem("d", at),
        e: mem("e", at),
      },
      standardsFor: () => STANDARDS,
    });
    expect(result).toEqual({ raised: true, from: "intermediate", to: "advanced" });
    expect(loadPlanLevel()).toBe("advanced");
  });

  it("does not raise from elite", () => {
    savePlanLevel("elite");
    const at = { bestReps: 20, loggedTier: "elite" as const };
    const result = applyPlanLevelRaiseIfReady({
      days: readyDays(),
      memories: {
        a: mem("a", at),
        b: mem("b", at),
        c: mem("c", at),
        d: mem("d", at),
        e: mem("e", at),
      },
      standardsFor: () => STANDARDS,
    });
    expect(result.raised).toBe(false);
    expect(loadPlanLevel()).toBe("elite");
  });
});
