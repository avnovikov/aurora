import { describe, expect, it } from "vitest";
import { EXERCISE_GRAPH } from "../../src/data/exerciseGraph";
import { templateToStarter } from "../../src/data/seed";
import { previewDay, previewQueue, type AthleteState } from "../../src/plan/dayPreview";
import { generateBlock } from "../../src/plan/generateBlock";
import { familyTier, type StepContext } from "../../src/plan/ladderSteps";
import { declareLevelForDays, levelForMove, memoryAtLevel } from "../../src/plan/levelDeclare";
import { PLAN_LEVELS, loadPlanLevel, planLevelTier, savePlanLevel } from "../../src/plan/planLevel";
import { loadPlanQueue } from "../../src/plan/queue";
import { resolveTemplate } from "../../src/plan/templates";
import { planSession } from "../../src/rules/planSession";
import { estimateSessionDuration } from "../../src/rules/sessionDuration";
import { loadAthleteState } from "../../src/ui/athleteState";
import { buildPlanModel, exerciseKey, type PlanUiState } from "../../src/ui/planModel";
import { planPageHtml } from "../../src/ui/planPage";
import { shellHtml } from "../../src/ui/sessionChalk";
import type { ViewState } from "../../src/ui/sessionTypes";
import { tierIndex } from "../../src/domain/skillTier";
import { effectiveSkillTier } from "../../src/rules/skillDose";
import { emptyMemory } from "../../src/session/history";
import { useMemoryStorage } from "../helpers/storage";

useMemoryStorage();

const state = (over: Partial<AthleteState> = {}): AthleteState => ({
  memories: {},
  history: [],
  jointHistory: [],
  equipment: ["body", "bar"],
  excluded: [],
  deloadActive: false,
  ...over,
});
const ui = (over: Partial<PlanUiState> = {}): PlanUiState => ({
  openDays: new Set([0]),
  swap: null,
  openExercises: new Set(),
  addOpen: false,
  levelOpen: false,
  ...over,
});
const ctx = (over: Partial<StepContext> = {}): StepContext => ({ memories: {}, jointHistory: [], excluded: [], equipment: ["body", "bar"], ...over });
const hardMove = () => Object.values(EXERCISE_GRAPH).find((e) => e.difficulty === "elite" && e.standards)!;
const count = (html: string, needle: string) => html.split(needle).length - 1;

describe("Coming up: descriptions only on tap", () => {
  const knees = state({ jointHistory: [{ joint: "knee", side: "both", kind: "other" }] });
  const split = resolveTemplate("tmpl_legs").slots[1]!;

  it("shows no description or joint note until an exercise is tapped", () => {
    const html = planPageHtml(buildPlanModel(loadPlanQueue(), knees, ui()));
    expect(html).not.toContain("data-ex-detail");
    expect(html).not.toContain("patellofemoral");
    expect(html).not.toContain(EXERCISE_GRAPH[split.exerciseId]!.description!);
    expect(count(html, 'data-ex-toggle aria-expanded="false"')).toBeGreaterThan(0);
    expect(html).not.toContain('aria-expanded="true"');
  });

  it("opens the tapped exercise only, with its short description and joint note", () => {
    const html = planPageHtml(
      buildPlanModel(loadPlanQueue(), knees, ui({ openExercises: new Set([exerciseKey(0, split.id)]) })),
    );
    expect(count(html, "data-ex-detail")).toBe(1);
    expect(html).toContain(EXERCISE_GRAPH[split.exerciseId]!.description!);
    expect(html).toContain("patellofemoral");
    expect(count(html, 'aria-expanded="true"')).toBe(1);
  });

  it("carries every move's one-line description in the preview", () => {
    const model = buildPlanModel(loadPlanQueue(), state(), ui());
    for (const item of model.days[0]!.items) {
      expect(item.summary, item.name).toBe(EXERCISE_GRAPH[item.exerciseId]!.description);
    }
  });

  it("keeps the note that says the planner changed a move", () => {
    const html = planPageHtml(buildPlanModel(loadPlanQueue(), state({ excluded: ["nordic_curl"] }), ui()));
    expect(html).toContain("Excluded by you: swapped Nordic curl for ");
  });
});

describe("Coming up: back-to-back days of one area", () => {
  it("previews each day after the ones before it, so the planner's own variety rule shows", () => {
    const legs = resolveTemplate("tmpl_legs");
    const before = JSON.stringify(legs);
    const [first, second, third] = previewQueue([legs, legs, legs], state());
    const ids = (items: typeof first) => items!.map((item) => item.exerciseId).join(",");
    expect(ids(second)).not.toBe(ids(first));
    expect(ids(third)).not.toBe(ids(second));
    expect(JSON.stringify(legs)).toBe(before);
    // A single day matches the plain preview: nothing is generated or stored.
    expect(ids(previewQueue([legs], state())[0])).toBe(ids(previewDay(legs, state())));
  });
});

