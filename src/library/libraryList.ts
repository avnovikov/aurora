import type { LoadRegion, SeedExercise } from "../data/seed";
import type { JointHistoryEntry } from "../domain/program";
import { assessExercise } from "../safety/jointCare";
import { SKILL_TIER_LABELS } from "../domain/skillTier";
import { LIBRARY_REGIONS } from "./search";
import { escapeHtml, formatPattern } from "./present";
import { isTemplateTarget } from "./targets";

export interface ListQueryState {
  text: string;
  region: LoadRegion | "all";
  /** Show only prehab moves for the joints in the user's history. */
  forJoints?: boolean;
  /** Hide moves that need gear the user does not have. */
  onlyGear?: boolean;
}

export interface ListActions {
  onSearch: (text: string) => void;
  onRegion: (region: LoadRegion | "all") => void;
  onSelect: (exerciseId: string) => void;
  onForJoints?: (on: boolean) => void;
  onOnlyGear?: (on: boolean) => void;
}

export function mountLibraryList(
  root: HTMLElement,
  results: SeedExercise[],
  targetIds: ReadonlySet<string>,
  query: ListQueryState,
  actions: ListActions,
  jointHistory: readonly JointHistoryEntry[] = [],
): void {
  root.innerHTML = listHtml(results, targetIds, query, jointHistory);

  root.querySelector("[data-for-joints]")?.addEventListener("click", () => {
    actions.onForJoints?.(!query.forJoints);
  });
  root.querySelector("[data-only-gear]")?.addEventListener("click", () => {
    actions.onOnlyGear?.(!query.onlyGear);
  });

  root.querySelector<HTMLInputElement>("[data-search]")?.addEventListener("input", (event) => {
    actions.onSearch((event.target as HTMLInputElement).value);
  });

  root.querySelectorAll<HTMLButtonElement>("[data-region]").forEach((button) => {
    button.addEventListener("click", () => {
      actions.onRegion(button.dataset.region as LoadRegion | "all");
    });
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
  const regions = LIBRARY_REGIONS.map(
    (item) =>
      `<button type="button" data-region="${item}" class="${item === query.region ? "selected" : ""}">${labelRegion(item)}</button>`,
  ).join("");

  const items = results
    .map((exercise) => listItemHtml(exercise, targetIds, jointHistory))
    .join("");
  const forJoints = forJointsButtonHtml(jointHistory.length > 0, query.forJoints === true);

  return `
    <main class="shell">
      <p class="eyebrow">Library</p>
      <h1>Exercises</h1>
      <p class="tagline">Core is an area filter — abs, hollow, anti-extension, and friends.</p>
      <input class="search" type="search" placeholder="Search exercises" value="${escapeHtml(query.text)}" data-search />
      <div class="row wrap" data-regions>
        ${regions}
        ${forJoints}
        <button type="button" data-only-gear class="${query.onlyGear ? "selected" : ""}">Only my gear</button>
      </div>
      <ul class="lib-list">
        ${items}
      </ul>
    </main>
  `;
}

function forJointsButtonHtml(hasHistory: boolean, on: boolean): string {
  if (!hasHistory) {
    return "";
  }
  return `<button type="button" data-for-joints class="${on ? "selected" : ""}">For my joints</button>`;
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