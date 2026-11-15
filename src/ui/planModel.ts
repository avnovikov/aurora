import { EXERCISE_GRAPH } from "../data/exerciseGraph";
import type { PlanQueue, SessionTemplate } from "../domain/program";
import { exerciseMetaLine } from "../library/metaLine";
import { AREA_KINDS, DAY_KIND_LABELS, MOBILITY_TEMPLATE_ID, dayTitle, skillTitle } from "../plan/dayKinds";
import { swapChoices } from "../plan/dayEdits";
import { previewQueue, type AthleteState, type PreviewItem } from "../plan/dayPreview";
import { hasProgressionPath } from "../plan/pathPlacement";
import { PLAN_LEVELS, loadPlanLevel } from "../plan/planLevel";
import { listAllTemplates, resolveTemplate } from "../plan/templates";
import { warmupCooldownLabel } from "../rules/sessionDuration";
import { templateDurationLabel, templateTargetsLabel } from "./formatTemplate";
import type { DayOption, PlanDayView, PlanPageModel, SwapOption } from "./planPage";

/** What the page remembers between repaints (nothing here is persisted). */
export interface PlanUiState {
  openDays: ReadonlySet<number>;
  /** The slot whose swap choices are showing. */
  swap: { index: number; slotId: string } | null;
  /** Exercises whose description is open, as "dayIndex:slotId". */
  openExercises: ReadonlySet<string>;
  addOpen: boolean;
  levelOpen: boolean;
  status?: string;
}

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

/** Key for an opened exercise description. */
export function exerciseKey(dayIndex: number, slotId: string): string {
  return `${dayIndex}:${slotId}`;
}

function dayView(
  template: SessionTemplate,
  items: readonly PreviewItem[],
  index: number,
  state: AthleteState,
  ui: PlanUiState,
): PlanDayView {
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
    openSlotIds: items.filter((item) => ui.openExercises.has(exerciseKey(index, item.slotId))).map((item) => item.slotId),
  };
}

/** Everything the Plan page shows, from the queue, the athlete and the page's own state. */
export function buildPlanModel(queue: PlanQueue, state: AthleteState, ui: PlanUiState): PlanPageModel {
  const make = [...areaOptions(), ...skillOptions()];
  return {
    days: (() => {
      const templates = queue.items.map((id) => resolveTemplate(id));
      const previews = previewQueue(templates, state);
      return templates.map((template, index) => dayView(template, previews[index]!, index, state, ui));
    })(),
    makeOptions: make,
    addOptions: [
      ...make,
      { value: MOBILITY_TEMPLATE_ID, label: DAY_KIND_LABELS.mobility, type: "seed" },
      { value: "care", label: DAY_KIND_LABELS.joint_care, type: "care" },
    ],
    addOpen: ui.addOpen,
    level: { options: PLAN_LEVELS, value: loadPlanLevel(), open: ui.levelOpen },
    status: ui.status,
  };
}
