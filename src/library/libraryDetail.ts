import type { SeedExercise } from "../data/seed";
import type { JointHistoryEntry } from "../domain/program";
import { hasProgressionPath } from "../plan/pathPlacement";
import { assessExercise } from "../safety/jointCare";
import { jointLoadsFor } from "../safety/jointLoad";
import { JOINT_LABEL } from "../settings/jointHistory";
import {
  SKILL_TIERS,
  SKILL_TIER_LABELS,
  effectiveLabel,
} from "./skillPresent";
import type { SkillTier } from "../domain/types";
import { toggleHtml } from "./chips";
import { exerciseMetaLine } from "./metaLine";
import { escapeHtml, formatMuscles } from "./present";
import {
  cuesHtml,
  mediaHtml,
  mistakesHtml,
  sourcesHtml,
  stepsHtml,
  summaryHtml,
} from "./detailSections";
import { personalBestHeroHtml, personalBestUnit } from "./personalBest";
import { isTemplateTarget } from "./targets";
import "../styles/exercise.css";

export interface DetailActions {
  onBack: () => void;
  onOpenExercise: (exerciseId: string) => void;
  onDeclareTier?: (exerciseId: string, tier: SkillTier) => void;
  onGeneratePlan?: () => void;
  onAddToPlan?: () => void;
  /** Exclude this move from every session, or restore it. */
  onToggleExcluded?: (exclude: boolean) => void;
}

export interface DetailMemoryView {
  skillTier?: SkillTier;
  declaredTier?: SkillTier;
  bestReps?: number;
}

/** Everything the detail page shows besides the exercise itself; all optional. */
export interface DetailView {
  /** Exercises that are a plan target (shown with a Target badge). */
  targetIds?: ReadonlySet<string>;
  /** Lookup for progression links. */
  catalogueById?: Record<string, SeedExercise>;
  memory?: DetailMemoryView;
  jointHistory?: readonly JointHistoryEntry[];
  planStatus?: string | null;
  /** Short note after a declare raised related family levels. */
  cascadeHint?: string | null;
  /** The user excluded this move ("not for me"). */
  excluded?: boolean;
}

export interface MountLibraryDetailOptions extends DetailView {
  exercise: SeedExercise;
  actions: DetailActions;
}

function wireExcludeToggle(root: HTMLElement, actions: DetailActions, excluded: boolean): void {
  root.querySelector("[data-exclude-toggle]")?.addEventListener("click", () => {
    actions.onToggleExcluded?.(!excluded);
  });
}

export function mountLibraryDetail(
  root: HTMLElement,
  options: MountLibraryDetailOptions,
): void {
  const { exercise, actions, excluded = false } = options;
  root.innerHTML = detailHtml(exercise, options);

  wireExcludeToggle(root, actions, excluded);

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

  root.querySelector("[data-generate-plan]")?.addEventListener("click", () => {
    actions.onGeneratePlan?.();
  });
  root.querySelector("[data-add-to-plan]")?.addEventListener("click", () => {
    actions.onAddToPlan?.();
  });
}

