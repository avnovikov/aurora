import { SESSION_TEMPLATES } from "../data/seed";
import { chipHtml } from "../library/chips";
import { escapeHtml } from "../library/present";
import { dayTitle } from "../plan/dayKinds";
import { loadPlanQueue } from "../plan/queue";
import {
  clearScheduleOverride,
  saveScheduleOverride,
  type ScheduleOverride,
} from "../plan/scheduleOverride";

/**
 * "Train something else today": a collapsed panel (same look as the Library
 * filters) with one chip per session, open while an override is active.
 */
export function overrideControlsHtml(override: ScheduleOverride | null): string {
  const queueHead = loadPlanQueue().items[0];
  const chips = SESSION_TEMPLATES.filter((template) => template.id !== queueHead)
    .map((template) => chipHtml("override", template.id, dayTitle(template), template.id === override?.templateId))
    .join("");
  const active = SESSION_TEMPLATES.find((template) => template.id === override?.templateId);
  const summary = escapeHtml(active ? `Train something else today · ${dayTitle(active)}` : "Train something else today");
  const clear = override
    ? `<p class="override-clear"><button type="button" class="lib-link" data-override-clear>Back to the plan</button></p>`
    : "";
  return `
    <details class="lib-filters override-controls" data-override-controls${override ? " open" : ""}>
      <summary>${summary}</summary>
      <div class="row wrap" role="group" aria-label="Train instead today">${chips}</div>
      ${clear}
    </details>
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
