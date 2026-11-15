import type { SeedExercise } from "../data/seed";
import {
  SKILL_TIERS,
  SKILL_TIER_LABELS,
  effectiveLabel,
} from "./skillPresent";
import type { SkillTier } from "../domain/types";
import { escapeHtml, formatMuscles, formatPattern } from "./present";
import {
  cuesHtml,
  mediaHtml,
  mistakesHtml,
  sourcesHtml,
  stepsHtml,
  summaryHtml,
} from "./detailSections";
import { isTemplateTarget } from "./targets";

export interface DetailActions {
  onBack: () => void;
  onOpenExercise: (exerciseId: string) => void;
  onDeclareTier?: (exerciseId: string, tier: SkillTier) => void;
}

export interface DetailMemoryView {
  skillTier?: SkillTier;
  declaredTier?: SkillTier;
  bestReps?: number;
}

export interface MountLibraryDetailOptions {
  exercise: SeedExercise;
  targetIds: ReadonlySet<string>;
  catalogueById: Record<string, SeedExercise>;
  actions: DetailActions;
  memory?: DetailMemoryView;
}

export function mountLibraryDetail(
  root: HTMLElement,
  options: MountLibraryDetailOptions,
): void {
  const {
    exercise,
    targetIds,
    catalogueById,
    actions,
    memory = {},
  } = options;
  root.innerHTML = detailHtml(exercise, targetIds, catalogueById, memory);

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

  root.querySelector<HTMLSelectElement>("[data-skill-tier]")?.addEventListener(
    "change",
    (event) => {
      const tier = (event.target as HTMLSelectElement).value as SkillTier;
      actions.onDeclareTier?.(exercise.id, tier);
    },
  );
}

export function detailHtml(
  exercise: SeedExercise,
  targetIds: ReadonlySet<string>,
  catalogueById: Record<string, SeedExercise> = {},
  memory: DetailMemoryView = {},
): string {
  const targetBadge = isTemplateTarget(exercise.id, targetIds)
    ? `<p class="lib-badge">Target</p>`
    : "";
  const chain = chainLinksHtml(exercise, catalogueById);
  const standards = standardsHtml(exercise);
  const skill = skillPickerHtml(exercise, memory);

  return `
    <main class="shell lib-detail">
      <button type="button" class="lib-back" data-lib-back>← Back to list</button>
      ${targetBadge}
      <p class="eyebrow">Exercise</p>
      <h1>${escapeHtml(exercise.name)}</h1>
      ${levelHtml(exercise)}
      <p class="tagline">Pattern: ${escapeHtml(formatPattern(exercise.pattern))}</p>
      <p class="tagline">Muscles: ${escapeHtml(formatMuscles(exercise.muscles))}</p>
      <p class="tagline">Regions: ${escapeHtml(exercise.regions.join(", "))}</p>
      ${summaryHtml(exercise)}
      ${mediaHtml(exercise)}
      ${cautionsHtml(exercise)}
      ${stepsHtml(exercise)}
      ${cuesHtml(exercise)}
      ${mistakesHtml(exercise)}
      ${skill}
      ${standards}
      ${chain}
      ${sourcesHtml(exercise)}
    </main>
  `;
}

function skillPickerHtml(
  exercise: SeedExercise,
  memory: DetailMemoryView,
): string {
  if (!exercise.standards) {
    return "";
  }
  const current = memory.declaredTier ?? memory.skillTier ?? "beginner";
  const options = SKILL_TIERS.map((tier) => {
    const selected = tier === current ? "selected" : "";
    return `<option value="${tier}" ${selected}>${SKILL_TIER_LABELS[tier]}</option>`;
  }).join("");
  const best = bestRepsHintHtml(exercise, memory, current);
  return `
    <p class="eyebrow">Your level</p>
    <label class="field">
      <span class="visually-hidden">Skill tier</span>
      <select data-skill-tier aria-label="Skill tier for ${escapeHtml(exercise.name)}">
        ${options}
      </select>
    </label>
    ${best}
  `;
}

function bestRepsHintHtml(
  exercise: SeedExercise,
  memory: DetailMemoryView,
  current: SkillTier,
): string {
  if (memory.bestReps === undefined) {
    return `<p class="hint">Set your starting level; logged sets refine it.</p>`;
  }
  const unit = exercise.effort === "hold" ? "s" : " reps";
  const label = effectiveLabel(memory.skillTier ?? current);
  return `<p class="hint">Best logged · ${memory.bestReps}${unit} · ${escapeHtml(label)}</p>`;
}

function levelHtml(exercise: SeedExercise): string {
  if (!exercise.difficulty) {
    return "";
  }
  return `<p class="tagline">Level: ${escapeHtml(SKILL_TIER_LABELS[exercise.difficulty])}</p>`;
}

function cautionsHtml(exercise: SeedExercise): string {
  if (!exercise.cautions?.length) {
    return "";
  }
  const items = exercise.cautions.map((note) => `<li>${escapeHtml(note)}</li>`).join("");
  return `
    <p class="eyebrow">Safety</p>
    <ul class="lib-cautions">${items}</ul>
  `;
}

function standardsHtml(exercise: SeedExercise): string {
  if (!exercise.standards) {
    return "";
  }
  const unit = exercise.effort === "hold" ? "s" : "";
  const cells = SKILL_TIERS.map((tier) => {
    return `<li><span>${SKILL_TIER_LABELS[tier]}</span><strong>${exercise.standards![tier]}${unit}</strong></li>`;
  }).join("");
  return `
    <p class="eyebrow">Standards</p>
    <ul class="skill-standards">${cells}</ul>
  `;
}

function chainLinksHtml(
  exercise: SeedExercise,
  catalogueById: Record<string, SeedExercise>,
): string {
  const links: string[] = [];
  if (exercise.easierId) {
    const easier = catalogueById[exercise.easierId];
    if (easier) {
      links.push(chainButtonHtml(exercise.easierId, easier.name, "Easier"));
    }
  }
  if (exercise.harderId) {
    const harder = catalogueById[exercise.harderId];
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
