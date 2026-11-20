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
import type { TierSuggestion } from "../progress/suggestTiers";
import { RETEST_AFTER_DAYS } from "../progress/levelEvidence";
import type { LevelSourceView } from "./levelSource";
import { toggleHtml } from "./chips";
import { displayExerciseName } from "./displayName";
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
import { scrollViewportToTop } from "./detailScroll";
import { backOnly, wireSwipe } from "../ui/sessionSwipe";
import type { HistoryFeedRow } from "../progress/historyFeed";
import {
  historyFeedListHtml,
  legacyHistoryBannerHtml,
} from "../progress/historyFeedPresent";
import "../styles/exercise.css";

const RETEST_WEEKS = Math.floor(RETEST_AFTER_DAYS / 7);

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
  source?: LevelSourceView;
  suggestion?: TierSuggestion;
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
  inferenceHint?: string | null;
  /** The user excluded this move ("not for me"). */
  excluded?: boolean;
  /** Logged sets for this exercise (same feed as History). */
  loggedSets?: readonly HistoryFeedRow[];
  /** True when any of those rows are legacy session summaries. */
  loggedSetsHaveLegacy?: boolean;
  /** Where Back goes ("History", a move name); default "list" (#219). */
  backLabel?: string;
}

export interface MountLibraryDetailOptions extends DetailView {
  exercise: SeedExercise;
  actions: DetailActions;
  /** When false, keep the current scroll (same-exercise re-paint). Default true. */
  scrollToTop?: boolean;
}

function wireExcludeToggle(root: HTMLElement, actions: DetailActions, excluded: boolean): void {
  root.querySelector("[data-exclude-toggle]")?.addEventListener("click", () => {
    actions.onToggleExcluded?.(!excluded);
  });
}

/** Left-to-right swipe goes Back; any steeper drag is left to scroll. */
function wireBackSwipe(root: HTMLElement, onBack: () => void): void {
  const stage = root.querySelector<HTMLElement>("[data-back-swipe]");
  if (!stage) {
    throw new Error("Library detail missing data-back-swipe stage");
  }
  wireSwipe(stage, onBack, { allow: backOnly });
}

export function mountLibraryDetail(
  root: HTMLElement,
  options: MountLibraryDetailOptions,
): void {
  const { exercise, actions, excluded = false, scrollToTop = true } = options;
  root.innerHTML = detailHtml(exercise, options);
  if (scrollToTop) {
    scrollViewportToTop();
  }

  wireExcludeToggle(root, actions, excluded);
  wireBackSwipe(root, actions.onBack);

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

  root.querySelector<HTMLButtonElement>("[data-accept-suggestion]")?.addEventListener("click", (event) => {
    const tier = (event.currentTarget as HTMLButtonElement).dataset.acceptSuggestion as SkillTier;
    actions.onDeclareTier?.(exercise.id, tier);
  });

  root.querySelector("[data-generate-plan]")?.addEventListener("click", () => {
    actions.onGeneratePlan?.();
  });
  root.querySelector("[data-add-to-plan]")?.addEventListener("click", () => {
    actions.onAddToPlan?.();
  });
}

export function detailHtml(exercise: SeedExercise, view: DetailView = {}): string {
  const resolved = resolveDetailView(view);
  const targetBadge = isTemplateTarget(exercise.id, resolved.targetIds)
    ? `<p class="lib-badge">Target</p>`
    : "";
  const effective = effectiveTier(resolved.memory);

  return `
    <main class="shell lib-detail" data-back-swipe>
      <button type="button" class="lib-back" data-lib-back>← Back to ${escapeHtml(view.backLabel ?? "list")}</button>
      ${targetBadge}
      <p class="eyebrow">Exercise</p>
      <h1>${escapeHtml(displayExerciseName(exercise.name))}</h1>
      <div class="ex-meta">
        <p class="lib-meta">${escapeHtml(exerciseMetaLine(exercise))}</p>
        <p class="lib-meta">Muscles: ${escapeHtml(formatMuscles(exercise.muscles))}</p>
      </div>
      ${personalBestHeroHtml(resolved.memory.bestReps, personalBestUnit(exercise))}
      ${mediaRowHtml(exercise)}
      ${summaryHtml(exercise)}
      ${sectionHtml(safetyHtml(exercise, resolved.jointHistory, resolved.excluded))}
      ${sectionHtml(jointLoadHtml(exercise, resolved.jointHistory))}
      ${sectionHtml(stepsHtml(exercise))}
      ${cuesAndMistakesHtml(exercise)}
      ${standardsHtml(exercise, effective)}
      ${skillPickerHtml(exercise, resolved.memory, resolved.inferenceHint)}
      <div class="ex-tray">
        ${planActionsHtml(exercise, resolved.planStatus)}
        ${chainLinksHtml(exercise, resolved.catalogueById)}
        ${excludedHtml(resolved.excluded)}
      </div>
      ${sourcesHtml(exercise)}
      ${loggedSetsSectionHtml(resolved.loggedSets, resolved.loggedSetsHaveLegacy)}
    </main>
  `;
}

interface ResolvedDetailView {
  targetIds: ReadonlySet<string>;
  catalogueById: Record<string, SeedExercise>;
  memory: DetailMemoryView;
  jointHistory: readonly JointHistoryEntry[];
  planStatus: string | null;
  inferenceHint: string | null;
  excluded: boolean;
  loggedSets: readonly HistoryFeedRow[];
  loggedSetsHaveLegacy: boolean;
}

