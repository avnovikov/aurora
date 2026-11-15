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
 * a collapsed `<details>` whose summary names what is active, chips inside,
 * and an "All …" chip wherever a single choice can be cleared.
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
  /** Panels the user has opened; an active panel is always open. */
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

function labelOf(options: readonly ChipOption[], id: string): string {
  return options.find((option) => option.id === id)?.label ?? id;
}

function panelHtml(
  id: FilterPanelId,
  title: string,
  activeParts: readonly string[],
  userOpened: boolean,
  body: string,
): string {
  const open = activeParts.length > 0 || userOpened ? " open" : "";
  const detail = activeParts.length > 0 ? ` · ${activeParts.join(", ")}` : "";
  const summary = escapeHtml(`${title}${detail}`);
  return `<details class="lib-filters" data-panel="${id}"${open}><summary>${summary}</summary>${body}</details>`;
}

function showPanelHtml(state: FilterPanelState, hasJointHistory: boolean, opened: boolean): string {
  const parts = [
    state.forJoints ? "my joints" : "",
    state.onlyGear ? "my gear" : "",
    state.stretch === DEFAULT_STRETCH ? "" : labelOf(STRETCH_FILTERS, state.stretch).toLowerCase(),
  ].filter(Boolean);
  const toggles = [
    hasJointHistory ? toggleHtml("for-joints", "For my joints", state.forJoints) : "",
    toggleHtml("only-gear", "Only my gear", state.onlyGear),
  ].join("");
  const body =
    `<p class="chip-row-label">Limit to</p><div class="row wrap">${toggles}</div>` +
    chipRowHtml("stretch", "Stretches", state.stretch, STRETCH_FILTERS, { label: "Stretches" });
  return panelHtml("show", "Show", parts, opened, body);
}

function bodyPanelHtml(state: FilterPanelState, opened: boolean): string {
  const parts = [
    state.area === "all" ? "" : labelOf(AREAS, state.area),
    state.muscle === "all" ? "" : labelOf(MUSCLE_BUCKETS, state.muscle),
  ].filter(Boolean);
  const body =
    chipRowHtml("area", "Body area", state.area, AREAS, { allLabel: "All areas", label: "Area" }) +
    chipRowHtml("muscle", "Primary muscle", state.muscle, MUSCLE_BUCKETS, {
      allLabel: "All muscles",
      label: "Primary muscle",
    });
  return panelHtml("body", "Area & muscle", parts, opened, body);
}

function levelPanelHtml(state: FilterPanelState, opened: boolean): string {
  // No move is ever "novice" (that tier only exists for the athlete), so it would filter to nothing.
  const options = SKILL_TIERS.filter((tier) => tier !== "novice").map((tier) => ({
    id: tier,
    label: SKILL_TIER_LABELS[tier],
  }));
  const parts = state.level === "all" ? [] : [labelOf(options, state.level)];
  const body = chipRowHtml("level", "Skill level", state.level, options, { allLabel: "All levels" });
  return panelHtml("level", "Level", parts, opened, body);
}

export function filterPanelsHtml(state: FilterPanelState, hasJointHistory: boolean): string {
  const opened = (id: FilterPanelId): boolean => state.openPanels.includes(id);
  return [
    showPanelHtml(state, hasJointHistory, opened("show")),
    bodyPanelHtml(state, opened("body")),
    levelPanelHtml(state, opened("level")),
  ].join("");
}

/** "38 exercises", plus a Clear filters button while any filter is active. */
export function resultCountHtml(count: number, filtered: boolean): string {
  const noun = count === 1 ? "exercise" : "exercises";
  const clear = filtered
    ? ` <button type="button" class="lib-link" data-clear-filters>Clear filters</button>`
    : "";
  return `<p class="lib-count" aria-live="polite">${count} ${noun}${clear}</p>`;
}

/** Shown under the search box while stretches are hidden but match the search. */
export function stretchHintHtml(hidden: number): string {
  if (hidden <= 0) {
    return "";
  }
  const noun = hidden === 1 ? "stretch" : "stretches";
  const label = `${hidden} ${noun} match — show`;
  return `<p class="hint">${chipHtml("stretch", "all", label, false, "lib-link")}</p>`;
}
