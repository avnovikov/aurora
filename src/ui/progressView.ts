import { EXERCISE_GRAPH } from "../data/exerciseGraph";
import { listResolvedTemplates } from "../plan/templates";
import {
  buildCurrentReadiness,
  type CurrentReadinessRow,
} from "../progress/currentReadiness";
import type { HistoryFilter } from "../progress/historyFeed";
import {
  buildLevelProfile,
  type PatternProfileRow,
} from "../progress/levelProfile";
import { isPattern, patternLabel } from "../progress/patternLabels";
import {
  buildWeakLinkBoard,
  type WeakLinkCard,
} from "../progress/weakLinkBoard";
import type { Pattern } from "../domain/types";
import { escapeHtml } from "../library/present";
import { loadMemories } from "../session/history";
import type { AppTab } from "./shell";

export interface ProgressViewOptions {
  onJumpTab?: (tab: AppTab) => void;
  onOpenHistory?: (filter: HistoryFilter) => void;
}

export function renderProgressView(
  root: HTMLElement,
  options: ProgressViewOptions = {},
): void {
  const memories = loadMemories();
  const graph = EXERCISE_GRAPH;
  const templates = listResolvedTemplates();
  const profile = buildLevelProfile({ graph, memories });
  const weak = buildWeakLinkBoard({ graph, memories });
  const readiness = buildCurrentReadiness({ templates, graph, memories });

  root.innerHTML = `
    <main class="shell progress-shell">
      <p class="eyebrow">Progress</p>
      <h1>Where you stand</h1>
      ${profileSection(profile.rows)}
      ${weakSection(weak.cards)}
      ${readinessSection(readiness.rows)}
      <p class="hint">Tap a row to open History for that thread.</p>
    </main>
  `;

  wireTabJumps(root, options.onJumpTab);
  wireHistoryFilters(root, options.onOpenHistory);
}

function wireTabJumps(
  root: HTMLElement,
  onJumpTab: ProgressViewOptions["onJumpTab"],
): void {
  root.querySelectorAll<HTMLButtonElement>("[data-tab-jump]").forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.tabJump as AppTab | undefined;
      if (tab) {
        onJumpTab?.(tab);
      }
    });
  });
}

function wireHistoryFilters(
  root: HTMLElement,
  onOpenHistory: ProgressViewOptions["onOpenHistory"],
): void {
  root.querySelectorAll<HTMLElement>("[data-history-kind]").forEach((el) => {
    el.addEventListener("click", () => {
      if (!onOpenHistory) {
        return;
      }
      onOpenHistory(historyFilterFromElement(el));
    });
  });
}

function historyFilterFromElement(el: HTMLElement): HistoryFilter {
  const kind = el.dataset.historyKind;
  if (kind === "exercise") {
    const exerciseId = el.dataset.historyExercise;
    assertNonEmpty(exerciseId, "data-history-exercise");
    return { kind: "exercise", exerciseId };
  }
  if (kind === "pattern") {
    const pattern = requirePattern(el.dataset.historyPattern);
    const exerciseIds = (el.dataset.historyIds ?? "")
      .split(",")
      .filter((id) => id.length > 0);
    return { kind: "pattern", pattern, exerciseIds };
  }
  throw new Error(`Unknown data-history-kind: ${kind}`);
}

function requirePattern(value: string | undefined): Pattern {
  assertNonEmpty(value, "data-history-pattern");
  if (!isPattern(value)) {
    throw new Error(`Unknown pattern on history drill-in: ${value}`);
  }
  return value;
}

function assertNonEmpty(
  value: string | undefined,
  label: string,
): asserts value is string {
  if (!value) {
    throw new Error(`Missing ${label} on history drill-in control`);
  }
}

function profileSection(rows: readonly PatternProfileRow[]): string {
  if (rows.length === 0) {
    return emptyProgressCard({
      eyebrow: "Level profile",
      title: "No trained patterns yet",
      hint: "Log sets in a session. Patterns appear here with their own tier.",
      actions: `
        <button type="button" class="cta" data-tab-jump="library">Open Library</button>
        <button type="button" data-tab-jump="today">Open Today</button>
      `,
    });
  }

  const list = rows.map(profileRowHtml).join("");
  return `
    <section class="progress-card">
      <p class="eyebrow">Level profile</p>
      <h2 class="chain-title">By pattern</h2>
      <p class="tagline">Each line is its own tier on novice → elite</p>
      <div class="profile-list">${list}</div>
    </section>
  `;
}

