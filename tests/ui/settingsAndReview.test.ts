import { describe, expect, it } from "vitest";
import { SEED_GRAPH, SESSION_TEMPLATES, templateToStarter } from "../../src/data/seed";
import type { ExerciseMemory, Readiness } from "../../src/domain/types";
import { inferChainStatus } from "../../src/progress/chainMap";
import { planSession, type PlannedSession } from "../../src/rules/planSession";
import { DEFAULT_ADDED_LOAD_KG } from "../../src/session/setLog";
import { isValidAddWeight, loadProfile, saveProfile } from "../../src/settings/profile";
import { shellHtml } from "../../src/ui/sessionChalk";
import { initialState } from "../../src/ui/sessionState";
import type { ViewState } from "../../src/ui/sessionTypes";
import { EQUIPMENT_LABEL, SETTINGS_TABS, settingsPageHtml } from "../../src/ui/settingsPage";
import { tabKeyTarget } from "../../src/ui/settingsView";
import { useMemoryStorage } from "../helpers/storage";

useMemoryStorage();

const readiness: Readiness = { sleepQuality: "good", restingHrBpm: 58, painJoints: [] };
const planLegs = (): PlannedSession =>
  planSession(readiness, templateToStarter(SESSION_TEMPLATES.find((t) => t.id === "tmpl_legs")!), {});

function view(planned: PlannedSession, phase: ViewState["phase"], addWeightKg?: number): ViewState {
  const state = initialState({ planned, onDone: () => undefined, addWeightKg });
  state.phase = phase;
  state.warmupIndex = phase === "warmup" ? 0 : planned.warmup.length;
  if (phase !== "warmup") {
    const work = planned.work[0]!;
    state.workState = { slotId: work.slotId, exerciseId: work.exerciseId, setIndex: 1, prescribedReps: work.dose.reps, addedLoadKg: 0 };
  }
  return state;
}

const memory = (over: Partial<ExerciseMemory>): ExerciseMemory => ({
  exerciseId: "x", sessionsAtStandard: 0, sessionsBelowFloor: 0, lastAddedLoadKg: 0, weakLinkSessionsRemaining: 0, ...over,
});

describe("your weight", () => {
  it("defaults to the 12 kg the app always used, and old profiles get it too", () => {
    expect(loadProfile().addWeightKg).toBe(12);
    expect(DEFAULT_ADDED_LOAD_KG).toBe(12);
    localStorage.setItem("aurora.poc.profile.v1", JSON.stringify({ bodyweightKg: 80, equipment: ["body"], voiceMuted: false, jointHistory: [], setupDone: true }));
    expect(loadProfile().addWeightKg).toBe(12);
  });

  it("saves a new weight and rejects nonsense", () => {
    saveProfile({ ...loadProfile(), addWeightKg: 16 });
    expect(loadProfile().addWeightKg).toBe(16);
    expect(isValidAddWeight(0)).toBe(false);
    expect(isValidAddWeight(-4)).toBe(false);
    expect(isValidAddWeight(Number.NaN)).toBe(false);
    expect(isValidAddWeight(101)).toBe(false);
    expect(() => saveProfile({ ...loadProfile(), addWeightKg: 0 })).toThrow();
  });

  it("is what the session's Add weight offers", () => {
    const planned = planLegs();
    expect(shellHtml(planned, view(planned, "work", 16))).toContain("Add your 16 kg");
    expect(shellHtml(planned, view(planned, "work"))).toContain(`Add your ${DEFAULT_ADDED_LOAD_KG} kg`);
  });
});

describe("working set: Log set in thumb reach", () => {
  it("puts Log set, Failed and Skip in the sticky bottom bar during work only", () => {
    const planned = planLegs();
    const html = shellHtml(planned, view(planned, "work"));
    const bar = html.slice(html.indexOf('<footer class="session-bar'));
    expect(bar).toContain("data-log-set");
    expect(bar).toContain("data-fail-set");
    expect(bar).toContain("data-skip");
    expect(shellHtml(planned, view(planned, "warmup"))).not.toContain("data-log-set");
  });
});

describe("progress status in plain words", () => {
  it("says how many sessions at target reps are left before moving up", () => {
    const status = inferChainStatus(SEED_GRAPH.bodyweight_squat!, memory({ sessionsAtStandard: 1, skillTier: "beginner" }), SEED_GRAPH);
    expect(status.reason).toBe("Beginner level · 1 of 2 sessions at target reps to move up");
    expect(status.reason).not.toMatch(/×|Hold:/);
  });
});

describe("settings tabs", () => {
  const html = (tab: (typeof SETTINGS_TABS)[number]["id"]) =>
    settingsPageHtml({ tab, profile: loadProfile(), deloadActive: false });

  it("shows four tabs with one selected, and only that section's fields", () => {
    const you = html("you");
    expect(you.match(/role="tab"/g)).toHaveLength(4);
    expect(you.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(you).toContain("data-bw");
    expect(you).not.toContain("data-eq");
    expect(html("gear")).toContain("data-add-weight");
    expect(html("training")).toContain("data-deload");
    expect(html("app")).toContain("data-palette-key");
  });

  it("names equipment in words, and has no Save button because changes save at once", () => {
    const gear = html("gear");
    expect(gear).toContain(EQUIPMENT_LABEL.bar);
    expect(gear).toContain("Dumbbell or kettlebell");
    expect(gear).not.toContain("data-save");
  });

  it("calls the weight you add Added weight, so it is not confused with bodyweight, and links each hint to its field", () => {
    const gear = html("gear");
    expect(gear).toContain("Added weight");
    expect(gear).not.toContain("Your weight");
    expect(gear).toContain('aria-describedby="add-weight-hint"');
    expect(gear).toContain('id="add-weight-hint"');
  });

  it("moves between tabs with the arrow keys, Home and End, wrapping at the ends", () => {
    expect(tabKeyTarget("ArrowRight", 0, 3)).toBe(1);
    expect(tabKeyTarget("ArrowRight", 3, 3)).toBe(0);
    expect(tabKeyTarget("ArrowLeft", 0, 3)).toBe(3);
    expect(tabKeyTarget("Home", 2, 3)).toBe(0);
    expect(tabKeyTarget("End", 0, 3)).toBe(3);
    expect(tabKeyTarget("Enter", 1, 3)).toBeNull();
  });
});
