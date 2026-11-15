import "../styles/today.css";
import type { SessionTemplate, WarmupLevel } from "../domain/program";
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
  /** Warm-up level for today's session (unknown → beginner). */
  warmupLevel?: WarmupLevel;
}

/**
 * The front page. The top reads (what you're doing today, how long, toward
 * what); the panel below sits within thumb reach and does the morning job
 * (how you slept, any pain, Start). The rest of the queue and the override
 * sit under it. The check-in is mounted into `[data-checkin]`.
 */
export function todayHomeHtml(model: TodayHomeModel): string {
  const { next } = model;
  const targets = templateTargetsLabel(next.targetExerciseIds, ", ");
  const toward = targets ? `<p class="today-goal">Toward ${escapeHtml(targets)}</p>` : "";
  const core = templateHitsCore(next) ? `<p class="spark">Core area loaded</p>` : "";
  return `
    <main class="shell today">
      <div class="today-card">
        <section class="today-read">
          <header>
            <p class="eyebrow">Aurora · Rassvet</p>
            <h1>Today</h1>
          </header>
          <section class="today-session" aria-labelledby="today-session">
            <div class="today-nextrow">
              <p class="eyebrow">${model.isOverride ? "Today instead" : "Next up"}</p>
              <p class="today-duration">${escapeHtml(templateDurationLabel(next, model.warmupLevel))}</p>
            </div>
            <h2 id="today-session">${escapeHtml(dayTitle(next))}</h2>
            ${toward}
            <p class="today-warmup" data-warmup-preview>${escapeHtml(warmupCooldownLabel(next, model.warmupLevel))}</p>
            ${core}
            ${deloadNoteHtml(model.deloadActive)}
          </section>
        </section>
        <section class="today-act" aria-label="Check-in"><div data-checkin></div></section>
      </div>
      <div class="today-rest">
        ${comingUpHtml(model.upcoming)}
        ${model.overrideHtml}
      </div>
    </main>
  `;
}
