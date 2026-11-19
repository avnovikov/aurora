import type { HistoryPulse } from "../domain/program";
import { escapeHtml } from "../library/present";
import { sessionEvaluationLabel } from "../session/history";
import type { HistoryFeedRow, HistorySessionPulse } from "./historyFeed";
import type { HistorySessionBlock } from "./historySessionBlocks";

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

/** History tab: one block per finished session. */
export function historySessionBlocksHtml(
  blocks: readonly HistorySessionBlock[],
  options: { linkTitles?: boolean; hasLegacyOnly?: boolean } = {},
): string {
  if (blocks.length === 0) {
    const hint = options.hasLegacyOnly
      ? "Older sessions only stored a summary. New sessions keep each set."
      : "Finish a session to see it here.";
    return `
      <section class="progress-empty">
        <p class="tagline">No sessions yet.</p>
        <p class="hint">${hint}</p>
      </section>
    `;
  }
  return `<div class="history-sessions">${blocks
    .map((block) => historySessionBlockHtml(block, options))
    .join("")}</div>`;
}

export function historySessionBlockHtml(
  block: HistorySessionBlock,
  options: { linkTitles?: boolean } = {},
): string {
  const when = formatHistoryWhen(block.completedAt);
  const assessment = sessionEvaluationLabel(block.evaluation);
  const header = `${escapeHtml(block.templateName)} · ${escapeHtml(when)} · ${escapeHtml(assessment)}`;
  const body = block.legacy
    ? `<ol class="history-feed">${block.legacyRows
        .map((row) => historyFeedRowHtml(row, options))
        .join("")}</ol>`
    : `<ol class="history-feed">${block.exercises
        .map((exercise) => historyExerciseRollupHtml(exercise, options))
        .join("")}</ol>`;
  const pulse =
    block.pulse && block.pulse.series.length > 0
      ? `<p class="hint" data-pulse-series>${escapeHtml(
          formatSeriesPreview(block.pulse.series.map((p) => p.bpm)),
        )}</p>`
      : "";
  return `
    <section class="history-session" data-session-id="${escapeHtml(block.sessionId)}">
      <p class="history-session-header">${header}</p>
      ${body}
      ${pulse}
    </section>
  `;
}

function historyExerciseRollupHtml(
  exercise: HistorySessionBlock["exercises"][number],
  options: { linkTitles?: boolean },
): string {
  const title = options.linkTitles
    ? `<button type="button" class="history-ex-link" data-open-exercise="${escapeHtml(exercise.exerciseId)}">${escapeHtml(exercise.exerciseName)}</button>`
    : `<p class="history-ex">${escapeHtml(exercise.exerciseName)}</p>`;
  const reps = exercise.completedRepsBySet.join(" / ");
  const pulse =
    exercise.averageBpm !== undefined ? ` · avg ${exercise.averageBpm}` : "";
  return `
    <li class="history-row">
      ${title}
      <p class="history-meta">${escapeHtml(reps)}${escapeHtml(pulse)}</p>
    </li>
  `;
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
