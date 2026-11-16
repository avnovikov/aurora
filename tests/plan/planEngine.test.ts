import { describe, expect, it } from "vitest";
import { EXERCISE_GRAPH } from "../../src/data/exerciseGraph";
import { DEFAULT_PLAN_QUEUE, SESSION_TEMPLATES, templateToStarter } from "../../src/data/seed";
import type { JointHistoryEntry, SessionTemplate } from "../../src/domain/program";
import { resolveExerciseTiming } from "../../src/domain/timing";
import type { ExerciseMemory } from "../../src/domain/types";
import { addBlockToPlan, placeBlock } from "../../src/plan/blockActions";
import { dayTitle, kindOfTemplate } from "../../src/plan/dayKinds";
import { excludeExercise, isExcluded, loadExcluded, restoreExercise } from "../../src/plan/exclusions";
import { generateBlock, type BlockKind } from "../../src/plan/generateBlock";
import { familyTier, usableMembers, workingStep, type StepContext } from "../../src/plan/ladderSteps";
import { getPlanDay, listPlanDays, replaceDaySlotExercise } from "../../src/plan/planDays";
import { completeNext, loadPlanQueue, peekNextTemplate, savePlanQueue } from "../../src/plan/queue";
import { saveScheduleOverride, loadScheduleOverride } from "../../src/plan/scheduleOverride";
import { isKnownTemplate, resolveTemplate } from "../../src/plan/templates";
import { planSession } from "../../src/rules/planSession";
import { estimateSessionDuration } from "../../src/rules/sessionDuration";
import { missingGear } from "../../src/safety/gear";
import { assessExercise } from "../../src/safety/jointCare";
import { chooseSuitableExercise } from "../../src/safety/suitableExercise";
import { exerciseNamed } from "../helpers/exercises";
import { useMemoryStorage } from "../helpers/storage";

const KINDS: BlockKind[] = ["upper", "lower", "core", "full", "skill"];
const GOOD = { painJoints: [], sleepQuality: "good" as const };

const memoryOf = (name: string, over: Partial<ExerciseMemory>): Record<string, ExerciseMemory> => {
  const id = exerciseNamed(name).id;
  return {
    [id]: { exerciseId: id, sessionsAtStandard: 0, sessionsBelowFloor: 0, lastAddedLoadKg: 0, weakLinkSessionsRemaining: 0, ...over },
  };
};
const ctx = (over: Partial<StepContext> = {}): StepContext => ({
  memories: {},
  jointHistory: [],
  excluded: [],
  equipment: ["body", "bar"],
  ...over,
});
const block = (kind: BlockKind, context = ctx(), count?: number): SessionTemplate[] =>
  generateBlock({ kind, target: kind === "skill" ? "freestanding_hs" : undefined, context, count, newId: () => "t" });
const names = (day: SessionTemplate): string[] => day.slots.map((slot) => EXERCISE_GRAPH[slot.exerciseId]!.name);

useMemoryStorage(() => ({ "aurora.poc.planQueue.v1": JSON.stringify(DEFAULT_PLAN_QUEUE) }));

