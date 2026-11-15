import { escapeHtml } from "./present";
import type { UpcomingPlanDay } from "../plan/pathPlacement";

export interface PlanPickActions {
  onCancel: () => void;
  onConfirm: (templateId: string) => void;
}

export function mountPlanDayPicker(
  root: HTMLElement,
  exerciseName: string,
  days: readonly UpcomingPlanDay[],
  actions: PlanPickActions,
): void {
  root.innerHTML = planPickHtml(exerciseName, days);
  root.querySelector("[data-plan-pick-cancel]")?.addEventListener("click", () => {
    actions.onCancel();
  });
  root.querySelector("[data-plan-pick-confirm]")?.addEventListener("click", () => {
    const selected = root.querySelector<HTMLInputElement>(
      "input[name='plan-day']:checked",
    );
    if (!selected?.value) {
      return;
    }
    actions.onConfirm(selected.value);
  });
}

export function planPickHtml(
  exerciseName: string,
  days: readonly UpcomingPlanDay[],
): string {
  const options = days.map(planDayOptionHtml).join("");
  return `
    <main class="shell lib-plan-pick">
      <p class="eyebrow">Add to the plan</p>
      <h1>${escapeHtml(exerciseName)}</h1>
      <p class="tagline">Choose which upcoming day gets this move at your current level.</p>
      <div class="plan-pick-list" role="radiogroup" aria-label="Plan day">
        ${options}
      </div>
      <div class="row">
        <button type="button" class="cta" data-plan-pick-confirm>Add to plan</button>
        <button type="button" class="btn-quiet" data-plan-pick-cancel>Cancel</button>
      </div>
    </main>
  `;
}

function planDayOptionHtml(day: UpcomingPlanDay): string {
  const checked = day.isDefault ? "checked" : "";
  const label = day.isDefault ? `${day.name} (tomorrow)` : day.name;
  return `
    <label class="plan-pick-option">
      <input type="radio" name="plan-day" value="${escapeHtml(day.templateId)}" ${checked} />
      <span>${escapeHtml(label)}</span>
    </label>
  `;
}
