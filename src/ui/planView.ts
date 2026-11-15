import { EXERCISE_GRAPH, PLANNABLE_EXERCISES, plannableByPattern } from "../data/exerciseGraph";
import { SESSION_TEMPLATES } from "../data/seed";
import { missingGear } from "../safety/gear";
import { loadProfile } from "../settings/profile";
import { SKILL_TIER_LABELS } from "../domain/skillTier";
import { escapeHtml, formatPattern } from "../library/present";
import {
  appendQueueItem,
  completeToday,
  loadPlanQueue,
  moveQueueItem,
  removeQueueItem,
  replaceQueueItem,
  savePlanQueue,
  skipNext,
} from "../plan/queue";
import {
  clearScheduleOverride,
  loadScheduleOverride,
} from "../plan/scheduleOverride";
import {
  clearTemplateOverride,
  listResolvedTemplates,
  resolveTemplate,
  setSlotExercise,
  setTemplateTarget,
} from "../plan/templates";
import {
  exerciseName,
  templateDurationLabel,
  templateTargetsLabel,
} from "./formatTemplate";

export function renderPlanView(root: HTMLElement): void {
  const paint = (): void => {
    const queue = loadPlanQueue();
    root.innerHTML = `
      <main class="shell">
        <p class="eyebrow">Plan</p>
        <h1>Queue</h1>
        <p class="tagline">First item is Today. Move it with the arrows.</p>
        <button type="button" class="plan-skip" data-skip>Skip next → end</button>
        <ol class="plan-queue" aria-label="Session queue">
          ${queue.items
            .map((id, index) => queueItemHtml(id, index, queue.items.length))
            .join("")}
        </ol>
        <section class="plan-section">
          <p class="eyebrow">Add session</p>
          <div class="plan-add">
            ${SESSION_TEMPLATES.map(
              (template) =>
                `<button type="button" data-add="${template.id}">${template.name}</button>`,
            ).join("")}
          </div>
        </section>
        <section class="plan-section">
          <p class="eyebrow">Procedure</p>
          <p class="tagline">Working exercises now; Target is the north star.</p>
          <div class="procedure-list">
            ${listResolvedTemplates()
              .map((template) => procedureBlockHtml(template.id))
              .join("")}
          </div>
        </section>
      </main>
    `;

    wirePlanControls(root, paint);
    wireProcedureControls(root, paint);
  };

  paint();
}

function queueItemHtml(id: string, index: number, total: number): string {
  const template = resolveTemplate(id);
  const isNext = index === 0;
  const targetNames = templateTargetsLabel(template.targetExerciseIds);
  const duration = templateDurationLabel(template);
  const replaceOptions = SESSION_TEMPLATES.map(
    (item) =>
      `<option value="${item.id}" ${item.id === id ? "selected" : ""}>${item.name}</option>`,
  ).join("");
  return `
    <li class="plan-queue-item ${isNext ? "is-next" : ""}" data-index="${index}">
      <div class="plan-queue-rank">${isNext ? "Next" : String(index + 1)}</div>
      <div class="plan-queue-body">
        <strong>${template.name}</strong>
        <p class="hint">${duration}${targetNames ? ` · ${targetNames}` : ""}</p>
        <label class="plan-replace">
          <span class="visually-hidden">Change session type</span>
          <select data-replace aria-label="Change session ${index + 1}">${replaceOptions}</select>
        </label>
      </div>
      <div class="plan-queue-move" role="group" aria-label="Reorder">
        <button type="button" data-up ${index === 0 ? "disabled" : ""} aria-label="Move earlier">↑</button>
        <button type="button" data-down ${index >= total - 1 ? "disabled" : ""} aria-label="Move later">↓</button>
      </div>
      <button type="button" class="plan-remove" data-remove ${total <= 1 ? "disabled" : ""} aria-label="Remove from queue">✕</button>
    </li>
  `;
}

function procedureBlockHtml(templateId: string): string {
  const template = resolveTemplate(templateId);
  // Templates without a north-star skill (Mobility) have nothing to pick.
  const targetSelect =
    template.targetExerciseIds.length > 0
      ? exerciseSelectHtml(
          template.targetExerciseIds[0],
          `data-target data-template="${template.id}"`,
          "Target",
        )
      : "";
  const slots = template.slots
    .map((slot) =>
      exerciseSelectHtml(
        slot.exerciseId,
        `data-slot-exercise data-template="${template.id}" data-slot="${slot.id}"`,
        slot.label,
      ),
    )
    .join("");
  return `
    <details class="procedure-block" ${template.id === "tmpl_bars" ? "open" : ""}>
      <summary>
        <span>${template.name}</span>
        <span class="hint">${
          template.targetExerciseIds[0]
            ? exerciseName(template.targetExerciseIds[0])
            : "No target"
        }</span>
      </summary>
      <div class="procedure-fields">
        ${targetSelect}
        ${slots}
        <button type="button" class="plan-reset" data-reset-procedure="${template.id}">Reset to default</button>
      </div>
    </details>
  `;
}

