import { SEED_EXERCISES, SESSION_TEMPLATES } from "../data/seed";
import {
  appendQueueItem,
  completeNext,
  loadPlanQueue,
  moveQueueItem,
  removeQueueItem,
  replaceQueueItem,
  savePlanQueue,
  skipNext,
} from "../plan/queue";
import { clearScheduleOverride } from "../plan/scheduleOverride";
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
  const workIds = SEED_EXERCISES.filter((item) => item.role === "work").map(
    (item) => item.id,
  );
  // Templates without a north-star skill (Mobility) have nothing to pick.
  const targetSelect =
    template.targetExerciseIds.length > 0
      ? exerciseSelectHtml(
          workIds,
          template.targetExerciseIds[0],
          `data-target data-template="${template.id}"`,
          "Target",
        )
      : "";
  const slots = template.slots
    .map((slot) =>
      exerciseSelectHtml(
        withSelected(workIds, slot.exerciseId),
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

/** Slot exercises may be warmup-role moves (Mobility); keep them selectable. */
function withSelected(ids: string[], selectedId: string): string[] {
  return ids.includes(selectedId) ? ids : [selectedId, ...ids];
}

function exerciseSelectHtml(
  ids: string[],
  selected: string | undefined,
  attrs: string,
  label: string,
): string {
  const options = ids
    .map((id) => {
      const name = exerciseName(id);
      const isSelected = id === selected ? "selected" : "";
      return `<option value="${id}" ${isSelected}>${name}</option>`;
    })
    .join("");
  return `
    <label class="procedure-field">
      <span>${label}</span>
      <select ${attrs}>${options}</select>
    </label>
  `;
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
  clearScheduleOverride();
  savePlanQueue(completeNext(loadPlanQueue()));
}
