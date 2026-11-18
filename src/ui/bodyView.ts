import { aggregateMuscleLoad, maxLoad, topMuscles, type BodyPeriod, type MuscleLoadMap } from "../body/aggregate";
import { formatLoadScore } from "../body/heat";
import { loadHistory } from "../session/history";
import { renderBodyMap } from "./bodyMap";

const PERIODS: BodyPeriod[] = ["week", "month", "quarter", "half_year", "year"];
const LIST_LIMIT = 8;

export function renderBodyView(root: HTMLElement): void {
  let period: BodyPeriod = "week";

  const paint = (): void => {
    const loads = aggregateMuscleLoad(loadHistory(), period);

    root.innerHTML = `
      <main class="shell">
        <p class="eyebrow">Body</p>
        <h1>Muscle load</h1>
        <p class="tagline">Sets per area — primaries count in full, secondaries half, stabilisers a quarter.</p>
        <div class="row wrap">${renderPeriodButtons(period)}</div>
        ${renderBodyMap(loads)}
        ${renderLoadList(loads)}
      </main>
    `;

    root.querySelectorAll<HTMLButtonElement>("[data-period]").forEach((button) => {
      button.addEventListener("click", () => {
        period = button.dataset.period as BodyPeriod;
        paint();
      });
    });
  };

  paint();
}

function renderPeriodButtons(selected: BodyPeriod): string {
  return PERIODS.map(
    (item) =>
      `<button type="button" data-period="${item}" class="${item === selected ? "selected" : ""}">${labelPeriod(item)}</button>`,
  ).join("");
}

function renderLoadList(loads: MuscleLoadMap): string {
  const top = topMuscles(loads, LIST_LIMIT);
  if (top.length === 0) {
    return `<p class="tagline body-empty">No history in this period yet, mate.</p>`;
  }
  const max = maxLoad(loads);
  const rows = top.map(([group, score]) => renderLoadRow(group, score, max)).join("");
  return `<div class="body-bars">${rows}</div>`;
}

function renderLoadRow(group: string, score: number, max: number): string {
  const width = Math.round((score / max) * 100);
  const core = group === "abdominals" || group === "lower back";
  return `
    <div class="body-row ${core ? "core-spark" : ""}">
      <span>${group}</span>
      <div class="bar"><i style="width:${width}%"></i></div>
      <span>${formatLoadScore(score)}</span>
    </div>`;
}

function labelPeriod(period: BodyPeriod): string {
  switch (period) {
    case "week":
      return "Week";
    case "month":
      return "Month";
    case "quarter":
      return "Quarter";
    case "half_year":
      return "Half year";
    case "year":
      return "Year";
  }
}
