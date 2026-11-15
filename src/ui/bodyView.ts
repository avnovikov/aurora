import { aggregateMuscleLoad, topMuscles, type BodyPeriod } from "../body/aggregate";
import { loadHistory } from "../session/history";

const PERIODS: BodyPeriod[] = ["week", "month", "quarter", "half_year", "year"];

export function renderBodyView(root: HTMLElement): void {
  let period: BodyPeriod = "week";

  const paint = (): void => {
    const loads = aggregateMuscleLoad(loadHistory(), period);
    const top = topMuscles(loads);
    const max = top[0]?.[1] ?? 0;

    root.innerHTML = `
      <main class="shell">
        <p class="eyebrow">Body</p>
        <h1>Muscle load</h1>
        <p class="tagline">How much work landed on each area — sets×sessions on primaries.</p>
        <div class="row wrap">
          ${PERIODS.map(
            (item) =>
              `<button type="button" data-period="${item}" class="${item === period ? "selected" : ""}">${labelPeriod(item)}</button>`,
          ).join("")}
        </div>
        <div class="body-bars">
          ${
            top.length === 0
              ? `<p class="tagline">No history in this period yet, mate.</p>`
              : top
                  .map(([group, score]) => {
                    const width = max === 0 ? 0 : Math.round((score / max) * 100);
                    const core = group === "abdominals" || group === "lower back";
                    return `
                      <div class="body-row ${core ? "core-spark" : ""}">
                        <span>${group}</span>
                        <div class="bar"><i style="width:${width}%"></i></div>
                        <span>${score}</span>
                      </div>`;
                  })
                  .join("")
          }
        </div>
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
