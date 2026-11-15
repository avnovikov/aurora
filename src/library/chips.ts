import { escapeHtml } from "./present";

/** Filter chips: one markup builder and one click wiring for every chip row. */
export interface ChipOption {
  id: string;
  label: string;
}

/** `<button data-attr="value">`, marked selected when `selected`; `extraClass` is appended. */
export function chipHtml(
  attr: string,
  value: string,
  label: string,
  selected: boolean,
  extraClass = "",
): string {
  const classes = [selected ? "selected" : "", extraClass].filter(Boolean).join(" ");
  return `<button type="button" data-${attr}="${escapeHtml(value)}" class="${classes}">${escapeHtml(label)}</button>`;
}

/** A button with no value that toggles on and off (`data-attr`). */
export function toggleHtml(attr: string, label: string, on: boolean): string {
  return `<button type="button" data-${attr} class="${on ? "selected" : ""}">${escapeHtml(label)}</button>`;
}

/**
 * A row of single-choice chips. `allLabel` prepends an "all" chip. The row is
 * tagged `data-<attr>s`.
 */
export function chipRowHtml(
  attr: string,
  ariaLabel: string,
  selected: string,
  options: readonly ChipOption[],
  config: { allLabel?: string } = {},
): string {
  const all = config.allLabel ? chipHtml(attr, "all", config.allLabel, selected === "all") : "";
  const chips = options
    .map((option) => chipHtml(attr, option.id, option.label, option.id === selected))
    .join("");
  return `<div class="row wrap" data-${attr}s aria-label="${escapeHtml(ariaLabel)}">${all}${chips}</div>`;
}

/** Calls `handler` with the chip's value when any `data-<attr>` chip is clicked. */
export function onChipClick(
  root: ParentNode,
  attr: string,
  handler: (value: string) => void,
): void {
  root.querySelectorAll<HTMLElement>(`[data-${attr}]`).forEach((chip) => {
    chip.addEventListener("click", () => handler(chip.getAttribute(`data-${attr}`) ?? ""));
  });
}

/** Calls `handler` when the `data-<attr>` toggle is clicked. */
export function onToggleClick(root: ParentNode, attr: string, handler: () => void): void {
  root.querySelector(`[data-${attr}]`)?.addEventListener("click", handler);
}