describe("generated days keep the library's dosing rules", () => {
  const INTERMEDIATE = {
    ...memoryOf("Standard Push-Up", { declaredTier: "intermediate" }),
    ...memoryOf("Bulgarian split squat", { declaredTier: "intermediate" }),
    ...memoryOf("Plank hip dips", { declaredTier: "intermediate" }),
  };

  for (const [level, memories] of [["beginner", {}], ["intermediate", INTERMEDIATE]] as const) {
    for (const kind of KINDS) {
      it(`${level} ${kind}: every day fits the session time band`, () => {
        for (const day of block(kind, ctx({ memories }))) {
          const minutes = estimateSessionDuration(day).totalSeconds / 60;
          expect(day.targetMinutes, day.name).toBeDefined();
          expect(minutes, day.name).toBeGreaterThanOrEqual(day.targetMinutes!.minMinutes);
          expect(minutes, day.name).toBeLessThanOrEqual(day.targetMinutes!.maxMinutes);
        }
      });

      it(`${level} ${kind}: the stored preview is exactly what the planner prescribes`, () => {
        for (const day of block(kind, ctx({ memories }))) {
          const planned = planSession(GOOD, templateToStarter(day), memories, { focus: day.focus });
          expect(planned.work.map((item) => [item.exerciseId, item.dose.sets, item.dose.reps])).toEqual(
            day.slots.map((slot) => [slot.exerciseId, slot.dose.sets, slot.dose.reps]),
          );
        }
      });
    }
  }

  it("light days and deload weeks still cut the dose and block level-ups", () => {
    for (const kind of KINDS) {
      for (const day of block(kind)) {
        const light = planSession({ painJoints: [], sleepQuality: "poor" }, templateToStarter(day), {}, { focus: day.focus });
        expect(light.lightDay, day.name).toBe(true);
        for (const item of light.work) {
          expect(item.ruleIds).toContain("light_day");
          expect(item.ruleIds).not.toContain("advance");
          expect(item.dose.sets).toBeLessThanOrEqual(3);
          expect(item.dose.targetRir).toBeGreaterThanOrEqual(3);
        }
        const deload = planSession(GOOD, templateToStarter(day), {}, { focus: day.focus, deloadActive: true });
        expect(deload.work.every((item) => item.ruleIds.includes("deload") && !item.ruleIds.includes("advance"))).toBe(true);
      }
    }
  });

  it("uses seed-day sets (first slot 4, a skill's first slot 5, the rest 3) and target RIR 2, 3 for beginners", () => {
    const strength = (day: SessionTemplate) => day.slots.filter((slot) => !slot.id.endsWith("_care"));
    for (const day of block("upper")) {
      expect(strength(day).map((slot) => slot.dose.sets)).toEqual([4, 3, 3, 3]);
      // Seed RIR 2, raised to 3 where the move is dosed at the beginner tier (Hackett 2017).
      expect(strength(day).every((slot) => slot.dose.targetRir === 2 || slot.dose.targetRir === 3)).toBe(true);
    }
    expect(block("skill")[0]!.slots[0]!.dose.sets).toBe(5);
  });

  it("takes rest from the library timing model, not from the generator", () => {
    for (const day of block("upper")) {
      for (const slot of day.slots) {
        const exercise = EXERCISE_GRAPH[slot.exerciseId]!;
        expect(slot.restSeconds, exercise.name).toBe(resolveExerciseTiming(exercise).defaultRestSeconds);
      }
    }
  });

  it("borrows the warm-up and cool-down of the matching seed day", () => {
    const legs = SESSION_TEMPLATES.find((t) => t.id === "tmpl_legs")!;
    expect(block("lower")[0]!.warmupStationIds).toEqual(legs.warmupStationIds);
    expect(block("lower")[0]!.cooldownStationIds).toEqual(legs.cooldownStationIds);
    const handstand = SESSION_TEMPLATES.find((t) => t.id === "tmpl_skill_hs")!;
    expect(block("skill")[0]!.warmupStationIds).toEqual(handstand.warmupStationIds);
  });
});

