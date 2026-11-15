import type { SeedExercise } from "../data/seed";
import type { JointHistoryEntry } from "../domain/program";
import { assessExercise } from "../safety/jointCare";
import { onChipClick, onToggleClick } from "./chips";
import type { AreaFilter, MuscleFilter, StretchFilter } from "./facets";
import "../styles/library.css";
import {
  clearFiltersHtml,
  countHtml,
  DEFAULT_FILTERS,
  filterPanelsHtml,
  hasActiveFilters,
  stretchHintHtml,
  type FilterPanelId,
  type FilterPanelState,
} from "./filterPanels";
import { exerciseMetaHtml } from "./metaLine";
import { escapeHtml } from "./present";
import type { LevelFilter } from "./search";
import { isTemplateTarget } from "./targets";

/** The search text and filters behind the list; only text and level are required. */
export type ListQueryState = Pick<FilterPanelState, "level"> &
  Partial<Omit<FilterPanelState, "level">> & {
    text: string;
    /** Stretches matching the search that are currently hidden. */
    hiddenStretches?: number;
  };

export interface ListActions {
  onSearch: (text: string) => void;
  onLevel: (level: LevelFilter) => void;
  onArea: (area: AreaFilter) => void;
  onMuscle: (muscle: MuscleFilter) => void;
  onStretch: (stretch: StretchFilter) => void;
  onSelect: (exerciseId: string) => void;
  onForJoints: (on: boolean) => void;
  onOnlyGear: (on: boolean) => void;
  /** A panel was opened or closed by the user (no repaint needed). */
  onPanelToggle: (panel: FilterPanelId, open: boolean) => void;
  /** Reset every filter to its default (search text is kept). */
  onClearFilters: () => void;
  onExcludedOnly: (on: boolean) => void;
}

/** Fills every optional field, so the markup and wiring read one complete state. */
function withListDefaults(query: ListQueryState): Required<ListQueryState> {
  return { ...DEFAULT_FILTERS, hiddenStretches: 0, openPanels: [], ...query };
}

/** Who is looking: decides the joint badges, the Excluded mark and which filters are offered. */
export interface ListViewer {
  jointHistory?: readonly JointHistoryEntry[];
  /** Ids the user excluded ("not for me"). */
  excluded?: ReadonlySet<string>;
}

export interface MountLibraryListOptions extends ListViewer {
  results: SeedExercise[];
  targetIds: ReadonlySet<string>;
  query: ListQueryState;
  actions: ListActions;
}

export function mountLibraryList(root: HTMLElement, options: MountLibraryListOptions): void {
  const { results, targetIds, query, actions } = options;
  const state = withListDefaults(query);
  root.innerHTML = listHtml(results, targetIds, state, options);
  onToggleClick(root, "excluded-only", () => actions.onExcludedOnly(!state.excludedOnly));

  onToggleClick(root, "for-joints", () => actions.onForJoints(!state.forJoints));
  onToggleClick(root, "only-gear", () => actions.onOnlyGear(!state.onlyGear));
  onToggleClick(root, "clear-filters", actions.onClearFilters);
  onChipClick(root, "level", (value) => actions.onLevel(value as LevelFilter));
  onChipClick(root, "area", (value) => actions.onArea(value as AreaFilter));
  onChipClick(root, "muscle", (value) => actions.onMuscle(value as MuscleFilter));
  onChipClick(root, "stretch", (value) => actions.onStretch(value as StretchFilter));

  root.querySelectorAll<HTMLDetailsElement>("details[data-panel]").forEach((panel) => {
    panel.addEventListener("toggle", () =>
      actions.onPanelToggle(panel.dataset.panel as FilterPanelId, panel.open),
    );
  });

  root.querySelector<HTMLInputElement>("[data-search]")?.addEventListener("input", (event) => {
    actions.onSearch((event.target as HTMLInputElement).value);
  });

  root.querySelectorAll<HTMLButtonElement>("[data-exercise-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.exerciseId;
      if (id) {
        actions.onSelect(id);
      }
    });
  });
}

export function focusSearchInput(root: HTMLElement): void {
  const input = root.querySelector<HTMLInputElement>("[data-search]");
  if (!input) {
    return;
  }
  input.focus();
  input.selectionStart = input.selectionEnd = input.value.length;
}

export function listHtml(
  results: SeedExercise[],
  targetIds: ReadonlySet<string>,
  query: ListQueryState,
  viewer: ListViewer = {},
): string {
  const { jointHistory = [], excluded = new Set<string>() } = viewer;
  const q = withListDefaults(query);
  const items = results
    .map((exercise) => listItemHtml(exercise, targetIds, jointHistory, excluded.has(exercise.id)))
    .join("");

  const note = `${stretchHintHtml(q.hiddenStretches)}${clearFiltersHtml(hasActiveFilters(q))}`;

  return `
    <main class="shell library">
      <header class="lib-head">
        <p class="eyebrow">Library</p>
        <div class="lib-titlerow">
          <h1>Exercises</h1>
          ${countHtml(results.length)}
        </div>
      </header>
      <ul class="lib-list">
        ${items}
      </ul>
      <div class="lib-dock">
        <input class="search" type="search" placeholder="Search exercises" aria-label="Search exercises" value="${escapeHtml(q.text)}" data-search />
        ${note ? `<div class="lib-dock-note">${note}</div>` : ""}
        <div class="lib-triggers">
          ${filterPanelsHtml(q, { hasJointHistory: jointHistory.length > 0, hasExcluded: excluded.size > 0 })}
        </div>
      </div>
    </main>
  `;
}

function jointBadgeHtml(exercise: SeedExercise, history: readonly JointHistoryEntry[]): string {
  const verdict = assessExercise(exercise.name, history);
  if (verdict.avoid) {
    return `<span class="lib-badge inline avoid">Skipped for your joints</span> `;
  }
  return verdict.cautions.length > 0
    ? `<span class="lib-badge inline caution">Mind your joints</span> `
    : "";
}

function listItemHtml(
  exercise: SeedExercise,
  targetIds: ReadonlySet<string>,
  history: readonly JointHistoryEntry[],
  isExcluded: boolean,
): string {
  const target = isTemplateTarget(exercise.id, targetIds)
    ? `<span class="lib-badge inline">Target</span> `
    : "";
  // An excluded move is never planned, so the joint badge would only repeat that.
  const badge = isExcluded
    ? `<span class="lib-badge inline avoid">Excluded by you</span> `
    : jointBadgeHtml(exercise, history);
  const description = exercise.description ?? exercise.cues[0] ?? "";
  return `
    <li>
      <button type="button" class="lib-row" data-exercise-id="${escapeHtml(exercise.id)}">
        <strong>${target}${badge}${escapeHtml(exercise.name)}</strong>
        <span class="lib-meta">${exerciseMetaHtml(exercise)}</span>
        <span class="lib-desc">${escapeHtml(description)}</span>
      </button>
    </li>
  `;
}