describe("plan level", () => {
  it("defaults to results, persists a choice, and rejects nonsense", () => {
    expect(loadPlanLevel()).toBe("auto");
    expect(planLevelTier("auto")).toBeUndefined();
    savePlanLevel("advanced");
    expect(loadPlanLevel()).toBe("advanced");
    expect(loadAthleteState().level).toBe("advanced");
    savePlanLevel("auto");
    expect(loadPlanLevel()).toBe("auto");
    expect(loadAthleteState().level).toBeUndefined();
    expect(() => savePlanLevel("novice" as never)).toThrow(/Unknown plan level/);
    expect(PLAN_LEVELS.map((level) => level.id)).toEqual(["auto", "beginner", "intermediate", "advanced", "elite"]);
  });

  it("sets every ladder's level, whatever the results say", () => {
    expect(familyTier("push_up", ctx())).toBe("beginner");
    expect(familyTier("push_up", ctx({ level: "advanced" }))).toBe("advanced");
    const tiers = (level: StepContext["level"]) =>
      generateBlock({ kind: "upper", context: ctx({ level }), newId: () => "l" })[0]!.slots.map(
        (slot) => EXERCISE_GRAPH[slot.exerciseId]!.difficulty,
      );
    expect(tiers("advanced").every((tier) => tier === "advanced")).toBe(true);
    expect(tiers("intermediate").every((tier) => tier === "intermediate")).toBe(true);
    expect(tiers(undefined)).not.toEqual(tiers("advanced"));
  });

  it("is declared on the generated moves, so the planner doses at that level and every day fits its time band", () => {
    for (const level of ["beginner", "intermediate", "advanced", "elite"] as const) {
      for (const kind of ["upper", "lower", "core", "full"] as const) {
        const days = generateBlock({ kind, context: ctx({ level }), newId: () => "d" });
        const memories = declareLevelForDays({}, days, level);
        for (const day of days) {
          const planned = planSession({ painJoints: [], sleepQuality: "good" }, templateToStarter(day), memories, { focus: day.focus });
          const rows = planned.work.map((w) => [w.exerciseId, w.dose.sets, w.dose.reps]);
          // The planner may move an advanced athlete up a rung (its own rule); the stored dose must match wherever it keeps the move.
          day.slots.forEach((slot, i) => {
            if (rows[i]![0] === slot.exerciseId) {
              expect(rows[i], `${level} ${day.name} ${slot.label}`).toEqual([slot.exerciseId, slot.dose.sets, slot.dose.reps]);
            }
          });
          const minutes = estimateSessionDuration(day).totalSeconds / 60;
          expect(minutes, `${level} ${day.name}`).toBeGreaterThanOrEqual(day.targetMinutes!.minMinutes);
          expect(minutes, `${level} ${day.name}`).toBeLessThanOrEqual(day.targetMinutes!.maxMinutes);
        }
      }
    }
  });

  it("is a floor: it never lowers a level the athlete's results earned", () => {
    const pushUp = EXERCISE_GRAPH[generateBlock({ kind: "upper", context: ctx({ level: "beginner" }), newId: () => "f" })[0]!.slots[0]!.exerciseId]!;
    const earned = { exerciseId: pushUp.id, sessionsAtStandard: 0, sessionsBelowFloor: 0, lastAddedLoadKg: 0, weakLinkSessionsRemaining: 0, skillTier: "advanced" as const };
    expect(memoryAtLevel(earned, pushUp, "beginner")).toEqual(earned);
    expect(memoryAtLevel(undefined, hardMove(), "intermediate").declaredTier).toBe("intermediate");
    expect(memoryAtLevel(undefined, pushUp, undefined).declaredTier).toBeUndefined();
    const days = generateBlock({ kind: "upper", context: ctx({ level: "beginner" }), newId: () => "g" });
    expect(declareLevelForDays({ [pushUp.id]: earned }, days, "beginner")[pushUp.id]).toEqual(earned);
  });

  it("never raises a move above its own difficulty, so easy moves keep their own standard", () => {
    const easy = Object.values(EXERCISE_GRAPH).find((e) => e.difficulty === "beginner" && e.standards)!;
    const hard = Object.values(EXERCISE_GRAPH).find((e) => e.difficulty === "elite" && e.standards)!;
    expect(levelForMove(easy, "elite")).toBe("beginner");
    expect(levelForMove(hard, "intermediate")).toBe("intermediate");
    // A beginner move starts at beginner already, so an elite plan leaves it there.
    expect(memoryAtLevel(undefined, easy, "elite").declaredTier).toBeUndefined();
    expect(memoryAtLevel(undefined, hard, "elite").declaredTier).toBe("elite");
    const days = generateBlock({ kind: "lower", context: ctx({ level: "elite" }), newId: () => "e" });
    const declared = declareLevelForDays({}, days, "elite");
    // Each working move reaches the plan level capped at its own difficulty
    // (the Library's family cascade may already have lifted it further).
    for (const slot of days.flatMap((day) => day.slots).filter((s) => !s.pinned)) {
      const move = EXERCISE_GRAPH[slot.exerciseId]!;
      const tier = effectiveSkillTier(declared[move.id] ?? emptyMemory(move.id), move);
      expect(tierIndex(tier), move.id).toBeGreaterThanOrEqual(tierIndex(levelForMove(move, "elite")));
    }
  });

  it("has its own panel on the Plan page, open and named while a level is set", () => {
    const auto = planPageHtml(buildPlanModel(loadPlanQueue(), state(), ui()));
    expect(auto).toMatch(/<details class="lib-filters" data-plan-level-panel>\s*<summary>Level<\/summary>/);
    expect(auto).toMatch(/data-plan-level="auto" class="selected" aria-pressed="true"/);
    savePlanLevel("intermediate");
    const set = planPageHtml(buildPlanModel(loadPlanQueue(), state(), ui()));
    expect(set).toMatch(/data-plan-level-panel open>\s*<summary>Level · Intermediate<\/summary>/);
    expect(set).toMatch(/data-plan-level="intermediate" class="selected" aria-pressed="true"/);
    expect(set).toContain("Days already in the plan keep their moves");
  });
});

