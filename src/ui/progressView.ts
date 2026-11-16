import { EXERCISE_GRAPH } from "../data/exerciseGraph";
import {
  buildPlanProgress,
  type PlanProgressCard,
  type PathPreviewStep,
} from "../progress/planProgress";
import type { LastResolveSignal } from "../progress/chainMap";
import { listResolvedTemplates } from "../plan/templates";
import { loadSession } from "../session/storage";
import { loadMemories } from "../session/history";
import { personalBestProgressHtml } from "../library/personalBest";
import { escapeHtml } from "../library/present";
import type { AppTab } from "./shell";

const NO_HR_HISTORY_NOTE = "Resting heart rate: no readings yet";

export interface ProgressViewOptions {
  onJumpTab?: (tab: AppTab) => void;
}

export function renderProgressView(
  root: HTMLElement,
  options: ProgressViewOptions = {},
): void {
  const model = buildPlanProgress({
    templates: listResolvedTemplates(),
    graph: EXERCISE_GRAPH,
    memories: loadMemories(),
    lastResolveFor: lastResolveLookup(),
  });

  root.innerHTML = `
    <main class="shell progress-shell">
      <p class="eyebrow">Progress</p>
      <h1>Towards your targets</h1>
      ${bodyHtml(model.cards)}
      <p class="hint">${NO_HR_HISTORY_NOTE}</p>
    </main>
  `;

  root.querySelectorAll<HTMLButtonElement>("[data-tab-jump]").forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.tabJump as AppTab | undefined;
      if (tab) {
        options.onJumpTab?.(tab);
      }
    });
  });
}

function bodyHtml(cards: readonly PlanProgressCard[]): string {
  if (cards.length === 0) {
    return emptyStateHtml();
  }
  return cards.map(cardHtml).join("");
}

function emptyStateHtml(): string {
  return `
    <section class="progress-empty">
      <p class="tagline">Progress tracks the skills you set as targets.</p>
      <p class="hint">Open a skill in Library and choose Generate plan, or set a target in Plan.</p>
      <div class="row wrap progress-empty-actions">
        <button type="button" class="cta" data-tab-jump="library">Open Library</button>
        <button type="button" data-tab-jump="plan">Open Plan</button>
      </div>
    </section>
  `;
}

function cardHtml(card: PlanProgressCard): string {
  const plans = card.templateNames.map(escapeHtml).join(" · ");
  const distance = distanceLine(card);
  return `
    <section class="chain-card progress-card" data-target="${escapeHtml(card.targetId)}">
      <p class="eyebrow">Target · ${plans}</p>
      <h2 class="chain-title">${escapeHtml(card.targetName)}</h2>
      ${distance}
      ${pathPreviewHtml(card.pathPreview)}
      ${exerciseBlockHtml(card)}
    </section>
  `;
}

/** The Now block and its status line, or a pointer when an earlier card already shows that step. */
function exerciseBlockHtml(card: PlanProgressCard): string {
  if (card.nowShownUnder !== undefined) {
    return sharedNowHtml(card, card.nowShownUnder);
  }
  const body =
    card.phase === "active" ? activeBlockHtml(card) : notStartedBlockHtml(card);
  return `${body}${reasonHtml(card)}`;
}

function sharedNowHtml(card: PlanProgressCard, ownerName: string): string {
  const label = card.phase === "active" ? "Now" : "Start";
  return `
    <div class="exercise-block">
      <p class="exercise-next"><span class="exercise-next-label">${label}</span> ${escapeHtml(card.currentName)} · see ${escapeHtml(ownerName)} above</p>
    </div>
  `;
}

/** The status line; at the target a "sessions to move up" count would point past it, so none shows. */
function reasonHtml(card: PlanProgressCard): string {
  if (card.stepsToTarget === 0 && card.status.kind === "hold") {
    return "";
  }
  return `<p class="chain-reason chain-${card.status.kind}">${escapeHtml(card.status.reason)}</p>`;
}

function distanceLine(card: PlanProgressCard): string {
  if (card.stepsToTarget === null) {
    return `<p class="tagline">No progression for this skill yet</p>`;
  }
  if (card.stepsToTarget === 0) {
    return `<p class="tagline">Target reached</p>`;
  }
  const noun = card.stepsToTarget === 1 ? "step" : "steps";
  return `<p class="tagline">${card.stepsToTarget} ${noun} to go</p>`;
}

function notStartedBlockHtml(card: PlanProgressCard): string {
  const next = card.nextName
    ? `<p class="exercise-next"><span class="exercise-next-label">Then</span> ${escapeHtml(card.nextName)}</p>`
    : "";
  return `
    <div class="exercise-block">
      <p class="exercise-current" aria-current="step">${escapeHtml(card.currentName)}</p>
      <p class="hint">Suggested starting point</p>
      ${pathPersonalBestHtml(card)}
      ${next}
    </div>
  `;
}

function activeBlockHtml(card: PlanProgressCard): string {
  // At the target the harder move is beyond it, not the next step toward it.
  const label = card.stepsToTarget === 0 ? "Beyond" : "Next";
  const next = card.nextName
    ? `<p class="exercise-next"><span class="exercise-next-label">${label}</span> ${escapeHtml(card.nextName)}</p>`
    : `<p class="exercise-next is-end">At the top of this path</p>`;
  return `
    <div class="exercise-block">
      <p class="exercise-current" aria-current="step">${escapeHtml(card.currentName)}</p>
      ${pathPersonalBestHtml(card)}
      ${next}
    </div>
  `;
}

function pathPersonalBestHtml(card: PlanProgressCard): string {
  return personalBestProgressHtml(
    card.personalBestReps,
    card.personalBestIsHold ? "s" : "reps",
  );
}

function pathPreviewHtml(steps: readonly PathPreviewStep[]): string {
  if (steps.length === 0) {
    return "";
  }
  const items = steps
    .map((step) => {
      return `<li class="path-step path-${step.marker}">${escapeHtml(step.name)}</li>`;
    })
    .join("");
  return `<ol class="path-preview">${items}</ol>`;
}

/** Reads rule ids for exercises in the last saved session plan. */
function lastResolveLookup(): (
  exerciseId: string,
) => LastResolveSignal | undefined {
  const workItems = loadSession()?.planned.work ?? [];
  return (exerciseId) => {
    const item = workItems.find((work) => work.exerciseId === exerciseId);
    return item ? { ruleIds: item.ruleIds } : undefined;
  };
}
