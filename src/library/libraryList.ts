import type { LoadRegion, SeedExercise } from "../data/seed";
import type { JointHistoryEntry } from "../domain/program";
import { SKILL_TIER_LABELS, SKILL_TIERS } from "../domain/skillTier";
import { assessExercise } from "../safety/jointCare";
import {
  AREAS,
  MUSCLE_BUCKETS,
  STRETCH_FILTERS,
  type AreaFilter,
  type MuscleFilter,
  type StretchFilter,
} from "./facets";
import { chipHtml, chipRowHtml, onChipClick, onToggleClick, toggleHtml } from "./chips";
import { LIBRARY_REGIONS, type LevelFilter } from "./search";
import { escapeHtml, formatPattern } from "./present";
import { isTemplateTarget } from "./targets";

export interface ListQueryState {
  text: string;
  region: LoadRegion | "all";
  /** Catalogue difficulty; "all" shows every level. */
  level: LevelFilter;
  /** Upper / lower / core / full body; "all" shows every area. */
  area?: AreaFilter;
  /** Rolled-up primary muscle; "all" shows every muscle. */
  muscle?: MuscleFilter;
  /** Stretch handling; the Library defaults to hiding stretches. */
  stretch?: StretchFilter;
  /** Stretches matching the search that are currently hidden. */
  hiddenStretches?: number;
  /** Show only prehab moves for the joints in the user's history. */
  forJoints?: boolean;
  /** Hide moves that need gear the user does not have. */
  onlyGear?: boolean;
}

export interface ListActions {
  onSearch: (text: string) => void;
  onRegion: (region: LoadRegion | "all") => void;
  onLevel: (level: LevelFilter) => void;
  onArea: (area: AreaFilter) => void;
  onMuscle: (muscle: MuscleFilter) => void;
  onStretch: (stretch: StretchFilter) => void;
  onSelect: (exerciseId: string) => void;
  onForJoints: (on: boolean) => void;
  onOnlyGear: (on: boolean) => void;
}

/** Fills every optional field, so the markup and wiring read one complete state. */
function withListDefaults(query: ListQueryState): Required<ListQueryState> {
  return {
    area: "all",
    muscle: "all",
    stretch: "all",
    hiddenStretches: 0,
    forJoints: false,
    onlyGear: false,
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
  onChipClick(root, "region", (value) => actions.onRegion(value as LoadRegion | "all"));
  onChipClick(root, "level", (value) => actions.onLevel(value as LevelFilter));
  onChipClick(root, "area", (value) => actions.onArea(value as AreaFilter));
  onChipClick(root, "muscle", (value) => actions.onMuscle(value as MuscleFilter));
  onChipClick(root, "stretch", (value) => actions.onStretch(value as StretchFilter));

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
  const regions = LIBRARY_REGIONS.map((item) =>
    chipHtml("region", item, labelRegion(item), item === q.region),
  ).join("");
  const items = results
    .map((exercise) => listItemHtml(exercise, targetIds, jointHistory))
    .join("");
  const forJoints = jointHistory.length > 0 ? toggleHtml("for-joints", "For my joints", q.forJoints) : "";

  return `
    <main class="shell">
      <p class="eyebrow">Library</p>
      <h1>Exercises</h1>
      <p class="tagline">Core is an area filter — abs, hollow, anti-extension, and friends.</p>
      <input class="search" type="search" placeholder="Search exercises" value="${escapeHtml(q.text)}" data-search />
      <div class="row wrap" data-regions>
        ${regions}
        ${forJoints}
        ${toggleHtml("only-gear", "Only my gear", q.onlyGear)}
      </div>
      ${levelRowHtml(q.level)}
      ${stretchFilterHtml(q.stretch, q.hiddenStretches)}
      ${bodyFiltersHtml(q.area, q.muscle)}
      <ul class="lib-list">
        ${items}
      </ul>
    </main>
  `;
}

function levelRowHtml(selected: LevelFilter): string {
  const options = SKILL_TIERS.map((tier) => ({ id: tier, label: SKILL_TIER_LABELS[tier] }));
  return chipRowHtml("level", "Skill level", selected, options, {
    allLabel: "All levels",
    rowClass: "lib-levels",
  });
}

function stretchFilterHtml(selected: StretchFilter, hidden: number): string {
  const noun = hidden === 1 ? "stretch" : "stretches";
  const showLabel = `${hidden} ${noun} match — show`;
  const note =
    hidden > 0
      ? `<p class="hint">${chipHtml("stretch", "all", showLabel, false, "lib-link")}</p>`
      : "";
  return `${chipRowHtml("stretch", "Stretches", selected, STRETCH_FILTERS)}${note}`;
}

/** Area and muscle chips live in a panel that opens while either is active. */
function bodyFiltersHtml(area: AreaFilter, muscle: MuscleFilter): string {
  const active = area !== "all" || muscle !== "all";
  return `<details class="lib-filters" ${active ? "open" : ""}>
    <summary>Area &amp; muscle${active ? " (active)" : ""}</summary>
    ${chipRowHtml("area", "Body area", area, AREAS, { allLabel: "All areas" })}
    ${chipRowHtml("muscle", "Primary muscle", muscle, MUSCLE_BUCKETS, { allLabel: "All muscles" })}
  </details>`;
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

function labelRegion(region: LoadRegion | "all"): string {
  if (region === "all") {
    return "All";
  }
  if (region === "core") {
    return "Core";
  }
  return region.charAt(0).toUpperCase() + region.slice(1);
}