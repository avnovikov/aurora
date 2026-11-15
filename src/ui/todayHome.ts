import type { SessionTemplate } from "../domain/program";
import { escapeHtml } from "../library/present";
import { dayTitle } from "../plan/dayKinds";
import { warmupCooldownLabel } from "../rules/sessionDuration";
import { deloadNoteHtml } from "./deloadNote";
import { comingUpHtml, templateHitsCore } from "./comingUp";
import { templateDurationLabel, templateTargetsLabel } from "./formatTemplate";

export interface TodayHomeModel {
  /** Today's session (the queue head, or the override). */
  next: SessionTemplate;
  /** Today's session replaces the queue head for today only. */
  isOverride: boolean;
  /** Queue preview, today's session first. */
  upcoming: readonly SessionTemplate[];
  deloadActive: boolean;
  /** Markup for the "train something else" panel. */
  overrideHtml: string;
}

/**
 * The front page. One card does the morning job (what you're doing, how you
 * slept, any pain, Start); the rest of the queue and the override sit below
 * it, compact. The check-in is mounted into `[data-checkin]`.
 */
export function todayHomeHtml(model: TodayHomeModel): string {
  const { next } = model;
  const targets = templateTargetsLabel(next.targetExerciseIds, ", ");
  const toward = targets ? `<p class="lib-meta">Toward ${escapeHtml(targets)}</p>` : "";
  const core = templateHitsCore(next) ? `<p class="spark">Core area loaded</p>` : "";
  return `
    <main class="shell today">
      <p class="eyebrow">Aurora · Rassvet</p>
      <h1>Today</h1>
      <section class="today-card" aria-labelledby="today-session">
        <p class="eyebrow">${model.isOverride ? "Today instead" : "Next up"}</p>
        <div class="today-card-head">
          <h2 id="today-session">${escapeHtml(dayTitle(next))}</h2>
          <span class="today-duration">${escapeHtml(templateDurationLabel(next))}</span>
        </div>
        ${toward}
        <p class="lib-meta" data-warmup-preview>${escapeHtml(warmupCooldownLabel(next))}</p>
        ${core}
        ${deloadNoteHtml(model.deloadActive)}
        <div data-checkin></div>
      </section>
      ${comingUpHtml(model.upcoming)}
      ${model.overrideHtml}
    </main>
  `;
}
