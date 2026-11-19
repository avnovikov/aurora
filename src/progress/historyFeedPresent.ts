import type { HistoryPulse } from "../domain/program";
import { escapeHtml } from "../library/present";
import type { HistoryFeedRow, HistorySessionPulse } from "./historyFeed";

/** Shared History / Library detail list of logged sets. */
export function historyFeedListHtml(
  rows: readonly HistoryFeedRow[],
  options: { linkTitles?: boolean } = {},
): string {
  if (rows.length === 0) {
    return `
      <section class="progress-empty">
        <p class="tagline">No logged sets for this move yet.</p>
        <p class="hint">Sets you log in a session appear here.</p>
      </section>
    `;
  }
  return `<ol class="history-feed">${rows.map((row) => historyFeedRowHtml(row, options)).join("")}</ol>`;
}

/** Compact strap summary for one finished session. */
export function sessionPulseBlockHtml(input: {
  templateName: string;
  completedAt: string;
  pulse: HistoryPulse;
  exerciseNames: Record<string, string>;
}): string {
  const when = formatHistoryWhen(input.completedAt);
  const averages = input.pulse.byExercise
    .map((row) => {
      const name = input.exerciseNames[row.exerciseId] ?? row.exerciseId;
      return `${escapeHtml(name)} · avg ${row.averageBpm}`;
    })
    .join(" · ");
  const seriesText = formatSeriesPreview(input.pulse.series.map((p) => p.bpm));
  return `
    <section class="history-pulse" data-session-pulse>
      <p class="history-ex">${escapeHtml(input.templateName)} · pulse</p>
      <p class="history-meta">${escapeHtml(when)}${averages ? ` · ${averages}` : ""}</p>
      <p class="hint" data-pulse-series>${escapeHtml(seriesText)}</p>
    </section>
  `;
}

export function sessionPulsesHtml(
  sessions: readonly HistorySessionPulse[],
  exerciseNames: Record<string, string>,
): string {
  if (sessions.length === 0) {
    return "";
  }
  return sessions
    .map((session) =>
      sessionPulseBlockHtml({
        templateName: session.templateName,
        completedAt: session.completedAt,
        pulse: session.pulse,
        exerciseNames,
      }),
    )
    .join("");
}

function formatSeriesPreview(bpms: readonly number[]): string {
  if (bpms.length === 0) {
    return "No samples";
  }
  if (bpms.length <= SERIES_PREVIEW_MAX_POINTS) {
    return bpms.join(" · ");
  }
  const sampled = downsampleSeries(bpms, SERIES_PREVIEW_MAX_POINTS);
  return `${sampled.join(" · ")} (${bpms.length} samples)`;
}

const SERIES_PREVIEW_MAX_POINTS = 48;

function downsampleSeries(bpms: readonly number[], maxPoints: number): number[] {
  const step = Math.ceil(bpms.length / maxPoints);
  const sampled: number[] = [];
  for (let i = 0; i < bpms.length; i += step) {
    sampled.push(bpms[i]!);
  }
  const lastBpm = bpms[bpms.length - 1]!;
  if (sampled[sampled.length - 1] !== lastBpm) {
    sampled.push(lastBpm);
  }
  return sampled;
}

export function historyFeedRowHtml(
  row: HistoryFeedRow,
  options: { linkTitles?: boolean } = {},
): string {
  const title = options.linkTitles
    ? `<button type="button" class="history-ex-link" data-open-exercise="${escapeHtml(row.exerciseId)}">${escapeHtml(row.exerciseName)}</button>`
    : `<p class="history-ex">${escapeHtml(row.exerciseName)}</p>`;
  return `
    <li class="history-row">
      ${title}
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
    row.averageBpm !== undefined ? ` · Avg pulse ${row.averageBpm}` : "";
  return `Set ${row.setIndex} · ${row.completedReps} / ${row.prescribedReps}${pulse} · ${when}`;
}

export function formatHistoryWhen(iso: string): string {
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
