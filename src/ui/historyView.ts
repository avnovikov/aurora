import { EXERCISE_GRAPH } from "../data/exerciseGraph";
import { displayNameOf } from "../library/displayName";
import { escapeHtml } from "../library/present";
import type { HistoryFilter } from "../progress/historyFeed";
import { buildHistorySessionBlocks } from "../progress/historySessionBlocks";
import { buildHistoryWeeks } from "../progress/historyWeeks";
import {
  HISTORY_EMPTY_COPY,
  HISTORY_NO_MATCH_COPY,
  historyLede,
  historyWeeksHtml,
} from "../progress/historyWeeksPresent";
import { patternLabel } from "../progress/patternLabels";
import { loadHistory, loadMemories } from "../session/history";

export interface HistoryViewOptions {
  filter?: HistoryFilter;
  onClearFilter?: () => void;
  onOpenExercise?: (exerciseId: string) => void;
  /** Injected for tests; decides which week is "this week". */
  now?: Date;
}

export function renderHistoryView(
  root: HTMLElement,
  options: HistoryViewOptions = {},
): void {
  const filter = options.filter ?? { kind: "all" };
  const model = buildHistorySessionBlocks({
    history: loadHistory(),
    graph: EXERCISE_GRAPH,
    filter,
  });

  const weeks = buildHistoryWeeks({
    blocks: model.blocks,
    memories: loadMemories(),
    ...(options.now ? { now: options.now } : {}),
  });
  const emptyCopy = filter.kind === "all" ? HISTORY_EMPTY_COPY : HISTORY_NO_MATCH_COPY;
  const lede = weeks.weeks.length > 0 ? historyLede(weeks) : emptyCopy;

  root.innerHTML = `
    <main class="shell history-shell">
      <h1 class="history-title">History</h1>
      <p class="history-lede" data-history-lede>${escapeHtml(lede)}</p>
      ${filterChipHtml(filter, Boolean(options.onClearFilter))}
      ${historyWeeksHtml(weeks, { linkExercises: Boolean(options.onOpenExercise) })}
    </main>
  `;

  root.querySelectorAll<HTMLButtonElement>("[data-open-session]").forEach((button) => {
    button.addEventListener("click", () => {
      const sessionId = button.dataset.openSession;
      if (!sessionId) {
        return;
      }
      const card = root.querySelector<HTMLDetailsElement>(
        `details[data-session-id="${CSS.escape(sessionId)}"]`,
      );
      if (!card) {
        return;
      }
      card.open = true;
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      card.scrollIntoView?.({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    });
  });

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
    return "";
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
