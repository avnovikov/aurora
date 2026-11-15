import { SESSION_TEMPLATES, TEMPLATE_BY_ID } from "../data/seed";
import {
  completeNext,
  loadPlanQueue,
  peekUpcoming,
  savePlanQueue,
  skipNext,
} from "../plan/queue";
import { forecastStripHtml } from "./forecastStrip";

export function renderPlanView(root: HTMLElement): void {
  const paint = (): void => {
    const queue = loadPlanQueue();
    const upcoming = peekUpcoming(queue, Math.min(6, queue.items.length));
    root.innerHTML = `
      <main class="shell">
        <p class="eyebrow">Plan</p>
        <h1>Next sessions</h1>
        <p class="tagline">No hard calendar — just the queue. Finish Today to advance.</p>
        ${forecastStripHtml(upcoming)}
        <div class="row">
          <button type="button" data-skip>Skip next (send to tail)</button>
        </div>
        <p class="eyebrow">Add template</p>
        <div class="row wrap">
          ${SESSION_TEMPLATES.map(
            (template) =>
              `<button type="button" data-add="${template.id}">+ ${template.name}</button>`,
          ).join("")}
        </div>
        <ol class="queue-list">
          ${queue.items
            .map((id, index) => {
              const template = TEMPLATE_BY_ID[id];
              return `<li>${index + 1}. ${template?.name ?? id}</li>`;
            })
            .join("")}
        </ol>
      </main>
    `;

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
  };

  paint();
}

/** Used after session evaluation */
export function advancePlanAfterSession(): void {
  savePlanQueue(completeNext(loadPlanQueue()));
}
