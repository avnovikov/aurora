import { chipRowHtml } from "../library/chips";
import { escapeHtml } from "../library/present";
import type { PreviewItem } from "../plan/dayPreview";
import "../styles/plan.css";

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
  /** Slots whose description is showing (tapped open). */
  openSlotIds: readonly string[];
  swapOptions: readonly SwapOption[];
  /** Slots whose move has an easier step this athlete can be given. */
  easierSlotIds: readonly string[];
  /** The slot just changed by "Not for me", with its message, until the next edit. */
  undo?: PlanUndoNotice;
}

export interface PlanUndoNotice {
  slotId: string;
  /** The move that was excluded (named on the Undo button). */
  name: string;
  /** "Excluded Nordic curl from all your sessions. Now: Sliding Leg Curl. …" */
  message: string;
}

export interface PlanPageModel {
  days: readonly PlanDayView[];
  /** Areas and named skills a day can be turned into. */
  makeOptions: readonly DayOption[];
  /** Blocks and single days that can be added. */
  addOptions: readonly DayOption[];
  addOpen: boolean;
  /** The plan's level: every choice, the current one, and whether its panel is open. */
  level: { options: ReadonlyArray<{ id: string; label: string }>; value: string; open: boolean };
  /** Result of the last action ("Excluded Nordic curl. Now: Sliding Leg Curl."). */
  status?: string;
  /** Auto-raise from logged performance (#115); dismissible. */
  raiseNotice?: string;
}

function actionHtml(attr: string, value: string, label: string): string {
  return `<button type="button" data-${attr}="${escapeHtml(value)}">${escapeHtml(label)}</button>`;
}

