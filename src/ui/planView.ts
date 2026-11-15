import { EXERCISE_GRAPH } from "../data/exerciseGraph";
import { onChipClick } from "../library/chips";
import { addBlockToPlan, addJointCareDay } from "../plan/blockActions";
import { DAY_KIND_LABELS, skillTitle } from "../plan/dayKinds";
import { excludeFromDay, makeDay, setDayExercise } from "../plan/dayEdits";
import type { BlockKind } from "../plan/generateBlock";
import { isGeneralCare } from "../plan/jointCareDay";
import { PLAN_LEVELS, savePlanLevel, type PlanLevel } from "../plan/planLevel";
import {
  appendQueueItem,
  completeToday,
  loadPlanQueue,
  moveQueueItem,
  removeQueueItem,
  savePlanQueue,
  skipNext,
} from "../plan/queue";
import { clearScheduleOverride, loadScheduleOverride } from "../plan/scheduleOverride";
import { loadAthleteState } from "./athleteState";
import { enableDragReorder, movedIndex } from "./dragReorder";
import { buildPlanModel, exerciseKey, type PlanUiState } from "./planModel";
import { planPageHtml } from "./planPage";

/** What the page remembers between repaints. */
interface Ui {
  openDays: Set<number>;
  swap: PlanUiState["swap"];
  openExercises: Set<string>;
  addOpen: boolean;
  levelOpen: boolean;
  status?: string;
}

/** What every group of handlers needs: the page, its state, and how to run an edit. */
interface PlanController {
  root: HTMLElement;
  ui: Ui;
  /** Run an edit, report its message, and repaint; a failed edit is shown, not thrown at the user. */
  act: (edit: () => string | void) => void;
  paint: () => void;
}

interface SlotRef {
  index: number;
  templateId: string;
  slotId: string;
  exerciseId: string;
}

/** Where an added block starts: after today when there is a today. */
function afterToday(queueLength: number): number {
  return Math.min(1, queueLength);
}

function dayIndexOf(element: Element): number {
  return Number(element.closest<HTMLElement>("[data-day]")?.dataset.day);
}

function slotOf(element: Element): SlotRef {
  const row = element.closest<HTMLElement>("[data-slot]")!;
  const index = dayIndexOf(element);
  return { index, templateId: loadPlanQueue().items[index]!, slotId: row.dataset.slot!, exerciseId: row.dataset.exercise! };
}

function on(root: HTMLElement, selector: string, handler: (element: HTMLElement) => void): void {
  root.querySelectorAll<HTMLElement>(selector).forEach((element) => {
    element.addEventListener("click", () => handler(element));
  });
}

function addDays(kind: BlockKind, target?: string): string {
  const queue = loadPlanQueue();
  const result = addBlockToPlan({ kind, target, context: loadAthleteState(), queue, index: afterToday(queue.items.length) });
  savePlanQueue(result.queue);
  return `Added ${result.days.length} days: ${result.days.map((day) => day.name).join(", ")}.`;
}

function addJointCare(): string {
  const state = loadAthleteState();
  const result = addJointCareDay({ queue: loadPlanQueue(), context: state });
  savePlanQueue(result.queue);
  const general = isGeneralCare(state) ? " You have no joint history, so it is general shoulder and hip care." : "";
  return `Added a light Joint care day at the end of the plan.${general}`;
}

function remake(ui: Ui, index: number, kind: BlockKind, target?: string): string {
  savePlanQueue(makeDay({ queue: loadPlanQueue(), index, kind, target, state: loadAthleteState() }));
  ui.openDays.add(index);
  return `This day is now ${kind === "skill" ? skillTitle(target) : DAY_KIND_LABELS[kind]}; two more follow later in the plan.`;
}

function excludeSlot(element: HTMLElement): string {
  const dayExerciseIds = Array.from(
    element.closest("[data-day]")!.querySelectorAll<HTMLElement>("[data-exercise]"),
    (row) => row.dataset.exercise!,
  );
  const result = excludeFromDay({ ...slotOf(element), state: loadAthleteState(), dayExerciseIds });
  const now = result.substituteName ? ` Now: ${result.substituteName}.` : " No substitute fits, so the slot is unchanged.";
  return `Excluded ${result.excludedName} from all your sessions.${now} Restore it in the Library.`;
}

function wireDayEdits({ root, ui, act }: PlanController): void {
  on(root, "[data-make-kind]", (el) => act(() => remake(ui, dayIndexOf(el), el.dataset.makeKind as BlockKind)));
  on(root, "[data-make-skill]", (el) => act(() => remake(ui, dayIndexOf(el), "skill", el.dataset.makeSkill)));
  on(root, "[data-move]", (el) =>
    act(() => {
      const index = dayIndexOf(el);
      const to = el.dataset.move === "up" ? index - 1 : index + 1;
      savePlanQueue(moveQueueItem(loadPlanQueue(), index, to));
      ui.openDays = new Set([to]);
    }),
  );
  on(root, "[data-later]", () =>
    act(() => {
      savePlanQueue(skipNext(loadPlanQueue()));
      ui.openDays = new Set([0]);
      return "Moved today's session to the end of the plan.";
    }),
  );
  on(root, "[data-remove]", (el) =>
    act(() => {
      savePlanQueue(removeQueueItem(loadPlanQueue(), dayIndexOf(el)));
      ui.openDays = new Set();
    }),
  );
}

