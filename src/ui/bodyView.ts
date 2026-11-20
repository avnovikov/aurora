import {
  aggregateBodyView,
  isBodyViewMode,
  maxLoad,
  topMuscles,
  type BodyViewMode,
  type MuscleLoadMap,
} from "../body/aggregate";
import { formatLoadScore } from "../body/heat";
import { loadHistory } from "../session/history";
import { renderBodyMap } from "./bodyMap";

const MODES: BodyViewMode[] = ["overall", "month", "quarter", "half_year", "year"];
const LIST_LIMIT = 8;

export function renderBodyView(root: HTMLElement): void {
  let mode: BodyViewMode = "overall";

  const paint = (): void => {
    const loads = aggregateBodyView(loadHistory(), mode);

    root.innerHTML = `
      <main class="shell">
        <p class="eyebrow">Body</p>
        <h1>Muscle load</h1>
        <p class="tagline">${taglineFor(mode)}</p>
        <div class="row wrap">${renderModeButtons(mode)}</div>
        ${renderBodyMap(loads)}
        ${renderLoadList(loads, mode)}
      </main>
    `;

    root.querySelectorAll<HTMLButtonElement>("[data-body-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        const next = button.dataset.bodyMode;
        if (!next || !isBodyViewMode(next)) {
          return;
        }
        mode = next;
        paint();
      });
    });
  };

  paint();
}

function taglineFor(mode: BodyViewMode): string {
  if (mode === "overall") {
    return "Overall — full credit for two weeks, then older sets fade (~85% by seven weeks). Primaries full, secondaries half, stabilisers a quarter.";
  }
  return "Exercise counts per area in this window — each logged move adds one to every muscle it trains.";
}

function renderModeButtons(selected: BodyViewMode): string {
  return MODES.map(
    (item) =>
      `<button type="button" data-body-mode="${item}" class="${item === selected ? "selected" : ""}">${labelMode(item)}</button>`,
  ).join("");
}

function renderLoadList(loads: MuscleLoadMap, mode: BodyViewMode): string {
  const top = topMuscles(loads, LIST_LIMIT);
  if (top.length === 0) {
    return `<p class="tagline body-empty">No history in this view yet, mate.</p>`;
  }
  const peak = maxLoad(loads);
  const rows = top.map(([group, score]) => renderLoadRow(group, score, peak, mode)).join("");
  return `<div class="body-bars">${rows}</div>`;
}

function renderLoadRow(group: string, score: number, peak: number, mode: BodyViewMode): string {
  const width = peak > 0 ? Math.round((score / peak) * 100) : 0;
  const label = mode === "overall" ? formatLoadScore(score) : String(Math.round(score));
  const coreClass = isCoreMuscle(group) ? "core-spark" : "";
  return `
    <div class="body-row ${coreClass}">
      <span>${group}</span>
      <div class="bar"><i style="width:${width}%"></i></div>
      <span>${label}</span>
    </div>`;
}

function isCoreMuscle(group: string): boolean {
  return group === "abdominals" || group === "lower back";
}

function labelMode(mode: BodyViewMode): string {
  switch (mode) {
    case "overall":
      return "Overall";
    case "month":
      return "Month";
    case "quarter":
      return "3 months";
    case "half_year":
      return "Half year";
    case "year":
      return "Year";
  }
}
