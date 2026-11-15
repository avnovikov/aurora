import type { SeedExercise } from "../data/seed";
import type { JointHistoryEntry } from "../domain/program";
import { SKILL_TIER_LABELS } from "../domain/skillTier";
import { assessExercise } from "../safety/jointCare";
import { onChipClick, onToggleClick } from "./chips";
import {
  DEFAULT_STRETCH,
  type AreaFilter,
  type MuscleFilter,
  type StretchFilter,
} from "./facets";
import {
  filterPanelsHtml,
  stretchHintHtml,
  type FilterPanelId,
  type FilterPanelState,
} from "./filterPanels";
import { escapeHtml, formatPattern } from "./present";
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
}

/** Fills every optional field, so the markup and wiring read one complete state. */
function withListDefaults(query: ListQueryState): Required<ListQueryState> {
  return {
    area: "all",
    muscle: "all",
    stretch: DEFAULT_STRETCH,
    hiddenStretches: 0,
    forJoints: false,
    onlyGear: false,
    openPanels: [],
    ...query,
  };
}

export function mountLibraryList(
  root: HTMLElement,
  results: SeedExercise[],
  targetIds: ReadonlySet<string>,
  query: ListQueryState,
  actions: ListActions,
  jointHistory: readonly JointHistoryEntry[] = [],
): void {
  const state = withListDefaults(query);
  root.innerHTML = listHtml(results, targetIds, state, jointHistory);

  onToggleClick(root, "for-joints", () => actions.onForJoints(!state.forJoints));
  onToggleClick(root, "only-gear", () => actions.onOnlyGear(!state.onlyGear));
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
  jointHistory: readonly JointHistoryEntry[] = [],
): string {
  const q = withListDefaults(query);
  const items = results
    .map((exercise) => listItemHtml(exercise, targetIds, jointHistory))
    .join("");

  return `
    <main class="shell">
      <p class="eyebrow">Library</p>
      <h1>Exercises</h1>
      <input class="search" type="search" placeholder="Search exercises" value="${escapeHtml(q.text)}" data-search />
      ${stretchHintHtml(q.hiddenStretches)}
      ${filterPanelsHtml(q, jointHistory.length > 0)}
      <ul class="lib-list">
        ${items}
      </ul>
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
): string {
  const coreClass = exercise.regions.includes("core") ? "core-hit" : "";
  const target = isTemplateTarget(exercise.id, targetIds)
    ? `<span class="lib-badge inline">Target</span> `
    : "";
  return `
    <li class="${coreClass}">
      <button type="button" class="lib-row" data-exercise-id="${escapeHtml(exercise.id)}">
        <strong>${target}${jointBadgeHtml(exercise, history)}${escapeHtml(exercise.name)}</strong>
        <span>${escapeHtml(formatPattern(exercise.pattern))} · ${escapeHtml(exercise.regions.join(", "))}${levelSuffix(exercise)}</span>
        <p class="hint">${escapeHtml(exercise.description ?? exercise.cues[0] ?? "")}</p>
      </button>
    </li>
  `;
}

function levelSuffix(exercise: SeedExercise): string {
  const level = exercise.difficulty ? ` · ${SKILL_TIER_LABELS[exercise.difficulty]}` : "";
  return exercise.requires?.length ? `${level} · needs ${exercise.requires.join(", ")}` : level;
}
