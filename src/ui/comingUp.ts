import { EXERCISE_GRAPH } from "../data/exerciseGraph";
import type { SessionTemplate } from "../domain/program";
import { escapeHtml } from "../library/present";
import { templateDurationLabel } from "./formatTemplate";

/** True when the session works the core (an Abs day, or any slot loading the core). */
export function templateHitsCore(template: SessionTemplate): boolean {
  if (template.focus === "abs") {
    return true;
  }
  return template.slots.some((slot) => EXERCISE_GRAPH[slot.exerciseId]?.regions.includes("core") ?? false);
}

/**
 * The sessions after today's, as compact rows. Today's session itself is the
 * Today card, so it is not repeated here.
 */
export function comingUpHtml(upcoming: readonly SessionTemplate[]): string {
  const later = upcoming.slice(1);
  if (upcoming.length === 0) {
    return `<p class="tagline">Queue empty — add a session in Plan.</p>`;
  }
  if (later.length === 0) {
    return "";
  }
  const rows = later
    .map((template, index) => {
      const spark = templateHitsCore(template) ? ` <span class="spark">· core</span>` : "";
      return `<li><span class="coming-up-when">Then ${index + 2}</span><strong>${escapeHtml(template.name)}</strong><span class="coming-up-time">${escapeHtml(templateDurationLabel(template))}</span>${spark}</li>`;
    })
    .join("");
  return `<section class="coming-up" data-forecast aria-label="Coming up"><p class="chip-row-label">Coming up</p><ol>${rows}</ol></section>`;
}
