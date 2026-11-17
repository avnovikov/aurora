import { EXERCISE_GRAPH } from "../data/exerciseGraph";
import { displayNameOf } from "../library/displayName";
import { escapeHtml } from "../library/present";
import {
  buildHistoryFeed,
  type HistoryFeedRow,
  type HistoryFilter,
} from "../progress/historyFeed";
import { patternLabel } from "../progress/patternLabels";
import { loadHistory } from "../session/history";

export interface HistoryViewOptions {
  filter?: HistoryFilter;
  onClearFilter?: () => void;
}

export function renderHistoryView(
  root: HTMLElement,
  options: HistoryViewOptions = {},
): void {
  const filter = options.filter ?? { kind: "all" };
  const feed = buildHistoryFeed({
    history: loadHistory(),
    graph: EXERCISE_GRAPH,
    filter,
  });

  root.innerHTML = `
    <main class="shell history-shell">
      <p class="eyebrow">History</p>
      <h1>Logged sets</h1>
      ${filterChipHtml(filter, Boolean(options.onClearFilter))}
      ${legacyBannerHtml(feed.hasLegacyOnly, feed.rows.length)}
      ${bodyHtml(feed.rows, feed.hasLegacyOnly)}
    </main>
  `;

  root.querySelector("[data-clear-filter]")?.addEventListener("click", () => {
    options.onClearFilter?.();
  });
}

function filterChipHtml(filter: HistoryFilter, canClear: boolean): string {
  if (filter.kind === "all") {
    return `<p class="hint">All sessions · exercise · set · reps · when</p>`;
  }

  const label = filterLabel(filter);
  if (canClear) {
    return `<div class="history-filter"><button type="button" class="chip-clear" data-clear-filter>${escapeHtml(label)} ×</button></div>`;
  }
  return `<div class="history-filter"><span class="chip">${escapeHtml(label)}</span></div>`;
}

function filterLabel(filter: Exclude<HistoryFilter, { kind: "all" }>): string {
  if (filter.kind === "exercise") {
    return `Exercise · ${displayNameOf(filter.exerciseId, EXERCISE_GRAPH)}`;
  }
  return `Pattern · ${patternLabel(filter.pattern)}`;
}

function legacyBannerHtml(hasLegacy: boolean, rowCount: number): string {
  if (!hasLegacy || rowCount === 0) {
    return "";
  }
  return `<p class="hint">Some rows are session summaries — per-set reps were not stored yet for those workouts.</p>`;
}

function bodyHtml(
  rows: readonly HistoryFeedRow[],
  hasLegacyOnly: boolean,
): string {
  if (rows.length === 0) {
    const hint = hasLegacyOnly
      ? "Older sessions only stored a summary. New sessions keep each set."
      : "Sets you log in a session appear here.";
    return `
      <section class="progress-empty">
        <p class="tagline">No set detail to show yet.</p>
        <p class="hint">${hint}</p>
      </section>
    `;
  }
  return `<ol class="history-feed">${rows.map(rowHtml).join("")}</ol>`;
}

function rowHtml(row: HistoryFeedRow): string {
  return `
    <li class="history-row">
      <p class="history-ex">${escapeHtml(row.exerciseName)}</p>
      <p class="history-meta">${escapeHtml(rowMeta(row))}</p>
    </li>
  `;
}

function rowMeta(row: HistoryFeedRow): string {
  const when = formatWhen(row.when);
  if (row.kind === "legacy_session") {
    const sets = row.sessionSetCount ?? 0;
    const noun = sets === 1 ? "set" : "sets";
    return `${sets} ${noun} that session (summary) · ${when}`;
  }
  return `Set ${row.setIndex} · ${row.completedReps} / ${row.prescribedReps} · ${when}`;
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
