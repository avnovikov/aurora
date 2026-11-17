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
    expect(isValidAddWeight(0.4)).toBe(false);
    expect(isValidAddWeight(0.5)).toBe(true);
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

  it("offers a chip for every gear item from #111, off by default", () => {
    const gear = html("gear");
    for (const id of [
      "partner", "suspension", "towel", "sliders", "dip_bars",
      "stick", "ab_wheel", "adjustable_bench", "vertical_pole", "leg_press",
    ] as const) {
      expect(gear, id).toContain(`data-eq="${id}" class="" aria-pressed="false">${EQUIPMENT_LABEL[id]}<`);
    }
    expect(gear).toContain("A bench, chair, wall and somewhere to anchor your feet (a bed or sofa) are always assumed");
  });

  it("asks for resting and max heart rate beside bodyweight, including first-run setup", () => {
    const you = html("you");
    expect(you).toContain("Resting heart rate (bpm)");
    expect(you).toContain("Max heart rate (bpm)");
    expect(you).toContain("data-resting-hr");
    expect(you).toContain("data-max-hr");
    expect(you).toContain('aria-describedby="resting-hr-hint"');
    expect(you).toContain('aria-describedby="max-hr-hint"');
    expect(html("gear")).not.toContain("data-resting-hr");
    const setup = settingsPageHtml({ tab: "you", profile: loadProfile(), deloadActive: false, setup: true });
    expect(setup).toContain("data-resting-hr");
    expect(setup).toContain("data-max-hr");
  });

  it("calls the weight you add Added weight, so it is not confused with bodyweight, and links each hint to its field", () => {
    const gear = html("gear");
    expect(gear).toContain("Added weight");
    expect(gear).not.toContain("Your weight");
    expect(gear).toContain('aria-describedby="add-weight-hint"');
    expect(gear).toContain('id="add-weight-hint"');
  });

  it("moves between tabs with the arrow keys, Home and End, wrapping at the ends", () => {
    expect(tabKeyTarget("ArrowRight", 0)).toBe("gear");
    expect(tabKeyTarget("ArrowRight", 3)).toBe("you");
    expect(tabKeyTarget("ArrowLeft", 0)).toBe("app");
    expect(tabKeyTarget("Home", 2)).toBe("you");
    expect(tabKeyTarget("End", 0)).toBe("app");
    expect(tabKeyTarget("Enter", 1)).toBeNull();
  });
});
