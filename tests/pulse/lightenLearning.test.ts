import { describe, expect, it } from "vitest";
import {
  clearPendingLightenGate,
  loadLightenExamples,
  preferLightDefault,
  recordLightenDecision,
  reinforceFromSessionEvaluation,
} from "../../src/pulse/lightenLearning";
import { useMemoryStorage } from "../helpers/storage";

useMemoryStorage();

const SESSION_A = 1_700_000_000_000;
const SESSION_B = 1_700_000_100_000;

describe("lighten learning", () => {
  it("records accept/decline and replaces with session-rating reinforcement", () => {
    const features = { sleep: 0 as const, pain: 0, hr: 2 as const };
    recordLightenDecision(features, false, SESSION_A);
    expect(loadLightenExamples()).toHaveLength(1);
    expect(loadLightenExamples()[0]?.label).toBe(0);

    reinforceFromSessionEvaluation("difficult", SESSION_A);
    const examples = loadLightenExamples();
    expect(examples).toHaveLength(1);
    expect(examples[0]).toMatchObject({ label: 1, weight: 2, hr: 2 });
  });

  it("ignores reinforcement from a different session", () => {
    recordLightenDecision({ sleep: 0, pain: 0, hr: 1 }, false, SESSION_A);
    reinforceFromSessionEvaluation("difficult", SESSION_B);
    expect(loadLightenExamples()).toHaveLength(1);
    expect(loadLightenExamples()[0]?.weight).toBe(1);
  });

  it("clears stale pending before a new session", () => {
    recordLightenDecision({ sleep: 0, pain: 1, hr: 0 }, true, SESSION_A);
    clearPendingLightenGate();
    reinforceFromSessionEvaluation("easy", SESSION_A);
    expect(loadLightenExamples()).toHaveLength(1);
    expect(loadLightenExamples()[0]?.weight).toBe(1);
  });

  it("defaults toward light on elevated HR before any training", () => {
    expect(preferLightDefault({ sleep: 0, pain: 0, hr: 1 })).toBe(true);
  });
});
