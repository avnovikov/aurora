import { EXERCISE_GRAPH } from "../data/exerciseGraph";
import { displayNameOf } from "../library/displayName";
import { escapeHtml } from "../library/present";
import {
  buildHistoryFeed,
  type HistoryFilter,
} from "../progress/historyFeed";
import {
  historyFeedListHtml,
  legacyHistoryBannerHtml,
  sessionPulsesHtml,
} from "../progress/historyFeedPresent";
import { patternLabel } from "../progress/patternLabels";
import { loadHistory } from "../session/history";

export interface HistoryViewOptions {
  filter?: HistoryFilter;
  onClearFilter?: () => void;
  onOpenExercise?: (exerciseId: string) => void;
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
      ${legacyHistoryBannerHtml(feed.hasLegacyOnly, feed.rows.length)}
      ${sessionPulsesHtml(feed.sessionPulses, exerciseNamesFromGraph())}
      ${bodyHtml(feed.rows, feed.hasLegacyOnly, Boolean(options.onOpenExercise))}
    </main>
  `;

  root.querySelector("[data-clear-filter]")?.addEventListener("click", () => {
    options.onClearFilter?.();
  });

  root.querySelectorAll<HTMLButtonElement>("[data-open-exercise]").forEach((button) => {
    button.addEventListener("click", () => {
      const exerciseId = button.dataset.openExercise;
      if (exerciseId) {
        options.onOpenExercise?.(exerciseId);
      }
    });
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

function bodyHtml(
  rows: Parameters<typeof historyFeedListHtml>[0],
  hasLegacyOnly: boolean,
  linkTitles: boolean,
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
  return historyFeedListHtml(rows, { linkTitles });
}

function exerciseNamesFromGraph(): Record<string, string> {
  const names: Record<string, string> = {};
  for (const id of Object.keys(EXERCISE_GRAPH)) {
    names[id] = displayNameOf(id, EXERCISE_GRAPH);
  }
  return names;
}
