import { describe, expect, it } from "vitest";
import { EXERCISE_GRAPH } from "../../src/data/exerciseGraph";
import { DEFAULT_PLAN_QUEUE, templateToStarter } from "../../src/data/seed";
import type { JointHistoryEntry } from "../../src/domain/program";
import { addBlockToPlan } from "../../src/plan/blockActions";
import { excludeFromDay, makeDay, setDayExercise, swapChoices } from "../../src/plan/dayEdits";
import { previewDay, type AthleteState } from "../../src/plan/dayPreview";
import { loadExcluded } from "../../src/plan/exclusions";
import { getPlanDay } from "../../src/plan/planDays";
import { loadPlanQueue, savePlanQueue } from "../../src/plan/queue";
import { resolveTemplate } from "../../src/plan/templates";
import { planSession } from "../../src/rules/planSession";
import { buildPlanModel, type PlanUiState } from "../../src/ui/planModel";
import { planPageHtml } from "../../src/ui/planPage";
import { useMemoryStorage } from "../helpers/storage";

const KNEES: JointHistoryEntry[] = [{ joint: "knee", side: "both", kind: "ligament" }];
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
const legs = () => resolveTemplate("tmpl_legs");
const count = (html: string, needle: string) => html.split(needle).length - 1;
/** One exercise row's markup, found by its slot. */
const rowOf = (html: string, slotId: string) => html.match(new RegExp(`<li [^>]*data-slot="${slotId}"[\\s\\S]*?</li>`))![0];

useMemoryStorage(() => ({ "aurora.poc.planQueue.v1": JSON.stringify(DEFAULT_PLAN_QUEUE) }));

describe("day preview", () => {
  it("is the planner's real session for a normal morning, not the stored defaults", () => {
    const athlete = state({ jointHistory: KNEES, equipment: ["body"] });
    const preview = previewDay(legs(), athlete);
    const planned = planSession({ painJoints: [], sleepQuality: "good" }, templateToStarter(legs()), {}, {
      focus: "legs",
      jointHistory: KNEES,
      equipment: ["body"],
      excluded: [],
    });
    expect(preview.map((item) => item.exerciseId)).toEqual(planned.work.map((item) => item.exerciseId));
    expect(preview.map((item) => item.dose)).toEqual(
      planned.work.map((item) => expect.stringContaining(`${item.dose.sets} × ${item.dose.reps}`)),
    );
  });

  it("writes holds in seconds and reps plainly", () => {
    const bars = previewDay(resolveTemplate("tmpl_bars"), state());
    expect(bars.find((item) => item.name === "Dead hang")?.dose).toMatch(/^\d+ × \d+ s$/);
    expect(previewDay(legs(), state())[0]!.dose).toMatch(/^\d+ × \d+$/);
  });

  it("explains a move the planner changed, and stays quiet otherwise", () => {
    const swapped = previewDay(legs(), state({ excluded: ["nordic_curl"] })).find((item) => item.note);
    expect(swapped?.note).toMatch(/^Excluded by you: swapped Nordic curl for /);
    expect(swapped?.note).not.toMatch(/prescription|dose/);
    expect(previewDay(legs(), state()).every((item) => item.note === undefined)).toBe(true);
  });

  it("shows a deload week's lighter dose", () => {
    const normal = previewDay(legs(), state())[0]!.dose;
    const deload = previewDay(legs(), state({ deloadActive: true }))[0]!.dose;
    expect(deload).not.toBe(normal);
  });
});