function resolveDetailView(view: DetailView): ResolvedDetailView {
  return {
    targetIds: view.targetIds ?? new Set<string>(),
    catalogueById: view.catalogueById ?? {},
    memory: view.memory ?? {},
    jointHistory: view.jointHistory ?? [],
    planStatus: view.planStatus ?? null,
    inferenceHint: view.inferenceHint ?? null,
    excluded: view.excluded ?? false,
    loggedSets: view.loggedSets ?? [],
    loggedSetsHaveLegacy: view.loggedSetsHaveLegacy ?? false,
  };
}

function loggedSetsSectionHtml(
  rows: readonly HistoryFeedRow[],
  hasLegacy: boolean,
): string {
  return `
    <section class="ex-section ex-logged-sets">
      <p class="eyebrow">Logged sets</p>
      <h2 class="chain-title">From your sessions</h2>
      ${legacyHistoryBannerHtml(hasLegacy, rows.length)}
      ${historyFeedListHtml(rows)}
    </section>
  `;
}

/** The level select: only the athlete's own pick (#116), never inferred/plan. */
function pickerTier(memory: DetailMemoryView): SkillTier {
  return memory.declaredTier ?? "beginner";
}

/** Effective level for standards mark and the "Effective level" hint. */
function effectiveTier(memory: DetailMemoryView): SkillTier {
  return memory.skillTier ?? memory.declaredTier ?? "beginner";
}

/** True when inferred/plan skill differs from what the picker shows. */
function effectiveDiffersFromPicker(memory: DetailMemoryView): boolean {
  return memory.skillTier !== undefined && memory.skillTier !== memory.declaredTier;
}

function levelHintHtml(memory: DetailMemoryView): string {
  if (effectiveDiffersFromPicker(memory)) {
    return `<p class="hint" data-effective-level>Effective level · ${escapeHtml(effectiveLabel(effectiveTier(memory)))}</p>`;
  }
  if (memory.declaredTier === undefined) {
    return `<p class="hint">Set your starting level; logged sets refine it.</p>`;
  }
  return "";
}

/** The doodle (or licensed photos) in its own full-width row; its markup is untouched. */
function mediaRowHtml(exercise: SeedExercise): string {
  const media = mediaHtml(exercise);
  return media ? `<div class="ex-media">${media}</div>` : "";
}

/** Wraps one titled block in a section; nothing when the block is empty. */
function sectionHtml(body: string): string {
  return body ? `<section class="ex-section">${body}</section>` : "";
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

function levelEvidenceHtml(memory: DetailMemoryView): string {
  const { source, suggestion } = memory;
  const parts: string[] = [];
  if (source?.label) {
    parts.push(`<p class="hint" data-level-source>Level from: ${escapeHtml(source.label)}</p>`);
  }
  if (source?.retest) {
    parts.push(
      `<p class="hint" data-level-retest>No sessions on this for ${RETEST_WEEKS}+ weeks — retest before trusting this level.</p>`,
    );
  }
  if (suggestion) {
    const tier = escapeHtml(suggestion.tier);
    parts.push(
      `<p class="hint" data-level-suggestion>Suggested: ${escapeHtml(SKILL_TIER_LABELS[suggestion.tier])} (${suggestion.testedFamilies} of ${suggestion.totalFamilies} related families tested) <button type="button" class="link" data-accept-suggestion="${tier}">Set</button></p>`,
    );
  }
  return parts.join("\n      ");
}

function skillPickerHtml(
  exercise: SeedExercise,
  memory: DetailMemoryView,
  inferenceHint: string | null = null,
): string {
  if (!exercise.standards) {
    return "";
  }
  const picked = pickerTier(memory);
  const options = SKILL_TIERS.map((tier) => {
    const selected = tier === picked ? "selected" : "";
    return `<option value="${tier}" ${selected}>${SKILL_TIER_LABELS[tier]}</option>`;
  }).join("");
  const hintHtml = inferenceHint
    ? `<p class="hint" data-inference-hint>${escapeHtml(inferenceHint)}</p>`
    : "";
  return `
    <div class="ex-level">
      <label for="ex-tier" class="eyebrow">Your level</label>
      <select id="ex-tier" data-skill-tier aria-label="Skill tier for ${escapeHtml(displayExerciseName(exercise.name))}">
        ${options}
      </select>
      ${levelHintHtml(memory)}
      ${levelEvidenceHtml(memory)}
      ${hintHtml}
    </div>
  `;
}

/** Full-bleed scale, one column per tier; the user's tier is marked. */
function standardsHtml(exercise: SeedExercise, mine: SkillTier): string {
  const standards = exercise.standards;
  if (!standards) {
    return "";
  }
  const unit = exercise.effort === "hold" ? "<small>s</small>" : "";
  const cells = SKILL_TIERS.map((tier) => {
    const label = `<span>${SKILL_TIER_LABELS[tier]}</span>`;
    const value = `<strong>${standards[tier]}${unit}</strong>`;
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
  return `<button type="button" data-chain-id="${escapeHtml(id)}">${escapeHtml(label)} · ${escapeHtml(displayExerciseName(name))}</button>`;
}