describe("generateBlock", () => {
  it("makes three days A, B, C that differ, with no move twice in a day", () => {
    for (const kind of KINDS) {
      const days = block(kind);
      expect(days.map((day) => day.block?.letter)).toEqual(["A", "B", "C"]);
      expect(days.map((day) => day.block?.emphasis)).toEqual(["working", "easier", "focus"]);
      expect(new Set(days.map((day) => names(day).join("|"))).size, kind).toBe(3);
      for (const day of days) {
        expect(new Set(day.slots.map((slot) => slot.exerciseId)).size).toBe(day.slots.length);
        expect(day.repeat).toBe(false);
        expect(day.id.startsWith("day_")).toBe(true);
      }
    }
    expect(block("upper", ctx(), 2)).toHaveLength(2);
    expect(() => block("upper", ctx(), 4)).toThrow(/1 to 3 days/);
  });

  it("names days by area and block letter", () => {
    expect(block("upper").map((day) => day.name)).toEqual(["Upper body · A", "Upper body · B", "Upper body · C"]);
    expect(block("skill")[0]!.name).toBe("Skill: Freestanding handstand attempt · A");
    expect(kindOfTemplate(block("core")[0]!)).toBe("core");
  });

  it("only uses moves the athlete can do: gear, joints, exclusions", () => {
    const history: JointHistoryEntry[] = [{ joint: "knee", side: "both", kind: "ligament" }];
    const excluded = [exerciseNamed("Supported Split Squat").id, exerciseNamed("Hip hinge").id];
    const context = ctx({ equipment: ["body"], jointHistory: history, excluded });
    for (const kind of ["upper", "lower", "core", "full"] as const) {
      for (const day of block(kind, context)) {
        for (const slot of day.slots) {
          const exercise = EXERCISE_GRAPH[slot.exerciseId]!;
          expect(missingGear(exercise.requires, ["body"]), exercise.name).toEqual([]);
          expect(assessExercise(exercise.name, history).avoid, exercise.name).toBe(false);
          expect(excluded).not.toContain(exercise.id);
        }
      }
    }
  });

  it("drops a ladder with nothing usable (no bar: no pull slot) instead of inventing a move", () => {
    const noBar = block("upper", ctx({ equipment: ["body"] }))[0]!;
    expect(noBar.slots.some((slot) => slot.id.endsWith("_pull"))).toBe(false);
    expect(noBar.slots.length).toBeGreaterThan(0);
  });

  it("starts each ladder at the athlete's level", () => {
    expect(workingStep("push_up", ctx())?.exercise.difficulty).toBe("beginner");
    const intermediate = ctx({ memories: memoryOf("Standard Push-Up", { declaredTier: "intermediate" }) });
    expect(familyTier("push_up", intermediate)).toBe("intermediate");
    expect(workingStep("push_up", intermediate)?.exercise.difficulty).toBe("intermediate");
    const advanced = ctx({ memories: memoryOf("Standard Push-Up", { declaredTier: "advanced" }) });
    expect(workingStep("push_up", advanced)?.exercise.difficulty).toBe("advanced");
    expect(names(block("upper", ctx())[0]!)[0]).not.toBe(names(block("upper", advanced)[0]!)[0]);
  });

  it("lets results, not only a declared level, move the starting step", () => {
    const squat = exerciseNamed("Bulgarian split squat");
    const strong = ctx({ memories: memoryOf(squat.name, { bestReps: squat.standards!.intermediate }) });
    expect(familyTier("squat_single", strong)).toBe("intermediate");
    expect(familyTier("squat_single", ctx())).toBe("beginner");
  });

  it("makes day B easier than day A on a ladder that has an easier rung", () => {
    const advanced = ctx({ memories: memoryOf("Standard Push-Up", { declaredTier: "advanced" }) });
    const [a, b] = block("upper", advanced);
    const rank = (day: SessionTemplate) => usableMembers("push_up", advanced).find((m) => m.exercise.id === day.slots[0]!.exerciseId)!.rank;
    expect(rank(b!)).toBeLessThan(rank(a!));
  });

  it("puts a named skill's ladder first on every day", () => {
    for (const day of block("skill")) {
      expect(day.slots[0]!.label).toBe("Freestanding handstand attempt");
      expect(day.targetExerciseIds).toEqual(["freestanding_hs"]);
    }
    expect(() => generateBlock({ kind: "skill", context: ctx() })).toThrow(/named move/);
  });

  it("adds a care move for a joint with history to the days that load it", () => {
    const shoulder: JointHistoryEntry[] = [{ joint: "shoulder", side: "left", kind: "dislocation" }];
    const upper = block("upper", ctx({ jointHistory: shoulder }))[0]!;
    const care = upper.slots.find((slot) => slot.id.endsWith("_care"));
    expect(care?.label).toBe("Shoulder care");
    expect(care?.dose.sets).toBe(2);
    expect(block("lower", ctx({ jointHistory: shoulder }))[0]!.slots.some((s) => s.id.endsWith("_care"))).toBe(false);
    expect(block("upper")[0]!.slots.some((s) => s.id.endsWith("_care"))).toBe(false);
  });
});

describe("exclusions", () => {
  it("persist, dedupe and restore", () => {
    expect(loadExcluded()).toEqual([]);
    excludeExercise("pullup");
    excludeExercise("pullup");
    expect(loadExcluded()).toEqual(["pullup"]);
    expect(isExcluded("pullup")).toBe(true);
    restoreExercise("pullup");
    expect(loadExcluded()).toEqual([]);
    expect(() => excludeExercise(" ")).toThrow(/non-empty/);
  });

  it("make the planner swap the move, for a same-or-easier one, saying why", () => {
    const legs = SESSION_TEMPLATES.find((t) => t.id === "tmpl_legs")!;
    const planned = planSession(GOOD, templateToStarter(legs), {}, { focus: "legs", excluded: ["nordic_curl"] });
    expect(planned.work.some((item) => item.exerciseId === "nordic_curl")).toBe(false);
    const swapped = planned.work.find((item) => item.ruleIds.includes("excluded"))!;
    expect(swapped.reason).toMatch(/Excluded by you: swapped Nordic curl for /);
    const rank = { beginner: 1, intermediate: 2, advanced: 3, elite: 4, novice: 0 } as const;
    expect(rank[EXERCISE_GRAPH[swapped.exerciseId]!.difficulty!]).toBeLessThanOrEqual(rank[EXERCISE_GRAPH.nordic_curl!.difficulty!]);
  });

  it("leave joint and gear swaps exactly as they were", () => {
    const ring = exerciseNamed("Ring Push-Up");
    const before = chooseSuitableExercise(ring, [], ["body", "bar"]);
    const withUnrelated = chooseSuitableExercise(ring, [], ["body", "bar"], ["nordic_curl"]);
    expect(withUnrelated).toEqual(before);
    expect(before.cause).toBe("gear");
  });
});

