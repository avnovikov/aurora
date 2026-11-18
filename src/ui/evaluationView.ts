import type { SessionEvaluation } from "../domain/program";
import { SESSION_EVALUATION_CHOICES, sessionEvaluationLabel } from "../session/history";

/** Ignore ghost clicks from the session Log/swipe that just finished. */
export const EVALUATION_ARM_MS = 400;

export function renderEvaluationView(
  root: HTMLElement,
  setCount: number,
  onPick: (evaluation: SessionEvaluation) => void,
): void {
  let armed = false;
  let settled = false;

  root.innerHTML = `
    <main class="shell">
      <p class="eyebrow">Session</p>
      <h1>How was that?</h1>
      <p class="tagline">${setCount} sets logged. This feeds tomorrow's dose and next-level guesses.</p>
      <div class="row wrap" data-eval-actions>
        ${SESSION_EVALUATION_CHOICES.map(
          (id) =>
            `<button type="button" class="cta" data-eval="${id}" disabled>${sessionEvaluationLabel(id)}</button>`,
        ).join("")}
      </div>
      <p class="hint" data-eval-wait>Tap when ready — waiting a moment so the last set does not auto-pick.</p>
    </main>
  `;

  const buttons = root.querySelectorAll<HTMLButtonElement>("[data-eval]");
  const waitHint = root.querySelector<HTMLElement>("[data-eval-wait]");

  const arm = (): void => {
    armed = true;
    buttons.forEach((button) => {
      button.disabled = false;
    });
    waitHint?.remove();
  };

  window.setTimeout(arm, EVALUATION_ARM_MS);

  buttons.forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!armed || settled) {
        return;
      }
      const evaluation = button.dataset.eval as SessionEvaluation | undefined;
      if (!evaluation) {
        return;
      }
      settled = true;
      buttons.forEach((item) => {
        item.disabled = true;
      });
      onPick(evaluation);
    });
  });
}
