import { EXERCISE_GRAPH } from "../data/exerciseGraph";
import type { PlanQueue, SessionTemplate } from "../domain/program";
import { exerciseMetaLine } from "../library/metaLine";
import { AREA_KINDS, DAY_KIND_LABELS, dayTitle, skillTitle } from "../plan/dayKinds";
import { swapChoices } from "../plan/dayEdits";
import { previewDay, type AthleteState } from "../plan/dayPreview";
import { hasProgressionPath } from "../plan/pathPlacement";
import { listAllTemplates, resolveTemplate } from "../plan/templates";
import { warmupCooldownLabel } from "../rules/sessionDuration";
import { templateDurationLabel, templateTargetsLabel } from "./formatTemplate";
import type { DayOption, PlanDayView, PlanPageModel, SwapOption } from "./planPage";

/** What the page remembers between repaints (nothing here is persisted). */
export interface PlanUiState {
  openDays: ReadonlySet<number>;
  /** The slot whose swap choices are showing. */
  swap: { index: number; slotId: string } | null;
  addOpen: boolean;
  status?: string;
}

const MOBILITY_TEMPLATE_ID = "tmpl_mobility";

/** Named skills on offer: every target already in the plan or the seed days that sits on a ladder. */
function skillOptions(): DayOption[] {
  const ids = new Set(listAllTemplates().flatMap((template) => template.targetExerciseIds));
  return [...ids]
    .filter((id) => {
      const exercise = EXERCISE_GRAPH[id];
      return exercise !== undefined && hasProgressionPath(exercise);
    })
    .map((id) => ({ value: id, label: skillTitle(id), type: "skill" as const }));
}

function areaOptions(): DayOption[] {
  return AREA_KINDS.map((kind) => ({ value: kind, label: DAY_KIND_LABELS[kind], type: "kind" as const }));
}

function dayMeta(template: SessionTemplate): string {
  const targets = templateTargetsLabel(template.targetExerciseIds, ", ");
  return [targets ? `Toward ${targets}` : "", warmupCooldownLabel(template)].filter(Boolean).join(" · ");
}

function dayView(templateId: string, index: number, state: AthleteState, ui: PlanUiState): PlanDayView {
  const template = resolveTemplate(templateId);
  const items = previewDay(template, state, index === 0);
  const swapSlotId = ui.swap?.index === index ? ui.swap.slotId : undefined;
  const swapping = items.find((item) => item.slotId === swapSlotId);
  const swapOptions: SwapOption[] = swapping
    ? swapChoices(swapping.exerciseId, state, items.map((item) => item.exerciseId)).map((exercise) => ({
        id: exercise.id,
        name: exercise.name,
        meta: exerciseMetaLine(exercise),
      }))
    : [];
  return {
    index,
    title: dayTitle(template),
    duration: templateDurationLabel(template),
    meta: dayMeta(template),
    items,
    open: ui.openDays.has(index),
    swapSlotId: swapping ? swapSlotId : undefined,
    swapOptions,
  };
}

/** Everything the Plan page shows, from the queue, the athlete and the page's own state. */
export function buildPlanModel(queue: PlanQueue, state: AthleteState, ui: PlanUiState): PlanPageModel {
  const make = [...areaOptions(), ...skillOptions()];
  return {
    days: queue.items.map((id, index) => dayView(id, index, state, ui)),
    makeOptions: make,
    addOptions: [...make, { value: MOBILITY_TEMPLATE_ID, label: DAY_KIND_LABELS.mobility, type: "seed" }],
    addOpen: ui.addOpen,
    status: ui.status,
  };
}
