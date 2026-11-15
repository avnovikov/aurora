import { addBlockToPlan } from "../plan/blockActions";
import { DAY_KIND_LABELS, skillTitle } from "../plan/dayKinds";
import { excludeFromDay, makeDay, setDayExercise } from "../plan/dayEdits";
import type { BlockKind } from "../plan/generateBlock";
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
import { EXERCISE_GRAPH } from "../data/exerciseGraph";
import { loadAthleteState } from "./athleteState";
import { buildPlanModel, type PlanUiState } from "./planModel";
import { planPageHtml } from "./planPage";

type Ui = { openDays: Set<number>; swap: PlanUiState["swap"]; addOpen: boolean; status?: string };

/** Where an added block starts: after today when there is a today. */
function afterToday(queueLength: number): number {
  return Math.min(1, queueLength);
}

function dayIndexOf(element: Element): number {
  return Number(element.closest<HTMLElement>("[data-day]")?.dataset.day);
}

function on(root: HTMLElement, selector: string, handler: (element: HTMLElement) => void): void {
  root.querySelectorAll<HTMLElement>(selector).forEach((element) => {
    element.addEventListener("click", () => handler(element));
  });
}

export function renderPlanView(root: HTMLElement): void {
  const ui: Ui = { openDays: new Set([0]), swap: null, addOpen: false };

  /** Run an edit, report it, and repaint; a failed edit is shown, not thrown at the user. */
  const act = (edit: () => string | void): void => {
    try {
      const result = edit();
      ui.status = typeof result === "string" ? result : undefined;
    } catch (error) {
      ui.status = error instanceof Error ? error.message : "That did not work.";
    }
    ui.swap = null;
    paint();
  };

  const addDays = (kind: BlockKind, target?: string): string => {
    const queue = loadPlanQueue();
    const result = addBlockToPlan({ kind, target, context: loadAthleteState(), queue, index: afterToday(queue.items.length) });
    savePlanQueue(result.queue);
    return `Added ${result.days.length} days: ${result.days.map((day) => day.name).join(", ")}.`;
  };

  const remake = (index: number, kind: BlockKind, target?: string): string => {
    savePlanQueue(makeDay({ queue: loadPlanQueue(), index, kind, target, state: loadAthleteState() }));
    ui.openDays.add(index);
    return `This day is now ${kind === "skill" ? skillTitle(target) : DAY_KIND_LABELS[kind]}; two more follow later in the plan.`;
  };

  const wireDayEdits = (): void => {
    on(root, "[data-make-kind]", (el) => act(() => remake(dayIndexOf(el), el.dataset.makeKind as BlockKind)));
    on(root, "[data-make-skill]", (el) => act(() => remake(dayIndexOf(el), "skill", el.dataset.makeSkill)));
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
  };

  const wireExerciseEdits = (): void => {
    const slotOf = (el: Element): { index: number; templateId: string; slotId: string; exerciseId: string } => {
      const row = el.closest<HTMLElement>("[data-slot]")!;
      const index = dayIndexOf(el);
      return { index, templateId: loadPlanQueue().items[index]!, slotId: row.dataset.slot!, exerciseId: row.dataset.exercise! };
    };
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
    on(root, "[data-not-for-me]", (el) =>
      act(() => {
        const slot = slotOf(el);
        const dayExerciseIds = Array.from(
          el.closest("[data-day]")!.querySelectorAll<HTMLElement>("[data-exercise]"),
          (row) => row.dataset.exercise!,
        );
        const result = excludeFromDay({ ...slot, state: loadAthleteState(), dayExerciseIds });
        const now = result.substituteName ? ` Now: ${result.substituteName}.` : " No substitute fits, so the slot is unchanged.";
        return `Excluded ${result.excludedName} from all your sessions.${now} Restore it in the Library.`;
      }),
    );
  };

  const wireAdd = (): void => {
    on(root, "[data-add-kind]", (el) => act(() => addDays(el.dataset.addKind as BlockKind)));
    on(root, "[data-add-skill]", (el) => act(() => addDays("skill", el.dataset.addSkill)));
    on(root, "[data-add-seed]", (el) =>
      act(() => {
        savePlanQueue(appendQueueItem(loadPlanQueue(), el.dataset.addSeed!));
        return "Added to the end of the plan.";
      }),
    );
  };

  const wirePanels = (): void => {
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
  };

  const paint = (): void => {
    root.innerHTML = planPageHtml(buildPlanModel(loadPlanQueue(), loadAthleteState(), ui));
    wirePanels();
    wireDayEdits();
    wireExerciseEdits();
    wireAdd();
  };

  paint();
}

/** Used after session evaluation */
export function advancePlanAfterSession(): void {
  const override = loadScheduleOverride();
  const nextQueue = completeToday(loadPlanQueue(), override);
  clearScheduleOverride();
  savePlanQueue(nextQueue);
}
