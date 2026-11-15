import type { SessionEvaluation } from "../domain/program";

const OPTIONS: Array<{ id: SessionEvaluation; label: string }> = [
  { id: "easy", label: "Easy" },
  { id: "on_target", label: "On target" },
  { id: "failed", label: "Failed" },
  { id: "wiped", label: "Wiped" },
];

export function renderEvaluationView(
  root: HTMLElement,
  setCount: number,
  onPick: (evaluation: SessionEvaluation) => void,
): void {
  root.innerHTML = `
    <main class="shell">
      <p class="eyebrow">Session</p>
      <h1>How was that?</h1>
      <p class="tagline">${setCount} sets logged. This feeds tomorrow's dose and next-level guesses.</p>
      <div class="row wrap">
        ${OPTIONS.map(
          (option) =>
            `<button type="button" class="cta" data-eval="${option.id}">${option.label}</button>`,
        ).join("")}
      </div>
    </main>
  `;
  root.querySelectorAll<HTMLButtonElement>("[data-eval]").forEach((button) => {
    button.addEventListener("click", () => {
      onPick(button.dataset.eval as SessionEvaluation);
    });
  });
}