/**
 * Every plannable Library move the user has the gear for, grouped by pattern with its level.
 * A current pick outside that set (e.g. a Mobility warmup-role slot) stays selectable.
 */
function exerciseSelectHtml(selected: string | undefined, attrs: string, label: string): string {
  const { equipment } = loadProfile();
  const usable = (id: string, requires: Parameters<typeof missingGear>[0]): boolean =>
    id === selected || missingGear(requires, equipment).length === 0;
  const groups = [...plannableByPattern()].flatMap(([pattern, exercises]) => {
    const options = exercises
      .filter((exercise) => usable(exercise.id, exercise.requires))
      .map((exercise) => optionHtml(exercise.id, selected))
      .join("");
    return options ? [`<optgroup label="${escapeHtml(formatPattern(pattern))}">${options}</optgroup>`] : [];
  });
  const isListed = PLANNABLE_EXERCISES.some((exercise) => exercise.id === selected);
  const current = selected && !isListed ? optionHtml(selected, selected) : "";
  return `
    <label class="procedure-field">
      <span>${label}</span>
      <select ${attrs}>${current}${groups.join("")}</select>
    </label>
  `;
}

function optionHtml(id: string, selected: string | undefined): string {
  const exercise = EXERCISE_GRAPH[id];
  const level = exercise?.difficulty ? ` · ${SKILL_TIER_LABELS[exercise.difficulty]}` : "";
  const isSelected = id === selected ? "selected" : "";
  return `<option value="${escapeHtml(id)}" ${isSelected}>${escapeHtml(exerciseName(id))}${level}</option>`;
}

function wirePlanControls(root: HTMLElement, paint: () => void): void {
  root.querySelector("[data-skip]")?.addEventListener("click", () => {
    savePlanQueue(skipNext(loadPlanQueue()));
    paint();
  });

  root.querySelectorAll<HTMLButtonElement>("[data-add]").forEach((button) => {
    button.addEventListener("click", () => {
      const templateId = button.dataset.add;
      if (!templateId) {
        return;
      }
      savePlanQueue(appendQueueItem(loadPlanQueue(), templateId));
      paint();
    });
  });

  root.querySelectorAll<HTMLElement>(".plan-queue-item").forEach((row) => {
    const index = Number(row.dataset.index);
    row.querySelector("[data-up]")?.addEventListener("click", () => {
      if (index <= 0) {
        return;
      }
      savePlanQueue(moveQueueItem(loadPlanQueue(), index, index - 1));
      paint();
    });
    row.querySelector("[data-down]")?.addEventListener("click", () => {
      savePlanQueue(moveQueueItem(loadPlanQueue(), index, index + 1));
      paint();
    });
    row.querySelector("[data-remove]")?.addEventListener("click", () => {
      savePlanQueue(removeQueueItem(loadPlanQueue(), index));
      paint();
    });
    row.querySelector<HTMLSelectElement>("[data-replace]")?.addEventListener(
      "change",
      (event) => {
        const templateId = (event.target as HTMLSelectElement).value;
        savePlanQueue(replaceQueueItem(loadPlanQueue(), index, templateId));
        paint();
      },
    );
  });
}

function wireProcedureControls(root: HTMLElement, paint: () => void): void {
  root.querySelectorAll<HTMLSelectElement>("[data-target]").forEach((select) => {
    select.addEventListener("change", () => {
      const templateId = select.dataset.template;
      if (!templateId) {
        return;
      }
      setTemplateTarget(templateId, select.value);
      paint();
    });
  });

  root.querySelectorAll<HTMLSelectElement>("[data-slot-exercise]").forEach((select) => {
    select.addEventListener("change", () => {
      const templateId = select.dataset.template;
      const slotId = select.dataset.slot;
      if (!templateId || !slotId) {
        return;
      }
      setSlotExercise(templateId, slotId, select.value);
      paint();
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-reset-procedure]").forEach((button) => {
    button.addEventListener("click", () => {
      const templateId = button.dataset.resetProcedure;
      if (!templateId) {
        return;
      }
      clearTemplateOverride(templateId);
      paint();
    });
  });
}

/** Used after session evaluation */
export function advancePlanAfterSession(): void {
  const override = loadScheduleOverride();
  const nextQueue = completeToday(loadPlanQueue(), override);
  clearScheduleOverride();
  savePlanQueue(nextQueue);
}
