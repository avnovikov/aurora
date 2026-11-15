import { SESSION_TEMPLATES } from "../data/seed";
import { chipHtml } from "../library/chips";
import { escapeHtml } from "../library/present";
import { DAY_KIND_LABELS, dayTitle, kindOfTemplate } from "../plan/dayKinds";
import { generateJointCareDay } from "../plan/jointCareDay";
import { savePlanDays } from "../plan/planDays";
import { loadPlanQueue } from "../plan/queue";
import {
  clearScheduleOverride,
  saveScheduleOverride,
  type ScheduleOverride,
} from "../plan/scheduleOverride";
import { findTemplate } from "../plan/templates";
import { loadAthleteState } from "./athleteState";

/**
 * "Train something else today": a collapsed panel (same look as the Library
 * filters) with one chip per seed day plus a light Joint care day, open
 * while an override is active.
 */
export function overrideControlsHtml(override: ScheduleOverride | null): string {
  const queueHead = loadPlanQueue().items[0];
  const active = override ? findTemplate(override.templateId) : undefined;
  const careActive = active !== undefined && kindOfTemplate(active) === "joint_care";
  const chips = SESSION_TEMPLATES.filter((template) => template.id !== queueHead)
    .map((template) => chipHtml("override", template.id, dayTitle(template), template.id === override?.templateId))
    .join("");
  const care = chipHtml("override-care", "1", DAY_KIND_LABELS.joint_care, careActive);
  const summary = escapeHtml(active ? `Train something else today · ${dayTitle(active)}` : "Train something else today");
  const clear = override
    ? `<p class="override-clear"><button type="button" class="lib-link" data-override-clear>Back to the plan</button></p>`
    : "";
  return `
    <details class="lib-filters override-controls" data-override-controls${override ? " open" : ""}>
      <summary>${summary}</summary>
      <div class="row wrap" role="group" aria-label="Train instead today">${chips}${care}</div>
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
  root.querySelector("[data-override-care]")?.addEventListener("click", () => {
    // A light day from the prehab list, generated for today and kept only while it is the override.
    const day = generateJointCareDay(loadAthleteState());
    savePlanDays([day]);
    saveScheduleOverride({ templateId: day.id });
    onChange();
  });
  root.querySelector("[data-override-clear]")?.addEventListener("click", () => {
    clearScheduleOverride();
    onChange();
  });
}