describe("session screen: doodle, description, what to pay attention to", () => {
  const joints = [{ joint: "knee" as const, side: "both" as const, kind: "other" as const }];
  const legs = resolveTemplate("tmpl_legs");
  const planned = planSession({ painJoints: [], sleepQuality: "good" }, templateToStarter(legs), {}, { focus: "legs", jointHistory: joints });
  const view = (over: Partial<ViewState>): ViewState =>
    ({
      phase: "work",
      warmupIndex: planned.warmup.length,
      workIndex: 1,
      cooldownIndex: 0,
      setIndex: 1,
      log: { entries: [] },
      workState: null,
      restLeft: 0,
      pulse: { connected: false, lastValidAtMs: null, lastShoutAtMs: null },
      bpm: null,
      pulseStatus: null,
      startedAtMs: 0,
      plannedTotalSeconds: 1800,
      ...over,
    }) as ViewState;

  it("shows all three for a working move, in that order, with nothing collapsed", () => {
    const item = planned.work[1]!;
    const html = shellHtml(planned, view({}));
    const doodle = html.indexOf('class="doodle"');
    const summary = html.indexOf("session-summary");
    const attention = html.indexOf("data-attention");
    expect(doodle).toBeGreaterThan(-1);
    expect(doodle).toBeLessThan(summary);
    expect(summary).toBeLessThan(attention);
    expect(html).toContain(item.summary!);
    expect(html).toContain("Pay attention to");
    for (const cue of item.cues) {
      expect(html).toContain(cue);
    }
    expect(html).not.toContain("Form cues");
    expect(html).not.toContain("session-cues");
  });

  it("puts the athlete's joint note in the same block, marked as theirs", () => {
    const html = shellHtml(planned, view({}));
    expect(planned.work[1]!.cautions.length).toBeGreaterThan(0);
    expect(html).toMatch(/class="attention-joint">both knees:/);
    expect(count(html, "data-attention")).toBe(1);
  });

  it("keeps the step-by-step how-to available but collapsed", () => {
    expect(shellHtml(planned, view({}))).toMatch(/<details class="session-howto"><summary>How to<\/summary>/);
  });

  it("shows the same on warm-up stations", () => {
    const html = shellHtml(planned, view({ phase: "warmup", warmupIndex: 0, workIndex: 0 }));
    const step = planned.warmup[0]!;
    expect(html).toContain("Pay attention to");
    expect(html).toContain(step.cues[0]!);
    expect(html).toContain(EXERCISE_GRAPH[step.stationId]!.description!);
    expect(html).not.toContain("Form cues");
  });
});
