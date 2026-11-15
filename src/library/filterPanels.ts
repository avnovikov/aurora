import { SKILL_TIER_LABELS, SKILL_TIERS } from "../domain/skillTier";
import { chipHtml, chipRowHtml, toggleHtml, type ChipOption } from "./chips";
import {
  AREAS,
  DEFAULT_STRETCH,
  MUSCLE_BUCKETS,
  STRETCH_FILTERS,
  type AreaFilter,
  type MuscleFilter,
  type StretchFilter,
} from "./facets";
import { escapeHtml } from "./present";
import type { LevelFilter } from "./search";

/**
 * The Library's filters live in three panels that look and behave alike:
 * a collapsed `<details>` whose summary shows the panel's current value,
 * chips inside, and an "All …" chip wherever a single choice can be cleared.
 */
export type FilterPanelId = "show" | "body" | "level";

export interface FilterPanelState {
  /** Catalogue difficulty; "all" shows every level. */
  level: LevelFilter;
  /** Upper / lower / core / full body; "all" shows every area. */
  area: AreaFilter;
  /** Rolled-up primary muscle; "all" shows every muscle. */
  muscle: MuscleFilter;
  /** Stretch handling; the Library defaults to hiding stretches. */
  stretch: StretchFilter;
  /** Show only prehab moves for the joints in the user's history. */
  forJoints: boolean;
  /** Hide moves that need gear the user does not have. */
  onlyGear: boolean;
  /** Show only the moves the user excluded ("not for me"), to review or restore them. */
  excludedOnly: boolean;
  /** Panels the user has opened (the summaries already show what is active). */
  openPanels: readonly FilterPanelId[];
}

export type FilterValues = Omit<FilterPanelState, "openPanels">;

/** Every filter's default: the single source for the view, Clear filters and "is anything active". */
export const DEFAULT_FILTERS: Readonly<FilterValues> = {
  level: "all",
  area: "all",
  muscle: "all",
  stretch: DEFAULT_STRETCH,
  forJoints: false,
  onlyGear: false,
  excludedOnly: false,
};

/** True when any filter differs from its default (search text not included). */
export function hasActiveFilters(state: FilterValues): boolean {
  const keys = Object.keys(DEFAULT_FILTERS) as Array<keyof FilterValues>;
  return keys.some((key) => state[key] !== DEFAULT_FILTERS[key]);
}

/** The panels the user has open after one of them is opened or closed. */
export function withPanelState(
  openPanels: readonly FilterPanelId[],
  panel: FilterPanelId,
  open: boolean,
): FilterPanelId[] {
  const others = openPanels.filter((id) => id !== panel);
  return open ? [...others, panel] : others;
}

/** Joins the parts of a trigger's value, e.g. "Upper body · Chest". */
const VALUE_SEPARATOR = " · ";

function labelOf(options: readonly ChipOption[], id: string): string {
  return options.find((option) => option.id === id)?.label ?? id;
}

interface PanelParts {
  id: FilterPanelId;
  title: string;
  /** The panel's current value, shown on the trigger. */
  value: string;
  /** The user opened this panel. */
  opened: boolean;
  /** The chips inside the sheet. */
  body: string;
}

/**
 * One filter panel: the summary is a trigger naming the panel and its current
 * value; the chips sit in a sheet that opens above the dock. Panels share a
 * `name`, so opening one closes the others.
 */
function panelHtml({ id, title, value, opened, body }: PanelParts): string {
  const open = opened ? " open" : "";
  const summary = `<summary><span class="t-label">${escapeHtml(title)}</span><span class="t-val">${escapeHtml(value)}</span></summary>`;
  return `<details class="lib-filters" data-panel="${id}" name="lib-filter"${open}>${summary}<div class="lib-sheet">${body}</div></details>`;
}

/** What the Show panel can offer beyond the fixed choices. */
export interface ShowOptions {
  hasJointHistory: boolean;
  /** The user has excluded at least one move (or is viewing them). */
  hasExcluded: boolean;
}

function showPanelHtml(state: FilterPanelState, options: ShowOptions, opened: boolean): string {
  const value = [
    state.forJoints ? "My joints" : "",
    state.onlyGear ? "My gear" : "",
    state.excludedOnly ? "Excluded by me" : "",
    labelOf(STRETCH_FILTERS, state.stretch),
  ]
    .filter(Boolean)
    .join(VALUE_SEPARATOR);
  const toggles = [
    options.hasJointHistory ? toggleHtml("for-joints", "For my joints", state.forJoints) : "",
    toggleHtml("only-gear", "Only my gear", state.onlyGear),
    options.hasExcluded || state.excludedOnly ? toggleHtml("excluded-only", "Excluded by me", state.excludedOnly) : "",
  ].join("");
  const body =
    `<p class="chip-row-label">Limit to</p><div class="row wrap">${toggles}</div>` +
    chipRowHtml("stretch", "Stretches", state.stretch, STRETCH_FILTERS, { label: "Stretches" });
  return panelHtml({ id: "show", title: "Show", value, opened, body });
}

function bodyPanelHtml(state: FilterPanelState, opened: boolean): string {
  const value = [
    state.area === "all" ? "All areas" : labelOf(AREAS, state.area),
    state.muscle === "all" ? "All muscles" : labelOf(MUSCLE_BUCKETS, state.muscle),
  ].join(VALUE_SEPARATOR);
  const body =
    chipRowHtml("area", "Body area", state.area, AREAS, { allLabel: "All areas", label: "Area" }) +
    chipRowHtml("muscle", "Primary muscle", state.muscle, MUSCLE_BUCKETS, {
      allLabel: "All muscles",
      label: "Primary muscle",
    });
  return panelHtml({ id: "body", title: "Area & muscle", value, opened, body });
}

function levelPanelHtml(state: FilterPanelState, opened: boolean): string {
  // No move is ever "novice" (that tier only exists for the athlete), so it would filter to nothing.
  const options = SKILL_TIERS.filter((tier) => tier !== "novice").map((tier) => ({
    id: tier,
    label: SKILL_TIER_LABELS[tier],
  }));
  const value = state.level === "all" ? "All levels" : labelOf(options, state.level);
  const body = chipRowHtml("level", "Skill level", state.level, options, { allLabel: "All levels" });
  return panelHtml({ id: "level", title: "Level", value, opened, body });
}

export function filterPanelsHtml(state: FilterPanelState, options: ShowOptions): string {
  const opened = (id: FilterPanelId): boolean => state.openPanels.includes(id);
  return [
    showPanelHtml(state, options, opened("show")),
    bodyPanelHtml(state, opened("body")),
    levelPanelHtml(state, opened("level")),
  ].join("");
}

/** "38 exercises", the number set apart as the screen's accent figure. */
export function countHtml(count: number): string {
  const noun = count === 1 ? "exercise" : "exercises";
  return `<p class="lib-count" aria-live="polite"><span class="n">${count}</span> ${noun}</p>`;
}

/** A Clear filters button while any filter is active, else nothing. */
export function clearFiltersHtml(filtered: boolean): string {
  return filtered ? `<button type="button" class="lib-link" data-clear-filters>Clear filters</button>` : "";
}

/** Shown in the dock, under the search box, while stretches are hidden but match the search. */
export function stretchHintHtml(hidden: number): string {
  if (hidden <= 0) {
    return "";
  }
  const noun = hidden === 1 ? "stretch" : "stretches";
  const label = `${hidden} ${noun} match — show`;
  return `<p class="hint">${chipHtml("stretch", "all", label, false, "lib-link")}</p>`;
}
