import { SEED_GRAPH, type SeedExercise } from "../data/seed";
import { escapeHtml, formatMuscles, formatPattern } from "./present";
import { isTemplateTarget } from "./targets";

export interface DetailActions {
  onBack: () => void;
  onOpenExercise: (exerciseId: string) => void;
}

export function mountLibraryDetail(
  root: HTMLElement,
  exercise: SeedExercise,
  targetIds: ReadonlySet<string>,
  actions: DetailActions,
): void {
  root.innerHTML = detailHtml(exercise, targetIds);

  root.querySelector<HTMLButtonElement>("[data-lib-back]")?.addEventListener("click", () => {
    actions.onBack();
  });

  root.querySelectorAll<HTMLButtonElement>("[data-chain-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.chainId;
      if (id) {
        actions.onOpenExercise(id);
      }
    });
  });
}

export function detailHtml(
  exercise: SeedExercise,
  targetIds: ReadonlySet<string>,
): string {
  const targetBadge = isTemplateTarget(exercise.id, targetIds)
    ? `<p class="lib-badge">Target</p>`
    : "";
  const media = exercise.doodlePath
    ? `<img class="doodle" src="${escapeHtml(exercise.doodlePath)}" alt="Doodle for ${escapeHtml(exercise.name)}" />`
    : "";
  const cues = exercise.cues
    .map((cue) => `<li>${escapeHtml(cue)}</li>`)
    .join("");
  const chain = chainLinksHtml(exercise);

  return `
    <main class="shell lib-detail">
      <button type="button" class="lib-back" data-lib-back>← Back to list</button>
      ${targetBadge}
      <p class="eyebrow">Exercise</p>
      <h1>${escapeHtml(exercise.name)}</h1>
      <p class="tagline">Pattern: ${escapeHtml(formatPattern(exercise.pattern))}</p>
      <p class="tagline">Muscles: ${escapeHtml(formatMuscles(exercise.muscles))}</p>
      <p class="tagline">Regions: ${escapeHtml(exercise.regions.join(", "))}</p>
      ${media}
      <p class="eyebrow">Cues</p>
      <ul class="cues">${cues}</ul>
      ${chain}
    </main>
  `;
}

function chainLinksHtml(exercise: SeedExercise): string {
  const links: string[] = [];
  if (exercise.easierId) {
    const easier = SEED_GRAPH[exercise.easierId];
    if (easier) {
      links.push(chainButtonHtml(exercise.easierId, easier.name, "Easier"));
    }
  }
  if (exercise.harderId) {
    const harder = SEED_GRAPH[exercise.harderId];
    if (harder) {
      links.push(chainButtonHtml(exercise.harderId, harder.name, "Harder"));
    }
  }
  if (links.length === 0) {
    return "";
  }
  return `
    <p class="eyebrow">Progression</p>
    <div class="row wrap lib-chain">${links.join("")}</div>
  `;
}

function chainButtonHtml(id: string, name: string, label: string): string {
  return `<button type="button" data-chain-id="${escapeHtml(id)}">${escapeHtml(label)} · ${escapeHtml(name)}</button>`;
}