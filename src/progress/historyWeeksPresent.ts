import { escapeHtml } from "../library/present";
import { SESSION_EVALUATION_CHOICES, sessionEvaluationLabel } from "../session/history";
import { averageBpmLabel } from "./historyFeedPresent";
import {
  effortLevel,
  type EffortLevel,
  type HistoryCardExercise,
  type HistorySessionCard,
  type HistoryWeek,
  type HistoryWeekDay,
  type HistoryWeeksModel,
} from "./historyWeeks";

export const HISTORY_EMPTY_COPY = "History is empty until the first finished session.";
export const HISTORY_NO_MATCH_COPY = "No finished sessions match this filter.";

const EFFORT_STEPS = SESSION_EVALUATION_CHOICES.map((evaluation) => ({
  level: effortLevel(evaluation),
  label: sessionEvaluationLabel(evaluation),
}));

const EFFORT_KEY_HTML = `<p class="effort-key" aria-label="Effort key">${EFFORT_STEPS.map(
  (step) => `<span>${effortMarkHtml(step.level, "b")}${step.label}</span>`,
).join("")}</p>`;

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function effortMarkHtml(level: EffortLevel, tag: "b" | "span"): string {
  return `<${tag} class="effort-mark l${level}" aria-hidden="true"><i></i><i></i><i></i><i></i></${tag}>`;
}

/** "6 sessions in 3 weeks". */
export function historyLede(model: HistoryWeeksModel): string {
  return `${plural(sessionCount(model), "session")} in ${plural(model.weeks.length, "week")}`;
}

function sessionCount(model: HistoryWeeksModel): number {
  return model.weeks.reduce((total, week) => total + week.sessions.length, 0);
}

/** History tab body under the filter chip: key, weeks and session cards. */
export function historyWeeksHtml(
  model: HistoryWeeksModel,
  options: { linkExercises?: boolean } = {},
): string {
  if (model.weeks.length === 0) {
    return "";
  }
  const weeks = model.weeks.map((week, i) => historyWeekHtml(week, { ...options, openFirst: i === 0 }));
  return `${EFFORT_KEY_HTML}${weeks.join("")}`;
}

function historyWeekHtml(
  week: HistoryWeek,
  options: { linkExercises?: boolean; openFirst: boolean },
): string {
  const label = `${week.label}${week.current ? " · this week" : ""}`;
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
      <p class="history-wk-count"><span class="n">${week.sessions.length}</span><span class="u">${week.sessions.length === 1 ? "session" : "sessions"}</span></p>
      <div class="history-strip">${week.days.map(dayHtml).join("")}</div>
      <div class="history-cards">${cards}</div>
    </section>
  `;
}

function dayHtml(day: HistoryWeekDay): string {
  const trained = day.level > 0 && day.sessionId !== undefined;
  const ariaLabel = escapeHtml(day.longLabel + ": " + (EFFORT_STEPS.find((step) => step.level === day.level)?.label ?? ""));
  const slot = trained
    ? `<button type="button" class="history-day-btn" data-open-session="${escapeHtml(day.sessionId!)}" aria-label="${ariaLabel}">${effortMarkHtml(day.level, "span")}</button>`
    : "";
  return `<div class="history-day${trained ? " trained" : ""}"><span class="dl">${escapeHtml(day.label)}</span><span class="slot">${slot}</span></div>`;
}

function sessionCardHtml(
  card: HistorySessionCard,
  options: { linkExercises: boolean; open: boolean },
): string {
  const what = [card.templateName];
  if (card.setsLogged !== undefined && card.setsLogged > 0) {
    what.push(setsLoggedLabel(card.setsLogged));
  }
  if (card.strapWorn) {
    what.push("strap worn");
  }
  return `
    <details class="history-card" data-session-id="${escapeHtml(card.sessionId)}"${options.open ? " open" : ""}>
      <summary>
        <div><p class="s-when">${escapeHtml(card.title)}</p><p class="s-what">${escapeHtml(what.join(" · "))}</p></div>
        <span class="s-eff">${escapeHtml(sessionEvaluationLabel(card.evaluation))}</span><i class="chev" aria-hidden="true"></i>
      </summary>
      <div class="history-exs">
        ${cardIntroHtml(card)}
        ${card.exercises.map((exercise) => exerciseRowHtml(exercise, options.linkExercises)).join("")}
      </div>
    </details>
  `;
}

function cardIntroHtml(card: HistorySessionCard): string {
  if (card.setsLogged !== undefined) {
    const count = card.setsLogged > 0 ? `<b>${escapeHtml(setsLoggedLabel(card.setsLogged))}</b> · ` : "";
    return `<p class="history-sets">${count}<span>per-set reps were not stored for this session</span></p>`;
  }
  return "";
}

function setsLoggedLabel(count: number): string {
  return `${plural(count, "set")} logged`;
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
