import { describe, expect, it } from "vitest";
import { EXERCISE_GRAPH } from "../../src/data/exerciseGraph";
import { LIBRARY_CATALOGUE } from "../../src/data/libraryCatalogue";
import { DEFAULT_PLAN_QUEUE, SESSION_TEMPLATES, templateToStarter } from "../../src/data/seed";
import type { JointHistoryEntry } from "../../src/domain/program";
import { detailHtml } from "../../src/library/libraryDetail";
import { DEFAULT_FILTERS, filterPanelsHtml, hasActiveFilters } from "../../src/library/filterPanels";
import { listHtml } from "../../src/library/libraryList";
import { selectLibraryResults } from "../../src/library/results";
import { addJointCareDay } from "../../src/plan/blockActions";
import { dayTitle } from "../../src/plan/dayKinds";
import { generateBlock } from "../../src/plan/generateBlock";
import { generateJointCareDay, isGeneralCare } from "../../src/plan/jointCareDay";
import type { StepContext } from "../../src/plan/ladderSteps";
import { getPlanDay } from "../../src/plan/planDays";
import { loadPlanQueue, peekNextTemplate, savePlanQueue } from "../../src/plan/queue";
import { saveScheduleOverride } from "../../src/plan/scheduleOverride";
import { planSession } from "../../src/rules/planSession";
import { estimateSessionDuration } from "../../src/rules/sessionDuration";
import { missingGear } from "../../src/safety/gear";
import { PREHAB_NAMES } from "../../src/safety/prehab";
import { overrideControlsHtml } from "../../src/ui/overrideControls";
import { exerciseNamed as find } from "../helpers/exercises";
import { filterTrigger } from "../helpers/libraryFilters";
import { useMemoryStorage } from "../helpers/storage";

const SHOULDER: JointHistoryEntry = { joint: "shoulder", side: "left", kind: "dislocation" };
const KNEE: JointHistoryEntry = { joint: "knee", side: "both", kind: "other" };
const ctx = (over: Partial<StepContext> = {}): StepContext => ({
  memories: {},
  jointHistory: [SHOULDER, KNEE],
  excluded: [],
  equipment: ["body", "bar"],
  ...over,
});
const care = (over: Partial<StepContext> = {}) => generateJointCareDay(ctx(over), () => "t");
const names = (day: { slots: Array<{ exerciseId: string }> }) => day.slots.map((slot) => EXERCISE_GRAPH[slot.exerciseId]!.name);
const mobility = SESSION_TEMPLATES.find((t) => t.id === "tmpl_mobility")!;

useMemoryStorage(() => ({ "aurora.poc.planQueue.v1": JSON.stringify(DEFAULT_PLAN_QUEUE) }));

describe("Joint care day", () => {
  it("uses only prehab moves for the declared joints, taking turns between them", () => {
    const day = care();
    const allowed = [...PREHAB_NAMES.shoulder!, ...PREHAB_NAMES.knee!].map((n) => n.toLowerCase());
    expect(names(day).every((name) => allowed.includes(name.toLowerCase()))).toBe(true);
    const shoulder = PREHAB_NAMES.shoulder!.map((n) => n.toLowerCase());
    const firstTwo = names(day).slice(0, 2).map((n) => n.toLowerCase());
    expect(shoulder.includes(firstTwo[0]!)).toBe(true);
    expect(shoulder.includes(firstTwo[1]!)).toBe(false);
    expect(day.kind).toBe("joint_care");
    expect(dayTitle(day)).toBe("Joint care");
    expect(day.repeat).toBe(false);
  });

  it("is dosed like the seed Mobility day: pinned, 2 sets, 10 reps or 30 s, RIR 3", () => {
    for (const slot of care().slots) {
      expect(slot.pinned).toBe(true);
      expect(slot.dose.sets).toBe(2);
      expect([10, 30]).toContain(slot.dose.reps);
      expect(slot.dose.targetRir).toBe(3);
    }
    expect(mobility.slots.every((slot) => slot.pinned && slot.dose.sets === 2 && slot.dose.targetRir === 3)).toBe(true);
  });

  it("fits the Mobility day's time band for every joint combination", () => {
    const cases: Array<Partial<StepContext>> = [
      {},
      { jointHistory: [KNEE], equipment: ["body", "band"] },
      { jointHistory: [] },
      { jointHistory: [{ joint: "lumbar", side: "both", kind: "other" }], equipment: ["body"] },
      { jointHistory: [{ joint: "wrist", side: "right", kind: "other" }, { joint: "ankle", side: "left", kind: "ligament" }] },
    ];
    for (const over of cases) {
      const day = care(over);
      const minutes = estimateSessionDuration(day).totalSeconds / 60;
      expect(day.targetMinutes).toEqual(mobility.targetMinutes);
      expect(minutes, names(day).join(", ")).toBeGreaterThanOrEqual(mobility.targetMinutes!.minMinutes);
      expect(minutes, names(day).join(", ")).toBeLessThanOrEqual(mobility.targetMinutes!.maxMinutes);
    }
  });

  it("is planned exactly as stored: the planner never advances or regresses a care move", () => {
    const day = care();
    const planned = planSession({ painJoints: [], sleepQuality: "good" }, templateToStarter(day), {}, { focus: day.focus });
    expect(planned.work.map((w) => [w.exerciseId, w.dose.sets, w.dose.reps])).toEqual(
      day.slots.map((s) => [s.exerciseId, s.dose.sets, s.dose.reps]),
    );
    expect(planned.work.every((w) => w.ruleIds.includes("pin") && !w.ruleIds.includes("advance"))).toBe(true);
  });

  it("respects gear and exclusions", () => {
    const noBar = care({ equipment: ["body"] });
    for (const slot of noBar.slots) {
      expect(missingGear(EXERCISE_GRAPH[slot.exerciseId]!.requires, ["body"])).toEqual([]);
    }
    const excluded = [find("Side-lying External Rotation").id];
    expect(care({ excluded }).slots.some((slot) => excluded.includes(slot.exerciseId))).toBe(false);
  });

  it("with no joint history gives general shoulder and hip care, and says so", () => {
    const day = care({ jointHistory: [] });
    expect(isGeneralCare({ jointHistory: [] })).toBe(true);
    expect(isGeneralCare({ jointHistory: [KNEE] })).toBe(false);
    expect(day.name).toBe("Joint care · general");
    const allowed = [...PREHAB_NAMES.shoulder!, ...PREHAB_NAMES.hip!].map((n) => n.toLowerCase());
    expect(names(day).every((name) => allowed.includes(name.toLowerCase()))).toBe(true);
  });

  it("can be added to the plan and used as today's override", () => {
    const { days, queue } = addJointCareDay({ queue: loadPlanQueue(), context: ctx(), newId: () => "q" });
    expect(queue.items.at(-1)).toBe(days[0]!.id);
    savePlanQueue(queue);
    expect(getPlanDay(days[0]!.id)).toBeDefined();

    saveScheduleOverride({ templateId: days[0]!.id });
    expect(peekNextTemplate(loadPlanQueue(), { templateId: days[0]!.id }).kind).toBe("joint_care");
    const panel = overrideControlsHtml({ templateId: days[0]!.id });
    expect(panel).toContain("Train something else today · Joint care");
    expect(panel).toMatch(/data-override-care="1" class="selected" aria-pressed="true"/);
    expect(overrideControlsHtml(null)).toMatch(/data-override-care="1" class="" aria-pressed="false"/);
  });

  it("the care move inside an area day follows the same pinned convention", () => {
    const upper = generateBlock({ kind: "upper", context: ctx(), newId: () => "c" })[0]!;
    const slot = upper.slots.find((s) => s.id.endsWith("_care"))!;
    expect(slot.pinned).toBe(true);
    expect(slot.dose).toMatchObject({ sets: 2, targetRir: 3 });
  });
});