function disabledIf(inactive: boolean): string {
  return inactive ? " disabled" : "";
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

/** What opens under a tapped exercise: its one-line description and any joint notes. */
function exerciseDetailHtml(item: PreviewItem): string {
  const summary = item.summary ? `<p class="plan-ex-desc">${escapeHtml(item.summary)}</p>` : "";
  const cautions = item.cautions.map((note) => `<p class="lib-meta">${escapeHtml(note)}</p>`).join("");
  const empty = !summary && !cautions ? `<p class="lib-meta">No description yet.</p>` : "";
  return `<div class="plan-ex-detail" data-ex-detail>${summary}${cautions}${empty}</div>`;
}

function whenLabel(index: number): string {
  return index === 0 ? "Today" : `Then ${index + 1}`;
}

/** How a row's controls are named and tied together. */
interface RowLabel {
  /** "Hollow body hold (Hollow finish), Today": the move, its slot when the day has it twice, and the day. */
  name: string;
  /** The id prefix of the row's ⋯ button, menu and hidden reasons. */
  id: string;
}

function rowLabel(item: PreviewItem, day: PlanDayView): RowLabel {
  const twice = day.items.filter((other) => other.name === item.name).length > 1;
  const slot = twice ? ` (${item.label})` : "";
  return {
    name: `${item.name}${slot}, ${whenLabel(day.index)}`,
    id: `plan-ex-${day.index}-${item.slotId}`.replace(/[^A-Za-z0-9_-]/g, "-"),
  };
}

function easierHtml(row: RowLabel, available: boolean): string {
  const label = escapeHtml(`Easier: ${row.name}`);
  if (available) {
    return `<button type="button" class="plan-ex-easier" data-easier aria-label="${label}">Easier</button>`;
  }
  return `<button type="button" class="plan-ex-easier" data-easier aria-disabled="true" aria-label="${label}" aria-describedby="${row.id}-no-easier">Easier</button><span class="visually-hidden" id="${row.id}-no-easier">No easier step</span>`;
}

/** ⋯ and the menu it opens, holding "Not for me". */
function moreMenuHtml(row: RowLabel): string {
  const moreLabel = escapeHtml(`More options: ${row.name}`);
  const outLabel = escapeHtml(`Not for me: ${row.name}`);
  return `<button type="button" class="plan-ex-more" data-more id="${row.id}-more" aria-label="${moreLabel}" aria-haspopup="menu" aria-expanded="false" aria-controls="${row.id}-menu"><span aria-hidden="true">⋯</span></button>
        <div class="plan-ex-menu" id="${row.id}-menu" role="menu" aria-labelledby="${row.id}-more" hidden>
          <button type="button" role="menuitem" class="plan-ex-out" data-not-for-me aria-label="${outLabel}" aria-describedby="${row.id}-out-help"><span class="plan-ex-out-label">Not for me</span><span class="plan-ex-out-help" id="${row.id}-out-help">Keep this move out of all your sessions</span></button>
        </div>`;
}

/** Swap and Easier as a pair, then ⋯ opening "Not for me". */
function actionsHtml(item: PreviewItem, day: PlanDayView): string {
  const row = rowLabel(item, day);
  const swapping = day.swapSlotId === item.slotId;
  const swapLabel = escapeHtml(`Swap: ${row.name}`);
  return `
      <div class="plan-ex-actions">
        <button type="button" class="plan-ex-swap" data-swap aria-pressed="${swapping}" aria-label="${swapLabel}">Swap</button>
        ${easierHtml(row, day.easierSlotIds.includes(item.slotId))}
        ${moreMenuHtml(row)}
      </div>`;
}

/** After "Not for me": what happened, and Undo, in place of the action line. */
function undoHtml(notice: PlanUndoNotice, day: PlanDayView): string {
  return `
      <div class="plan-ex-undo">
        <p class="plan-ex-status" role="status" data-plan-undo-status>${escapeHtml(notice.message)}</p>
        <button type="button" class="plan-ex-undo-btn" data-undo aria-label="${escapeHtml(`Undo: ${notice.name}, ${whenLabel(day.index)}`)}">Undo</button>
      </div>`;
}

function exerciseHtml(item: PreviewItem, day: PlanDayView): string {
  const swapping = day.swapSlotId === item.slotId;
  const open = day.openSlotIds.includes(item.slotId);
  const undo = day.undo?.slotId === item.slotId ? day.undo : undefined;
  const note = item.note ? `<p class="lib-meta plan-ex-note">${escapeHtml(item.note)}</p>` : "";
  return `
    <li class="plan-ex" data-slot="${escapeHtml(item.slotId)}" data-exercise="${escapeHtml(item.exerciseId)}">
      <button type="button" class="plan-ex-main" data-ex-toggle aria-expanded="${open}">
        <strong class="plan-ex-name">${escapeHtml(item.name)}</strong>
        <span class="plan-ex-dose"><span class="nw">${escapeHtml(item.label)} ·</span> <span class="nw">${escapeHtml(item.dose)}</span></span>
      </button>
      ${undo ? undoHtml(undo, day) : actionsHtml(item, day)}
      ${note}
      ${open ? exerciseDetailHtml(item) : ""}
      ${swapping ? swapRowHtml(day.swapOptions) : ""}
    </li>
  `;
}

function makeDayOptionsHtml(options: readonly DayOption[]): string {
  const chips = options.map((option) => optionHtml("make", option)).join("");
  return `<p class="chip-row-label">Make this day</p>
          <div class="row wrap" role="group" aria-label="Make this day">${chips}</div>`;
}

function moveDayControlsHtml(dayIndex: number, total: number, removeAria: string): string {
  const first = dayIndex === 0;
  const last = dayIndex >= total - 1;
  const toEnd =
    first && total > 1 ? actionHtml("later", String(dayIndex), "To the end") : "";
  return `<p class="chip-row-label">Move</p>
          <div class="row" role="group" aria-label="Move this day">
            <button type="button" data-move="up"${disabledIf(first)}>Earlier</button>
            <button type="button" data-move="down"${disabledIf(last)}>Later</button>
            ${toEnd}
            <button type="button" class="plan-day-remove" data-remove aria-label="${removeAria}">Remove</button>
          </div>`;
}

/** Make / Move / Remove — closed by default so an open day fits the first screen (#124). */
function dayEditHtml(day: PlanDayView, total: number, makeOptions: readonly DayOption[]): string {
  const when = whenLabel(day.index);
  const removeAria = escapeHtml(`Remove: ${day.title}, ${when}`);
  return `
        <details class="plan-day-edit">
          <summary>Change or move</summary>
          ${makeDayOptionsHtml(makeOptions)}
          ${moveDayControlsHtml(day.index, total, removeAria)}
        </details>
  `;
}

function dayHtml(day: PlanDayView, total: number, makeOptions: readonly DayOption[]): string {
  const first = day.index === 0;
  return `
    <li class="plan-day-item${first ? " is-today-item" : ""}">
      <span class="plan-drag" data-drag-handle title="Drag to move this day" aria-hidden="true"></span>
      <details class="lib-filters plan-day${first ? " is-today" : ""}" data-day="${day.index}"${day.open ? " open" : ""}>
        <summary>
          <span class="plan-day-when">${whenLabel(day.index)}</span>
          <span class="plan-day-title">${escapeHtml(day.title)}</span>
          <span class="plan-day-time">${escapeHtml(day.duration)}</span>
        </summary>
        <p class="lib-meta plan-day-meta">${escapeHtml(day.meta)}</p>
        <ol class="plan-exercises">${day.items.map((item) => exerciseHtml(item, day)).join("")}</ol>
        ${dayEditHtml(day, total, makeOptions)}
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

function levelPanelHtml(level: PlanPageModel["level"]): string {
  const current = level.options.find((option) => option.id === level.value);
  const active = level.value !== level.options[0]?.id;
  const summary = escapeHtml(active && current ? `Level · ${current.label}` : "Level");
  return `
    <details class="lib-filters" data-plan-level-panel${level.open || active ? " open" : ""}>
      <summary>${summary}</summary>
      ${chipRowHtml("plan-level", "Plan level", level.value, level.options)}
      <p class="lib-meta plan-level-note">Used when you add days or remake a day: moves are picked at this level as a dose default. It can rise from your logged results when enough of your next days are ready. Lower it here yourself — it never lowers a level your results have earned. Days already in the plan keep their moves.</p>
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
  const hasDays = count > 0;
  const status = model.status ? `<p class="plan-status" data-plan-status aria-live="polite">${escapeHtml(model.status)}</p>` : "";
  const raiseNotice = model.raiseNotice
    ? `<p class="plan-status" data-plan-level-raise aria-live="polite">${escapeHtml(model.raiseNotice)} <button type="button" data-plan-level-raise-dismiss>Dismiss</button></p>`
    : "";
  const empty = hasDays
    ? ""
    : `<p class="tagline" data-plan-empty>No days yet. Add an area below to build the first block.</p>`;
  const dayWord = count === 1 ? "day" : "days";
  const countLine = hasDays
    ? `<p class="lib-count">${count} ${dayWord} · open a day to see its exercises, drag ⠿ to reorder</p>`
    : `<p class="lib-count">0 days</p>`;
  return `
    <main class="shell plan">
      <p class="eyebrow">Plan</p>
      <h1>Coming up</h1>
      ${countLine}
      ${empty}
      ${raiseNotice}
      ${status}
      <ol class="plan-days" aria-label="Days coming up">
        ${model.days.map((day) => dayHtml(day, count, model.makeOptions)).join("")}
      </ol>
      ${levelPanelHtml(model.level)}
      ${addPanelHtml({ ...model, addOpen: model.addOpen || !hasDays })}
      <p class="hint">Exercises shown are for a normal morning. A poor night's sleep or a deload week makes the day lighter.</p>
    </main>
  `;
}