describe("generated days in the plan", () => {
  it("shows seed days under area names and skills by their move", () => {
    const title = (id: string) => dayTitle(resolveTemplate(id));
    expect(title("tmpl_legs")).toBe("Lower body");
    expect(title("tmpl_abs")).toBe("Core");
    expect(title("tmpl_bars")).toBe("Upper body");
    expect(title("tmpl_full")).toBe("Full body");
    expect(title("tmpl_skill_hs")).toBe("Skill: Freestanding handstand attempt");
    expect(title("tmpl_mobility")).toBe("Mobility");
  });

  it("places a block: first day where asked, the rest spaced, nothing removed", () => {
    const queue = { items: ["a", "b", "c", "d"] };
    expect(placeBlock(queue, ["x", "y", "z"], 0).items).toEqual(["x", "a", "y", "b", "z", "c", "d"]);
    expect(placeBlock(queue, ["x", "y"], 3).items).toEqual(["a", "b", "c", "x", "d", "y"]);
    expect(placeBlock({ items: ["a"] }, ["x", "y", "z"], 1).items).toEqual(["a", "x", "y", "z"]);
    expect(() => placeBlock(queue, ["x"], 9)).toThrow(/out of range/);
  });

  it("resolves through the queue like a seed day, then is pruned once done", () => {
    const { days, queue } = addBlockToPlan({ kind: "upper", context: ctx(), queue: loadPlanQueue(), index: 0, newId: () => "q" });
    savePlanQueue(queue);
    const first = days[0]!;
    expect(isKnownTemplate(first.id)).toBe(true);
    expect(peekNextTemplate(loadPlanQueue()).name).toBe("Upper body · A");
    expect(listPlanDays()).toHaveLength(3);

    const after = completeNext(loadPlanQueue());
    expect(after.items).not.toContain(first.id);
    savePlanQueue(after);
    expect(getPlanDay(first.id)).toBeUndefined();
    expect(listPlanDays()).toHaveLength(2);
    expect(isKnownTemplate(first.id)).toBe(false);
    expect(() => resolveTemplate(first.id)).toThrow(/Unknown template/);
  });

  it("can point one slot of a stored day at another exercise", () => {
    const { days } = addBlockToPlan({ kind: "lower", context: ctx(), queue: loadPlanQueue(), index: 0, count: 1, newId: () => "s" });
    const day = days[0]!;
    const slot = day.slots[0]!;
    const next = replaceDaySlotExercise(day.id, slot.id, "bodyweight_squat");
    expect(next.slots[0]!.exerciseId).toBe("bodyweight_squat");
    expect(getPlanDay(day.id)!.slots[0]!.exerciseId).toBe("bodyweight_squat");
    expect(getPlanDay(day.id)!.slots.slice(1)).toEqual(day.slots.slice(1));
    expect(() => replaceDaySlotExercise(day.id, "nope", "bodyweight_squat")).toThrow(/Unknown slot/);
    expect(() => replaceDaySlotExercise("day_missing", slot.id, "bodyweight_squat")).toThrow(/Unknown generated day/);
  });

  it("keeps a generated day alive while it is today's override", () => {
    const { days } = addBlockToPlan({ kind: "core", context: ctx(), queue: loadPlanQueue(), index: 0, count: 1, newId: () => "o" });
    saveScheduleOverride({ templateId: days[0]!.id });
    savePlanQueue(loadPlanQueue());
    expect(loadScheduleOverride()?.templateId).toBe(days[0]!.id);
    expect(getPlanDay(days[0]!.id)).toBeDefined();
  });
});