describe("Library exclusions", () => {
  const base = { text: "", level: "all" as const };
  const nordic = find("Nordic curl");

  it("marks an excluded move in the list instead of its joint badge", () => {
    const html = listHtml([nordic, find("Standard Push-Up")], new Set(), base, { jointHistory: [KNEE], excluded: new Set([nordic.id]) });
    expect(html).toContain("Excluded by you");
    expect(html.split("lib-badge").length - 1).toBe(1);
    expect(listHtml([nordic], new Set(), base)).not.toContain("Excluded by you");
  });

  it("offers the Excluded filter only when something is excluded", () => {
    expect(listHtml([], new Set(), base)).not.toContain("data-excluded-only");
    expect(listHtml([], new Set(), base, { excluded: new Set(["x"]) })).toContain("data-excluded-only");
    const on = filterPanelsHtml({ ...DEFAULT_FILTERS, excludedOnly: true, openPanels: [] }, { hasJointHistory: false, hasExcluded: false });
    expect(filterTrigger(on, "show").value).toBe("Excluded by me · Hide stretches");
    expect(on).toMatch(/data-excluded-only class="selected" data-kind="toggle" aria-pressed="true"/);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, excludedOnly: true })).toBe(true);
  });

  it("lists only excluded moves, stretches included, when the filter is on", () => {
    const stretch = find("Hamstring Stretch");
    const excludedOnly = [nordic.id, stretch.id];
    const { results } = selectLibraryResults({
      catalogue: LIBRARY_CATALOGUE,
      query: { stretch: "hide" },
      forJoints: false,
      onlyGear: false,
      jointHistory: [],
      equipment: ["body", "bar"],
      excludedOnly,
    });
    expect(results.map((item) => item.id).sort()).toEqual([...excludedOnly].sort());
  });

  it("shows the Not for me switch on the detail page, in both states", () => {
    const off = detailHtml(nordic);
    expect(off).toMatch(/data-exclude-toggle class="" data-kind="toggle" aria-pressed="false">Not for me/);
    expect(off).toContain("Tick to keep this move out of all your sessions.");
    const on = detailHtml(nordic, { excluded: true });
    expect(on).toMatch(/data-exclude-toggle class="selected" data-kind="toggle" aria-pressed="true"/);
    expect(on).toContain("Aurora never plans this move");
  });

  it("does not call an excluded move allowed in the joints block", () => {
    const html = detailHtml(nordic, { jointHistory: [KNEE], excluded: true });
    expect(html).toContain("You excluded this move, so Aurora does not plan it.");
    expect(html).not.toContain("Allowed in your sessions");
    expect(detailHtml(nordic, { jointHistory: [KNEE] })).toContain("Allowed in your sessions, with care.");
  });
});
