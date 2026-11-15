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
  return `<button type="button" data-${attr}="${escapeHtml(value)}" class="${classes}" aria-pressed="${selected}">${escapeHtml(label)}</button>`;
}

/**
 * A button with no value that toggles on and off (`data-attr`). It is marked
 * `data-kind="toggle"` so it can look like a checkbox, not a pick-one chip.
 */
export function toggleHtml(attr: string, label: string, on: boolean): string {
  return `<button type="button" data-${attr} class="${on ? "selected" : ""}" data-kind="toggle" aria-pressed="${on}">${escapeHtml(label)}</button>`;
}

/**
 * A row of single-choice chips. `allLabel` prepends an "all" chip; `label`
 * shows a visible caption above the row.
 */
export function chipRowHtml(
  attr: string,
  ariaLabel: string,
  selected: string,
  options: readonly ChipOption[],
  config: { allLabel?: string; label?: string } = {},
): string {
  const all = config.allLabel ? chipHtml(attr, "all", config.allLabel, selected === "all") : "";
  const chips = options
    .map((option) => chipHtml(attr, option.id, option.label, option.id === selected))
    .join("");
  const caption = config.label ? `<p class="chip-row-label">${escapeHtml(config.label)}</p>` : "";
  return `${caption}<div class="row wrap" role="group" aria-label="${escapeHtml(ariaLabel)}">${all}${chips}</div>`;
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