export function detailHtml(exercise: SeedExercise, view: DetailView = {}): string {
  const {
    targetIds = new Set<string>(),
    catalogueById = {},
    memory = {},
    jointHistory = [],
    planStatus = null,
    cascadeHint = null,
    excluded = false,
  } = view;
  const targetBadge = isTemplateTarget(exercise.id, targetIds)
    ? `<p class="lib-badge">Target</p>`
    : "";
  const tier = currentTier(memory);

  return `
    <main class="shell lib-detail">
      <button type="button" class="lib-back" data-lib-back>← Back to list</button>
      ${targetBadge}
      <p class="eyebrow">Exercise</p>
      <h1>${escapeHtml(exercise.name)}</h1>
      <div class="ex-meta">
        <p class="lib-meta">${escapeHtml(exerciseMetaLine(exercise))}</p>
        <p class="lib-meta">Muscles: ${escapeHtml(formatMuscles(exercise.muscles))}</p>
      </div>
      ${personalBestHeroHtml(memory.bestReps, personalBestUnit(exercise))}
      ${mediaRowHtml(exercise)}
      ${summaryHtml(exercise)}
      ${sectionHtml(safetyHtml(exercise, jointHistory, excluded))}
      ${sectionHtml(jointLoadHtml(exercise, jointHistory))}
      ${sectionHtml(stepsHtml(exercise), "ex-steps")}
      ${cuesAndMistakesHtml(exercise)}
      ${standardsHtml(exercise, tier)}
      ${skillPickerHtml(exercise, memory, cascadeHint)}
      <div class="ex-tray">
        ${planActionsHtml(exercise, planStatus)}
        ${chainLinksHtml(exercise, catalogueById)}
        ${excludedHtml(excluded)}
      </div>
      ${sourcesHtml(exercise)}
    </main>
  `;
}

/** The tier the level select shows: declared first, then the logged one. */
function currentTier(memory: DetailMemoryView): SkillTier {
  return memory.declaredTier ?? memory.skillTier ?? "beginner";
}

/** The doodle (or licensed photos) in its own full-width row; its markup is untouched. */
function mediaRowHtml(exercise: SeedExercise): string {
  const media = mediaHtml(exercise);
  return media ? `<div class="ex-media">${media}</div>` : "";
}

/** Wraps one titled block in a section; nothing when the block is empty. */
function sectionHtml(body: string, cls = ""): string {
  if (!body) {
    return "";
  }
  const classes = ["ex-section", cls].filter(Boolean).join(" ");
  return `<section class="${classes}">${body}</section>`;
}

function cuesAndMistakesHtml(exercise: SeedExercise): string {
  const cues = sectionHtml(cuesHtml(exercise));
  const mistakes = sectionHtml(mistakesHtml(exercise));
  return cues || mistakes ? `<div class="ex-pair">${cues}${mistakes}</div>` : "";
}

/** The user's own "not for me" switch: an excluded move is never planned until restored. */
function excludedHtml(excluded: boolean): string {
  const note = excluded
    ? "Excluded: Aurora never plans this move. Untick to restore it."
    : "Tick to keep this move out of all your sessions.";
  return `
    <section class="ex-section ex-exclude">
      <p class="eyebrow">Your sessions</p>
      ${toggleHtml("exclude-toggle", "Not for me", excluded)}
      <p class="hint" data-excluded-note>${note}</p>
    </section>
  `;
}

function planActionsHtml(exercise: SeedExercise, planStatus: string | null): string {
  if (!hasProgressionPath(exercise)) {
    return "";
  }
  return `
    <section class="ex-section">
      <p class="eyebrow">Plan</p>
      <div class="lib-plan-actions">
        <button type="button" class="cta" data-generate-plan>Generate plan</button>
        <button type="button" data-add-to-plan>Add to the plan</button>
      </div>
      <p class="hint">Generate builds a whole day toward this skill. Add inserts your current-level step into an existing day until you outgrow it.</p>
      ${planStatusHtml(planStatus)}
    </section>
  `;
}

function planStatusHtml(planStatus: string | null): string {
  if (!planStatus) {
    return "";
  }
  return `<p class="tagline" data-plan-status>${escapeHtml(planStatus)}</p>`;
}


/** What the joint verdict means for the user's sessions; an excluded move is out regardless. */
function jointLead(avoid: boolean, excluded: boolean): string {
  if (excluded) {
    return "You excluded this move, so Aurora does not plan it.";
  }
  return avoid ? "Aurora skips this move in your sessions." : "Allowed in your sessions, with care.";
}

function bulletItemsHtml(notes: readonly string[]): string {
  return notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("");
}

/**
 * One safety block. With a joint verdict it leads with what that means for
 * the user, then the general notes; otherwise just the general notes.
 */
