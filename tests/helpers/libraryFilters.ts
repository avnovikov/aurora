import type { JointHistoryEntry } from "../../src/domain/program";
import { DEFAULT_FILTERS, type FilterPanelId, type FilterPanelState, type ShowOptions } from "../../src/library/filterPanels";

/** A list query with no search text and every filter at its default. */
export const BASE_QUERY = { text: "", level: "all" as const };

/** Every filter at its default, no panel opened. */
export const PANEL_STATE: FilterPanelState = { ...DEFAULT_FILTERS, openPanels: [] as FilterPanelId[] };

export const SHOW_NONE: ShowOptions = { hasJointHistory: false, hasExcluded: false };
export const SHOW_ALL: ShowOptions = { hasJointHistory: true, hasExcluded: true };

export const KNEE_HISTORY: JointHistoryEntry[] = [{ joint: "knee", side: "both", kind: "other" }];

/** The name and current value a panel's trigger shows (as escaped in the markup). */
export function filterTrigger(html: string, panel: FilterPanelId): { label: string; value: string } {
  const match = new RegExp(
    `data-panel="${panel}"[^>]*><summary[^>]*><span class="t-label">([^<]*)</span><span class="t-val">([^<]*)</span></summary>`,
  ).exec(html);
  if (!match) {
    throw new Error(`No trigger for panel "${panel}"`);
  }
  return { label: match[1]!, value: match[2]! };
}

/** Ids of the panels rendered open, in document order. */
export function openPanelIds(html: string): string[] {
  return [...html.matchAll(/<details[^>]*data-panel="(\w+)"[^>]*\sopen[\s>]/g)].map((m) => m[1]!);
}

/** The text a reader sees: the markup with its tags removed. */
export function textOf(html: string): string {
  // Every "<" opens a tag; keep only what follows that tag's ">".
  return html
    .split("<")
    .map((piece) => piece.slice(piece.indexOf(">") + 1))
    .join("");
}
