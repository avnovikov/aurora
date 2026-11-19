import { EXERCISE_GRAPH } from "../data/exerciseGraph";
import { displayNameOf } from "../library/displayName";
import { escapeHtml } from "../library/present";
import type { HistoryFilter } from "../progress/historyFeed";
import {
  historySessionBlocksHtml,
  legacyHistoryBannerHtml,
} from "../progress/historyFeedPresent";
import { buildHistorySessionBlocks } from "../progress/historySessionBlocks";
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
  const model = buildHistorySessionBlocks({
    history: loadHistory(),
    graph: EXERCISE_GRAPH,
    filter,
  });

  root.innerHTML = `
    <main class="shell history-shell">
      <p class="eyebrow">History</p>
      <h1>Sessions</h1>
      ${filterChipHtml(filter, Boolean(options.onClearFilter))}
      ${legacyHistoryBannerHtml(model.hasLegacyOnly, model.blocks.length)}
      ${historySessionBlocksHtml(model.blocks, {
        linkTitles: Boolean(options.onOpenExercise),
        hasLegacyOnly: model.hasLegacyOnly,
      })}
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
    return `<p class="hint">All sessions · exercises rolled up · when</p>`;
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
