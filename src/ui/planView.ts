import { SESSION_TEMPLATES, TEMPLATE_BY_ID } from "../data/seed";
import {
  completeNext,
  loadPlanQueue,
  moveQueueItem,
  peekUpcoming,
  removeQueueItem,
  replaceQueueItem,
  savePlanQueue,
  skipNext,
} from "../plan/queue";
import { forecastStripHtml } from "./forecastStrip";

export function renderPlanView(root: HTMLElement): void {
  const paint = (): void => {
    const queue = loadPlanQueue();
    const upcoming = peekUpcoming(queue, Math.min(3, queue.items.length));
    root.innerHTML = `
      <main class="shell">
        <p class="eyebrow">Plan</p>
        <h1>Session queue</h1>
        <p class="tagline">Delete or rearrange anything. Next is what Today runs.</p>
        ${forecastStripHtml(upcoming)}
        <div class="row">
          <button type="button" data-skip>Skip next → tail</button>
        </div>
        <p class="eyebrow">Full queue</p>
        <ol class="queue-list queue-edit">
          ${queue.items
            .map((id, index) => queueRowHtml(id, index, queue.items.length))
            .join("")}
        </ol>
        <p class="eyebrow">Add to end</p>
        <div class="row wrap">
          ${SESSION_TEMPLATES.map(
            (template) =>
              `<button type="button" data-add="${template.id}">+ ${template.name}</button>`,
          ).join("")}
        </div>
      </main>
    `;

    wirePlanControls(root, paint);
  };

  paint();
}

function queueRowHtml(id: string, index: number, total: number): string {
  const template = TEMPLATE_BY_ID[id];
  const options = SESSION_TEMPLATES.map(
    (item) =>
      `<option value="${item.id}" ${item.id === id ? "selected" : ""}>${item.name}</option>`,
  ).join("");
  return `
    <li class="queue-edit-row" data-index="${index}">
      <span class="queue-pos">${index === 0 ? "Next" : String(index + 1)}</span>
      <select data-replace aria-label="Template at position ${index + 1}">${options}</select>
      <button type="button" data-up ${index === 0 ? "disabled" : ""} aria-label="Move up">↑</button>
      <button type="button" data-down ${index >= total - 1 ? "disabled" : ""} aria-label="Move down">↓</button>
      <button type="button" data-remove ${total <= 1 ? "disabled" : ""} aria-label="Delete">Delete</button>
      <span class="hint">${template?.focus ?? ""}</span>
    </li>
  `;
}

function wirePlanControls(root: HTMLElement, paint: () => void): void {
  root.querySelector("[data-skip]")?.addEventListener("click", () => {
    savePlanQueue(skipNext(loadPlanQueue()));
    paint();
  });

  root.querySelectorAll<HTMLButtonElement>("[data-add]").forEach((button) => {
    button.addEventListener("click", () => {
      const queueNow = loadPlanQueue();
      queueNow.items.push(button.dataset.add!);
      savePlanQueue(queueNow);
      paint();
    });
  });

  root.querySelectorAll<HTMLElement>(".queue-edit-row").forEach((row) => {
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

/** Used after session evaluation */
export function advancePlanAfterSession(): void {
  savePlanQueue(completeNext(loadPlanQueue()));
}