function wireExerciseEdits({ root, ui, act, paint }: PlanController): void {
  on(root, "[data-ex-toggle]", (el) => {
    const { index, slotId } = slotOf(el);
    const key = exerciseKey(index, slotId);
    if (!ui.openExercises.delete(key)) {
      ui.openExercises.add(key);
    }
    paint();
  });
  on(root, "[data-swap]", (el) => {
    const { index, slotId } = slotOf(el);
    const same = ui.swap?.index === index && ui.swap.slotId === slotId;
    ui.swap = same ? null : { index, slotId };
    ui.status = undefined;
    paint();
  });
  on(root, "[data-swap-pick]", (el) =>
    act(() => {
      const { templateId, slotId } = slotOf(el);
      const pick = el.dataset.swapPick!;
      setDayExercise(templateId, slotId, pick);
      return `Swapped in ${EXERCISE_GRAPH[pick]?.name ?? pick}.`;
    }),
  );
  on(root, "[data-not-for-me]", (el) => act(() => excludeSlot(el)));
}

function wireAdd({ root, act }: PlanController): void {
  on(root, "[data-add-kind]", (el) => act(() => addDays(el.dataset.addKind as BlockKind)));
  on(root, "[data-add-skill]", (el) => act(() => addDays("skill", el.dataset.addSkill)));
  on(root, "[data-add-care]", () => act(addJointCare));
  on(root, "[data-add-seed]", (el) =>
    act(() => {
      savePlanQueue(appendQueueItem(loadPlanQueue(), el.dataset.addSeed!));
      return "Added to the end of the plan.";
    }),
  );
}

function wireLevel({ root, ui, act }: PlanController): void {
  onChipClick(root, "plan-level", (value) =>
    act(() => {
      savePlanLevel(value as PlanLevel);
      ui.levelOpen = true;
      const label = PLAN_LEVELS.find((level) => level.id === value)?.label ?? value;
      return value === "auto"
        ? "New days will follow your results."
        : `New days will be built at ${label} level. Days already in the plan are unchanged.`;
    }),
  );
  root.querySelector<HTMLDetailsElement>("details[data-plan-level-panel]")?.addEventListener("toggle", (event) => {
    ui.levelOpen = (event.currentTarget as HTMLDetailsElement).open;
  });
}

/** Drag a day by its grip to move it; open days stay open where they land. */
function wireDrag({ root, ui, act }: PlanController): void {
  const list = root.querySelector<HTMLElement>(".plan-days");
  if (!list) {
    return;
  }
  enableDragReorder(list, (from, to) =>
    act(() => {
      savePlanQueue(moveQueueItem(loadPlanQueue(), from, to));
      ui.openDays = new Set([...ui.openDays].map((index) => movedIndex(index, from, to)));
      return to === 0 ? "Moved to today." : `Moved to position ${to + 1}.`;
    }),
  );
}

/** Remember which panels the user opened, so a repaint does not snap them shut. */
function wirePanels({ root, ui }: PlanController): void {
  root.querySelectorAll<HTMLDetailsElement>("details[data-day]").forEach((panel) => {
    panel.addEventListener("toggle", () => {
      const index = Number(panel.dataset.day);
      if (panel.open) {
        ui.openDays.add(index);
      } else {
        ui.openDays.delete(index);
      }
    });
  });
  root.querySelector<HTMLDetailsElement>("details[data-add-days]")?.addEventListener("toggle", (event) => {
    ui.addOpen = (event.currentTarget as HTMLDetailsElement).open;
  });
}

export function renderPlanView(root: HTMLElement): void {
  const ui: Ui = { openDays: new Set([0]), swap: null, openExercises: new Set(), addOpen: false, levelOpen: false };
  const controller: PlanController = {
    root,
    ui,
    act: (edit) => {
      try {
        const result = edit();
        ui.status = typeof result === "string" ? result : undefined;
      } catch (error) {
        ui.status = error instanceof Error ? error.message : "That did not work.";
      }
      ui.swap = null;
      ui.openExercises.clear();
      controller.paint();
    },
    paint: () => {
      root.innerHTML = planPageHtml(buildPlanModel(loadPlanQueue(), loadAthleteState(), ui));
      wirePanels(controller);
      wireDayEdits(controller);
      wireExerciseEdits(controller);
      wireAdd(controller);
      wireLevel(controller);
      wireDrag(controller);
    },
  };
  controller.paint();
}

/** Used after session evaluation */
export function advancePlanAfterSession(): void {
  const override = loadScheduleOverride();
  const nextQueue = completeToday(loadPlanQueue(), override);
  clearScheduleOverride();
  savePlanQueue(nextQueue);
}
