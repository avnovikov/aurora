import { escapeHtml } from "../library/present";
import type { HistoryFeedRow } from "./historyFeed";

/** Shared History / Library detail list of logged sets. */
export function historyFeedListHtml(rows: readonly HistoryFeedRow[]): string {
  if (rows.length === 0) {
    return `
      <section class="progress-empty">
        <p class="tagline">No logged sets for this move yet.</p>
        <p class="hint">Sets you log in a session appear here.</p>
      </section>
    `;
  }
  return `<ol class="history-feed">${rows.map(historyFeedRowHtml).join("")}</ol>`;
}

function historyFeedRowHtml(row: HistoryFeedRow): string {
  return `
    <li class="history-row">
      <p class="history-ex">${escapeHtml(row.exerciseName)}</p>
      <p class="history-meta">${escapeHtml(historyFeedRowMeta(row))}</p>
    </li>
  `;
}

export function historyFeedRowMeta(row: HistoryFeedRow): string {
  const when = formatHistoryWhen(row.when);
  if (row.kind === "legacy_session") {
    const sets = row.sessionSetCount ?? 0;
    const noun = sets === 1 ? "set" : "sets";
    return `${sets} ${noun} that session (summary) · ${when}`;
  }
  const pulse =
    row.averageBpm !== undefined ? ` · ${averageBpmLabel(row.averageBpm)}` : "";
  return `Set ${row.setIndex} · ${row.completedReps} / ${row.prescribedReps}${pulse} · ${when}`;
}

/** Average heart rate on a history row, with its unit (#219). */
export function averageBpmLabel(bpm: number): string {
  return `avg ${bpm} bpm`;
}

function formatHistoryWhen(iso: string): string {
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

export function legacyHistoryBannerHtml(
  hasLegacy: boolean,
  rowCount: number,
): string {
  if (!hasLegacy || rowCount === 0) {
    return "";
  }
  return `<p class="hint">Some rows are session summaries — per-set reps were not stored yet for those workouts.</p>`;
}
