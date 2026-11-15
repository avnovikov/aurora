import { escapeHtml } from "../library/present";
import type { PreviewItem } from "../plan/dayPreview";

/** One choice in "Make this day" / "Add days": an area, a named skill, or a single seed day. */
export interface DayOption {
  /** `data-*` value: an area kind, an exercise id (skill), a template id (seed) or "care". */
  value: string;
  label: string;
  type: "kind" | "skill" | "seed" | "care";
}

export interface SwapOption {
  id: string;
  name: string;
  /** "Lower body · Quads · Beginner" in the Library's words. */
  meta: string;
}

export interface PlanDayView {
  index: number;
  title: string;
  /** "≈ 32 min". */
  duration: string;
  /** "Toward Pistol squat · Warm-up 9 min · +4 min cool-down". */
  meta: string;
  items: readonly PreviewItem[];
  open: boolean;
  /** Slot whose swap choices are showing, if any. */
  swapSlotId?: string;
  swapOptions: readonly SwapOption[];
}

export interface PlanPageModel {
  days: readonly PlanDayView[];
  /** Areas and named skills a day can be turned into. */
  makeOptions: readonly DayOption[];
  /** Blocks and single days that can be added. */
  addOptions: readonly DayOption[];
  addOpen: boolean;
  /** Result of the last action ("Excluded Nordic curl. Now: Sliding Leg Curl."). */
  status?: string;
}

function actionHtml(attr: string, value: string, label: string): string {
  return `<button type="button" data-${attr}="${escapeHtml(value)}">${escapeHtml(label)}</button>`;
}

function optionHtml(prefix: string, option: DayOption): string {
  return actionHtml(`${prefix}-${option.type}`, option.value, option.label);
}

function swapRowHtml(options: readonly SwapOption[]): string {
  if (options.length === 0) {
    return `<p class="lib-meta" data-swap-empty>No other move fits this slot with your gear, joints and exclusions.</p>`;
  }
  const chips = options
    .map(
      (option) =>
        `<button type="button" class="plan-swap-pick" data-swap-pick="${escapeHtml(option.id)}"><strong>${escapeHtml(option.name)}</strong><span class="lib-meta">${escapeHtml(option.meta)}</span></button>`,
    )
    .join("");
  return `<div class="plan-swap" role="group" aria-label="Swap for">${chips}</div>`;
}

function exerciseHtml(item: PreviewItem, day: PlanDayView): string {
  const swapping = day.swapSlotId === item.slotId;
  const notes = [item.note, ...item.cautions]
    .filter((note): note is string => Boolean(note))
    .map((note) => `<p class="lib-meta plan-ex-note">${escapeHtml(note)}</p>`)
    .join("");
  return `
    <li class="plan-ex" data-slot="${escapeHtml(item.slotId)}" data-exercise="${escapeHtml(item.exerciseId)}">
      <div class="plan-ex-main">
        <strong>${escapeHtml(item.name)}</strong>
        <span class="lib-meta">${escapeHtml(item.label)} · ${escapeHtml(item.dose)}</span>
      </div>
      <div class="plan-ex-actions">
        <button type="button" data-swap aria-pressed="${swapping}">Swap</button>
        <button type="button" data-not-for-me>Not for me</button>
      </div>
      ${notes}
      ${swapping ? swapRowHtml(day.swapOptions) : ""}
    </li>
  `;
}

function dayHtml(day: PlanDayView, total: number, makeOptions: readonly DayOption[]): string {
  const when = day.index === 0 ? "Today" : `Then ${day.index + 1}`;
  const first = day.index === 0;
  const last = day.index >= total - 1;
  const later = first && total > 1 ? actionHtml("later", String(day.index), "To the end") : "";
  return `
    <li>
      <details class="lib-filters plan-day${first ? " is-today" : ""}" data-day="${day.index}"${day.open ? " open" : ""}>
        <summary>
          <span class="plan-day-when">${when}</span>
          <span class="plan-day-title">${escapeHtml(day.title)}</span>
          <span class="plan-day-time">${escapeHtml(day.duration)}</span>
        </summary>
        <p class="lib-meta plan-day-meta">${escapeHtml(day.meta)}</p>
        <ol class="plan-exercises">${day.items.map((item) => exerciseHtml(item, day)).join("")}</ol>
        <p class="chip-row-label">Make this day</p>
        <div class="row wrap" role="group" aria-label="Make this day">${makeOptions.map((option) => optionHtml("make", option)).join("")}</div>
        <p class="chip-row-label">Move</p>
        <div class="row wrap" role="group" aria-label="Move this day">
          <button type="button" data-move="up"${first ? " disabled" : ""}>Earlier</button>
          <button type="button" data-move="down"${last ? " disabled" : ""}>Later</button>
          ${later}
          <button type="button" data-remove${total <= 1 ? " disabled" : ""}>Remove</button>
        </div>
      </details>
    </li>
  `;
}

function addPanelHtml(model: PlanPageModel): string {
  const isSingle = (option: DayOption): boolean => option.type === "seed" || option.type === "care";
  const blocks = model.addOptions.filter((option) => !isSingle(option));
  const singles = model.addOptions.filter(isSingle);
  const single =
    singles.length > 0
      ? `<p class="chip-row-label">One day</p><div class="row wrap" role="group" aria-label="Add one day">${singles.map((option) => optionHtml("add", option)).join("")}</div>`
      : "";
  return `
    <details class="lib-filters" data-add-days${model.addOpen ? " open" : ""}>
      <summary>Add days</summary>
      <p class="chip-row-label">Three days at your level, after today</p>
      <div class="row wrap" role="group" aria-label="Add a block of days">${blocks.map((option) => optionHtml("add", option)).join("")}</div>
      ${single}
    </details>
  `;
}

/**
 * The Plan page, read first: the days coming up, each opening to the
 * exercises its session will really contain, with the two quick edits
 * (change the day's area; drop or swap a move).
 */
export function planPageHtml(model: PlanPageModel): string {
  const count = model.days.length;
  const status = model.status ? `<p class="plan-status" data-plan-status aria-live="polite">${escapeHtml(model.status)}</p>` : "";
  return `
    <main class="shell plan">
      <p class="eyebrow">Plan</p>
      <h1>Coming up</h1>
      <p class="lib-count">${count} ${count === 1 ? "day" : "days"} · open a day to see its exercises</p>
      ${status}
      <ol class="plan-days" aria-label="Days coming up">
        ${model.days.map((day) => dayHtml(day, count, model.makeOptions)).join("")}
      </ol>
      ${addPanelHtml(model)}
      <p class="hint">Exercises shown are for a normal morning. A poor night's sleep or a deload week makes the day lighter.</p>
    </main>
  `;
}