describe("day edits", () => {
  it("offers swaps the athlete can do, best first, without repeating the day's moves", () => {
    const athlete = state({ jointHistory: KNEES, equipment: ["body"] });
    const choices = swapChoices("bulgarian_split", athlete, ["reverse_lunge"]);
    expect(choices.length).toBeGreaterThan(0);
    expect(choices.length).toBeLessThanOrEqual(8);
    expect(choices.some((c) => c.id === "reverse_lunge" || c.id === "bulgarian_split")).toBe(false);
    for (const choice of choices) {
      expect(choice.pattern).toBe(EXERCISE_GRAPH.bulgarian_split!.pattern);
      expect(choice.requires ?? []).toEqual([]);
    }
  });

  it("Not for me excludes the move for good and puts a substitute in the slot", () => {
    const result = excludeFromDay({ templateId: "tmpl_legs", slotId: "legs_posterior", exerciseId: "nordic_curl", state: state() });
    expect(result.excludedName).toBe("Nordic curl");
    expect(loadExcluded()).toEqual(["nordic_curl"]);
    const slot = legs().slots.find((s) => s.id === "legs_posterior")!;
    expect(slot.exerciseId).not.toBe("nordic_curl");
    expect(EXERCISE_GRAPH[slot.exerciseId]!.name).toBe(result.substituteName);
    // The planner now needs no swap: the day itself holds the substitute.
    expect(previewDay(legs(), state({ excluded: loadExcluded() })).every((item) => item.note === undefined)).toBe(true);
  });

  it("edits a generated day in place and a seed day through its saved edits", () => {
    const { days, queue } = addBlockToPlan({ kind: "lower", context: state(), queue: loadPlanQueue(), index: 0, count: 1, newId: () => "e" });
    savePlanQueue(queue);
    const day = days[0]!;
    setDayExercise(day.id, day.slots[0]!.id, "bodyweight_squat");
    expect(getPlanDay(day.id)!.slots[0]!.exerciseId).toBe("bodyweight_squat");
    setDayExercise("tmpl_legs", "legs_calf", "single_leg_calf_raise");
    expect(legs().slots.find((s) => s.id === "legs_calf")!.exerciseId).toBe("single_leg_calf_raise");
    expect(() => setDayExercise("tmpl_legs", "legs_calf", "no_such_move")).toThrow(/Unknown exercise/);
  });

  it("Make this day replaces that day with a block's first day and spaces the rest", () => {
    const before = loadPlanQueue();
    const after = makeDay({ queue: before, index: 1, kind: "upper", state: state(), newId: () => "m" });
    expect(after.items).toHaveLength(before.items.length + 2);
    expect(after.items[0]).toBe(before.items[0]);
    expect(resolveTemplate(after.items[1]!).name).toBe("Upper body · A");
    expect(resolveTemplate(after.items[3]!).name).toBe("Upper body · B");
    expect(resolveTemplate(after.items[5]!).name).toBe("Upper body · C");
    expect(() => makeDay({ queue: before, index: 99, kind: "upper", state: state() })).toThrow(/out of range/);
  });
});

