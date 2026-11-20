import { escapeHtml } from "../library/present";
import { averageBpmLabel } from "./historyFeedPresent";
import type {
  EffortLevel,
  HistoryCardExercise,
  HistorySessionCard,
  HistoryWeek,
  HistoryWeekDay,
  HistoryWeeksModel,
} from "./historyWeeks";

export const HISTORY_EMPTY_COPY = "History is empty until the first finished session.";
export const HISTORY_NO_MATCH_COPY = "No finished sessions match this filter.";

const KEY_STEPS: readonly { level: Exclude<EffortLevel, 0>; label: string }[] = [
  { level: 1, label: "Easy" },
  { level: 2, label: "On target" },
  { level: 3, label: "Difficult" },
  { level: 4, label: "Wiped" },
];

/** DOM id of a session card, so a strip day can open and scroll to it. */
export function historyCardId(sessionId: string): string {
  return `history-s-${sessionId}`;
}

/** "6 sessions in 3 weeks". */
export function historyLede(model: HistoryWeeksModel): string {
  const sessions = model.sessionCount;
  const weeks = model.weeks.length;
  return `${sessions} ${sessions === 1 ? "session" : "sessions"} in ${weeks} ${weeks === 1 ? "week" : "weeks"}`;
}

/** History tab body under the filter chip: key, weeks and session cards. */
export function historyWeeksHtml(
  model: HistoryWeeksModel,
  options: { linkExercises?: boolean } = {},
): string {
  if (model.sessionCount === 0) {
    return "";
  }
  let first = true;
  const weeks = model.weeks.map((week) => {
    const html = historyWeekHtml(week, { ...options, openFirst: first });
    first = false;
    return html;
  });
  return `${effortKeyHtml()}${weeks.join("")}`;
}

function effortKeyHtml(): string {
  const steps = KEY_STEPS.map(
    (step) => `<span><b class="effort-mark l${step.level}" aria-hidden="true">${markSteps()}</b>${step.label}</span>`,
  ).join("");
  return `<p class="effort-key" aria-label="Effort key">${steps}</p>`;
}

function markSteps(): string {
  return "<i></i><i></i><i></i><i></i>";
}

function historyWeekHtml(
  week: HistoryWeek,
  options: { linkExercises?: boolean; openFirst: boolean },
): string {
  const label = `${week.label}${week.current ? " · this week" : ""}`;
  const noun = week.count === 1 ? "session" : "sessions";
  const cards = week.sessions
    .map((card, i) =>
      sessionCardHtml(card, {
        linkExercises: Boolean(options.linkExercises),
        open: options.openFirst && i === 0,
      }),
    )
    .join("");
  return `
    <section class="history-week"${week.current ? " data-current" : ""} aria-label="${escapeHtml(week.longLabel)}">
      <p class="history-wk-label">${escapeHtml(label)}</p>
      <p class="history-wk-count"><span class="n">${week.count}</span><span class="u">${noun}</span></p>
      <div class="history-strip">${week.days.map(dayHtml).join("")}</div>
      <div class="history-cards">${cards}</div>
    </section>
  `;
}

function dayHtml(day: HistoryWeekDay): string {
  const trained = day.level > 0 && day.sessionId !== undefined;
  const ariaLabel = escapeHtml(day.longLabel + ": " + (day.effortLabel ?? ""));
  const slot = trained
    ? `<button type="button" class="history-day-btn" data-open-session="${escapeHtml(day.sessionId!)}" aria-label="${ariaLabel}"><span class="effort-mark l${day.level}" aria-hidden="true">${markSteps()}</span></button>`
    : "";
  return `<div class="history-day${trained ? " trained" : ""}"><span class="dl">${escapeHtml(day.label)}</span><span class="slot">${slot}</span></div>`;
}

function sessionCardHtml(
  card: HistorySessionCard,
  options: { linkExercises: boolean; open: boolean },
): string {
  const what = [card.templateName];
  if (card.legacy && card.setsLogged !== undefined) {
    what.push(setsLoggedLabel(card.setsLogged));
  }
  if (card.strapWorn) {
    what.push("strap worn");
  }
  return `
    <details class="history-card" id="${escapeHtml(historyCardId(card.sessionId))}" data-session-id="${escapeHtml(card.sessionId)}"${options.open ? " open" : ""}>
      <summary>
        <div><p class="s-when">${escapeHtml(card.title)}</p><p class="s-what">${escapeHtml(what.join(" · "))}</p></div>
        <span class="s-eff">${escapeHtml(card.effortLabel)}</span><i class="chev" aria-hidden="true"></i>
      </summary>
      <div class="history-exs">
        ${cardIntroHtml(card)}
        ${card.exercises.map((exercise) => exerciseRowHtml(exercise, options.linkExercises)).join("")}
      </div>
    </details>
  `;
}

function cardIntroHtml(card: HistorySessionCard): string {
  if (card.legacy) {
    const count = card.setsLogged !== undefined ? `<b>${escapeHtml(setsLoggedLabel(card.setsLogged))}</b> · ` : "";
    return `<p class="history-sets">${count}<span>per-set reps were not stored for this session</span></p>`;
  }
  return "";
}

function setsLoggedLabel(count: number): string {
  return `${count} ${count === 1 ? "set" : "sets"} logged`;
}

function exerciseRowHtml(exercise: HistoryCardExercise, link: boolean): string {
  const meta: string[] = [];
  if (exercise.averageBpm !== undefined) {
    meta.push(escapeHtml(averageBpmLabel(exercise.averageBpm)));
  }
  if (exercise.newPersonalBest) {
    meta.push(`<b class="history-new-pb" data-new-pb>new PB</b>`);
  } else if (exercise.personalBest !== undefined) {
    meta.push(`<span data-pb>PB ${escapeHtml(String(exercise.personalBest))}</span>`);
  }
  const reps = exercise.reps ? exercise.reps.join(" / ") : "";
  const plain = meta.length === 0 ? " plain" : "";
  const inner = `<span class="n">${escapeHtml(exercise.name)}</span><span class="r">${escapeHtml(reps)}</span>${
    meta.length > 0 ? `<span class="m">${meta.join(" · ")}</span>` : ""
  }`;
  if (!link) {
    return `<div class="history-ex-row${plain}">${inner}</div>`;
  }
  return `<button type="button" class="history-ex-row${plain}" data-open-exercise="${escapeHtml(exercise.exerciseId)}">${inner}<i class="chev" aria-hidden="true"></i></button>`;
}