function safetyHtml(exercise: SeedExercise, history: readonly JointHistoryEntry[], excluded = false): string {
  const verdict = assessExercise(exercise.name, history);
  const general = exercise.cautions ?? [];
  if (verdict.cautions.length === 0) {
    return general.length > 0
      ? `<p class="eyebrow">Safety</p><ul class="lib-cautions">${bulletItemsHtml(general)}</ul>`
      : "";
  }
  const lead = jointLead(verdict.avoid, excluded);
  const generalBlock =
    general.length > 0
      ? `<p class="eyebrow">General safety</p><ul class="cues">${bulletItemsHtml(general)}</ul>`
      : "";
  return `<div class="joint-caution"><p class="eyebrow">For your joints</p><p>${lead}</p><ul class="cues">${bulletItemsHtml(verdict.cautions)}</ul>${generalBlock}</div>`;
}

/** Which joints this move stresses (impersonal), marking the user's own. */
function jointLoadHtml(exercise: SeedExercise, history: readonly JointHistoryEntry[]): string {
  const loads = jointLoadsFor(exercise.name);
  if (loads.length === 0) {
    return "";
  }
  const mine = new Set(history.map((entry) => entry.joint));
  const items = loads
    .map((load) => {
      const you = mine.has(load.joint) ? " (your joint)" : "";
      return `<li><strong>${JOINT_LABEL[load.joint]}${you} · ${load.level}:</strong> ${escapeHtml(load.note)}</li>`;
    })
    .join("");
  return `<p class="eyebrow">Joint load</p><ul class="cues lib-joint-load">${items}</ul>`;
}

function skillPickerHtml(
  exercise: SeedExercise,
  memory: DetailMemoryView,
  cascadeHint: string | null = null,
): string {
  if (!exercise.standards) {
    return "";
  }
  const current = currentTier(memory);
  const options = SKILL_TIERS.map((tier) => {
    const selected = tier === current ? "selected" : "";
    return `<option value="${tier}" ${selected}>${SKILL_TIER_LABELS[tier]}</option>`;
  }).join("");
  const cascade = cascadeHint
    ? `<p class="hint" data-cascade-hint>${escapeHtml(cascadeHint)}</p>`
    : "";
  const levelHint =
    memory.bestReps === undefined
      ? `<p class="hint">Set your starting level; logged sets refine it.</p>`
      : `<p class="hint">Effective level · ${escapeHtml(effectiveLabel(memory.skillTier ?? current))}</p>`;
  return `
    <div class="ex-level">
      <label for="ex-tier" class="eyebrow">Your level</label>
      <select id="ex-tier" data-skill-tier aria-label="Skill tier for ${escapeHtml(exercise.name)}">
        ${options}
      </select>
      ${levelHint}
      ${cascade}
    </div>
  `;
}

/** Full-bleed scale, one column per tier; the user's tier is marked. */
function standardsHtml(exercise: SeedExercise, mine: SkillTier): string {
  if (!exercise.standards) {
    return "";
  }
  const unit = exercise.effort === "hold" ? "<small>s</small>" : "";
  const cells = SKILL_TIERS.map((tier) => {
    const label = `<span>${SKILL_TIER_LABELS[tier]}</span>`;
    const value = `<strong>${exercise.standards![tier]}${unit}</strong>`;
    return tier === mine
      ? `<li class="mine"><span class="you">Your level</span>${label}${value}</li>`
      : `<li>${label}${value}</li>`;
  }).join("");
  return `
    <section class="ex-section ex-standards">
      <p class="eyebrow">Standards</p>
      <ul class="skill-standards">${cells}</ul>
    </section>
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
    <section class="ex-section">
      <p class="eyebrow">Progression</p>
      <div class="lib-chain">${links.join("")}</div>
    </section>
  `;
}

function chainButtonHtml(id: string, name: string, label: string): string {
  return `<button type="button" data-chain-id="${escapeHtml(id)}">${escapeHtml(label)} · ${escapeHtml(name)}</button>`;
}