function profileRowHtml(row: PatternProfileRow): string {
  const label = `${patternLabel(row.pattern)} · ${row.tierLabel} ${row.withinPercent}%`;
  const ids = escapeHtml(row.exerciseIds.join(","));
  return `
    <button type="button" class="profile-row" data-history-kind="pattern" data-history-pattern="${escapeHtml(row.pattern)}" data-history-ids="${ids}">
      <span class="profile-row-text">${escapeHtml(label)}</span>
      ${continuumBarHtml(row.continuumPercent, true)}
    </button>
  `;
}

function weakSection(cards: readonly WeakLinkCard[]): string {
  if (cards.length === 0) {
    return emptyProgressCard({
      eyebrow: "Weak-links",
      title: "Nothing lagging yet",
      hint: "When some moves sit below your level average, they show here.",
    });
  }

  const list = cards.map(weakRowHtml).join("");
  return `
    <section class="progress-card">
      <p class="eyebrow">Weak-links</p>
      <h2 class="chain-title">Going worse than the rest</h2>
      <div class="weak-list">${list}</div>
    </section>
  `;
}

function weakRowHtml(card: WeakLinkCard): string {
  return `
    <button type="button" class="weak-row" data-history-kind="exercise" data-history-exercise="${escapeHtml(card.exerciseId)}">
      <span class="weak-row-title">${escapeHtml(card.exerciseName)}</span>
      <span class="hint">${escapeHtml(card.reason)}</span>
    </button>
  `;
}

function readinessSection(rows: readonly CurrentReadinessRow[]): string {
  if (rows.length === 0) {
    return emptyProgressCard({
      eyebrow: "Current readiness",
      title: "No current goals",
      hint: "Set a target on Plan, or train until a next-level dose appears.",
      actions: `
        <button type="button" class="cta" data-tab-jump="plan">Open Plan</button>
      `,
    });
  }

  const list = rows.map(readyRowHtml).join("");
  return `
    <section class="progress-card">
      <p class="eyebrow">Current readiness</p>
      <h2 class="chain-title">What to clear next</h2>
      <div class="ready-list">${list}</div>
    </section>
  `;
}

function readyRowHtml(row: CurrentReadinessRow): string {
  return `
    <button type="button" class="ready-row" data-history-kind="exercise" data-history-exercise="${escapeHtml(row.currentExerciseId)}">
      <span class="ready-row-title">${escapeHtml(row.goalName)} <span class="chip">${row.kind}</span></span>
      <span class="dose">${escapeHtml(doseLine(row))}</span>
      ${continuumBarHtml(row.dosePercent, false)}
      <span class="hint">${escapeHtml(row.criterion)}</span>
    </button>
  `;
}

function doseLine(row: CurrentReadinessRow): string {
  if (row.bestReps === null || row.doseBar === null) {
    return row.currentExerciseName;
  }
  return `${row.currentExerciseName} · ${row.bestReps} / ${row.doseBar}`;
}

function continuumBarHtml(percent: number, showEnds: boolean): string {
  const ends = showEnds
    ? `<span class="continuum-ends"><span>N</span><span>E</span></span>`
    : "";
  return `
    <span class="continuum" aria-hidden="true">
      <span class="continuum-track">
        <span class="continuum-fill" style="width:${percent}%"></span>
      </span>
      ${ends}
    </span>
  `;
}

function emptyProgressCard(input: {
  eyebrow: string;
  title: string;
  hint: string;
  actions?: string;
}): string {
  const actions = input.actions
    ? `<div class="row wrap progress-empty-actions">${input.actions}</div>`
    : "";
  return `
    <section class="progress-card">
      <p class="eyebrow">${input.eyebrow}</p>
      <h2 class="chain-title">${input.title}</h2>
      <p class="hint">${input.hint}</p>
      ${actions}
    </section>
  `;
}