describe("Plan page", () => {
  const model = () => buildPlanModel(loadPlanQueue(), state(), ui());

  it("opens Add days and explains when the plan is empty", () => {
    const html = planPageHtml(buildPlanModel({ items: [] }, state(), ui()));
    expect(html).toContain("data-plan-empty");
    expect(html).toContain('data-add-days open');
    expect(html).toContain("0 days");
  });

  it("is a readable list of days with no dropdowns", () => {
    const html = planPageHtml(model());
    expect(html).toContain("<h1>Coming up</h1>");
    expect(html).not.toContain("<select");
    expect(count(html, "<details class=\"lib-filters plan-day")).toBe(loadPlanQueue().items.length);
    expect(html).toMatch(/plan-day-when">Today<\/span>\s*<span class="plan-day-title">Lower body/);
    expect(html).toContain("Then 2");
    expect(html).not.toMatch(/Queue|Procedure/);
  });

  it("opens today and shows its real exercises with both quick edits", () => {
    const first = model().days[0]!;
    expect(first.open).toBe(true);
    expect(first.items.map((item) => item.name)).toEqual(previewDay(legs(), state()).map((item) => item.name));
    const html = planPageHtml(model());
    expect(count(html, "data-not-for-me")).toBe(model().days.reduce((n, day) => n + day.items.length, 0));
    expect(html).toContain(">Swap</button>");
  });

  it("offers every area and the named skills to make a day, and blocks or single days to add", () => {
    const m = model();
    expect(m.makeOptions.filter((o) => o.type === "kind").map((o) => o.label)).toEqual(["Upper body", "Lower body", "Core", "Full body"]);
    expect(m.makeOptions.some((o) => o.type === "skill" && o.label === "Skill: Pistol squat")).toBe(true);
    expect(m.addOptions.slice(-2)).toEqual([
      { value: "tmpl_mobility", label: "Mobility", type: "seed" },
      { value: "care", label: "Joint care", type: "care" },
    ]);
    const html = planPageHtml(m);
    expect(html).toContain('data-make-kind="upper"');
    expect(html).toContain('data-add-kind="core"');
    expect(html).toContain('data-add-seed="tmpl_mobility"');
    expect(html).toContain('data-add-care="care"');
  });

  it("shows swap choices only for the slot being swapped, in the Library's words", () => {
    const slotId = legs().slots[1]!.id;
    const m = buildPlanModel(loadPlanQueue(), state(), ui({ swap: { index: 0, slotId } }));
    expect(m.days[0]!.swapSlotId).toBe(slotId);
    expect(m.days[0]!.swapOptions.length).toBeGreaterThan(0);
    expect(m.days[0]!.swapOptions[0]!.meta).toMatch(/Lower body · /);
    expect(m.days[1]!.swapOptions).toEqual([]);
    const html = planPageHtml(m);
    expect(count(html, 'class="plan-swap"')).toBe(1);
    expect(html).toMatch(/data-swap aria-pressed="true"/);
  });

  it("reports the last action and guards the ends of the list", () => {
    const html = planPageHtml(buildPlanModel(loadPlanQueue(), state(), ui({ status: "Excluded Nordic curl." })));
    expect(html).toContain('data-plan-status aria-live="polite">Excluded Nordic curl.');
    expect(html).toMatch(/data-move="up" disabled/);
    expect(count(html, 'data-move="down" disabled')).toBe(1);
    expect(count(html, "data-later")).toBe(1);
    const single = planPageHtml(buildPlanModel({ items: ["tmpl_legs"] }, state(), ui()));
    expect(single).toMatch(/class="plan-day-remove" data-remove aria-label="Remove: [^"]+, Today"/);
    expect(single).not.toMatch(/data-remove disabled/);
    expect(single).not.toContain("data-later");
    expect(single).toContain("1 day ·");
  });

  it("puts a Remove control on every day summary", () => {
    const html = planPageHtml(model());
    expect(count(html, 'class="plan-day-remove" data-remove')).toBe(model().days.length);
  });

  it("gives every row Swap and Easier as a pair, and ⋯ opening Not for me, all named by move and day", () => {
    const m = model();
    const rows = m.days.reduce((n, day) => n + day.items.length, 0);
    const html = planPageHtml(m);
    expect(count(html, "data-easier")).toBe(rows);
    expect(count(html, "data-more")).toBe(rows);
    expect(html).toContain('aria-label="Easier: Bulgarian split squat, Today"');
    expect(html).toContain('aria-label="Swap: Bulgarian split squat, Today"');
    expect(html).toContain('aria-label="Not for me: Nordic curl, Today"');
    expect(html).toMatch(/role="menu"[^>]*hidden/);
    const names = [...html.matchAll(/aria-label="((?:Swap|Easier|More options|Not for me): [^"]+)"/g)].map((match) => match[1]);
    expect(new Set(names).size).toBe(names.length);
  });

  it("disables Easier with a reason when a move has no easier step", () => {
    const html = planPageHtml(model());
    const hinge = rowOf(html, "legs_hinge");
    expect(hinge).toMatch(/data-easier aria-disabled="true"/);
    const reasonId = hinge.match(/aria-describedby="([^"]+-no-easier)"/)![1];
    expect(hinge).toContain(`id="${reasonId}">No easier step</span>`);
    const split = rowOf(html, "legs_split");
    expect(split).not.toContain("aria-disabled");
  });

  it("shows Undo in the row Not for me just changed, in place of its actions", () => {
    const notice = { index: 0, slotId: "legs_posterior", name: "Nordic curl", message: "Excluded Nordic curl from all your sessions." };
    const html = planPageHtml(buildPlanModel(loadPlanQueue(), state(), ui({ undo: notice })));
    const row = rowOf(html, "legs_posterior");
    expect(row).toContain('role="status" data-plan-undo-status>Excluded Nordic curl from all your sessions.');
    expect(row).toContain('data-undo aria-label="Undo: Nordic curl, Today">Undo</button>');
    expect(row).not.toContain("data-not-for-me");
    expect(count(html, "data-undo ")).toBe(1);
  });
});
