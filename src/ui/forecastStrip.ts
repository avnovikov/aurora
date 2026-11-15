import { SEED_GRAPH } from "../data/seed";
import type { SessionTemplate } from "../domain/program";

/**
 * Cool dawn strip: next sessions + target chips; Core days get a spark mark.
 */
export function forecastStripHtml(upcoming: SessionTemplate[]): string {
  if (upcoming.length === 0) {
    return `<div class="forecast"><p class="tagline">Queue empty — add a session in Plan.</p></div>`;
  }
  const cards = upcoming
    .map((template, index) => {
      const core = template.focus === "abs" || templateHitsCore(template);
      const targets = template.targetExerciseIds
        .map((id) => SEED_GRAPH[id]?.name ?? id)
        .join(" · ");
      return `
        <article class="forecast-card ${index === 0 ? "next" : ""} ${core ? "core-spark" : ""}">
          <p class="eyebrow">${index === 0 ? "Next up" : `Then ${index + 1}`}</p>
          <h3>${template.name}</h3>
          <p class="tagline">${targets ? `Target: ${targets}` : "No target set"}</p>
          ${core ? `<p class="spark">Core area loaded</p>` : ""}
        </article>
      `;
    })
    .join("");
  return `<div class="forecast" data-forecast>${cards}</div>`;
}

function templateHitsCore(template: SessionTemplate): boolean {
  return template.slots.some((slot) => {
    const exercise = SEED_GRAPH[slot.exerciseId];
    return exercise?.regions.includes("core") ?? false;
  });
}
