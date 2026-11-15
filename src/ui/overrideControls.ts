import { SESSION_TEMPLATES } from "../data/seed";
import { loadPlanQueue } from "../plan/queue";
import {
  clearScheduleOverride,
  saveScheduleOverride,
  type ScheduleOverride,
} from "../plan/scheduleOverride";

/** "Train X instead today" buttons plus a clear action when an override is active. */
export function overrideControlsHtml(override: ScheduleOverride | null): string {
  const queueHead = loadPlanQueue().items[0];
  const buttons = SESSION_TEMPLATES.filter((template) => template.id !== queueHead)
    .map((template) => {
      const active = template.id === override?.templateId;
      return `<button type="button" data-override="${template.id}" aria-pressed="${active}">Train ${template.name} instead today</button>`;
    })
    .join("");
  const clear = override
    ? `<button type="button" class="override-clear" data-override-clear>Clear override</button>`
    : "";
  return `
    <section class="plan-section override-controls" data-override-controls>
      <p class="eyebrow">Today only</p>
      <div class="plan-add">${buttons}</div>
      ${clear}
    </section>
  `;
}

export function wireOverrideControls(root: HTMLElement, onChange: () => void): void {
  root.querySelectorAll<HTMLButtonElement>("[data-override]").forEach((button) => {
    button.addEventListener("click", () => {
      const templateId = button.dataset.override;
      if (!templateId) {
        return;
      }
      saveScheduleOverride({ templateId });
      onChange();
    });
  });
  root.querySelector("[data-override-clear]")?.addEventListener("click", () => {
    clearScheduleOverride();
    onChange();
  });
}
