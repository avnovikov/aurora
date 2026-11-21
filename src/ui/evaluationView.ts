import type { SessionEvaluation } from "../domain/program";
import {
  isSessionEvaluation,
  SESSION_EVALUATION_CHOICES,
  sessionEvaluationLabel,
} from "../session/history";

/** Ignore ghost clicks from the session Log/swipe that just finished. */
export const EVALUATION_ARM_MS = 400;

export type EvaluationViewHandlers = {
  onSave: (evaluation: SessionEvaluation) => void;
  onCancel: () => void;
};

export function renderEvaluationView(
  root: HTMLElement,
  setCount: number,
  handlers: EvaluationViewHandlers,
): void {
  let armed = false;
  let settled = false;
  let selected: SessionEvaluation | null = null;

  root.innerHTML = evaluationMarkup(setCount);

  const feelingButtons = [...root.querySelectorAll<HTMLButtonElement>("[data-eval]")];
  const saveButton = requireButton(root, "[data-eval-save]");
  const cancelButton = requireButton(root, "[data-eval-cancel]");
  const waitHint = root.querySelector<HTMLElement>("[data-eval-wait]");

  const isInteractive = (): boolean => armed && !settled;

  const syncUi = (): void => {
    for (const button of feelingButtons) {
      const isSelected = button.dataset.eval === selected;
      button.classList.toggle("selected", isSelected);
      button.setAttribute("aria-pressed", isSelected ? "true" : "false");
    }
    saveButton.disabled = !isInteractive() || selected === null;
    cancelButton.disabled = !isInteractive();
  };

  const lockUi = (): void => {
    settled = true;
    for (const button of feelingButtons) {
      button.disabled = true;
    }
    syncUi();
  };

  const arm = (): void => {
    armed = true;
    for (const button of feelingButtons) {
      button.disabled = false;
    }
    waitHint?.remove();
    syncUi();
  };

  window.setTimeout(arm, EVALUATION_ARM_MS);

  for (const button of feelingButtons) {
    onGuardedClick(button, () => {
      if (!isInteractive()) {
        return;
      }
      const feeling = sessionEvaluationFromDataset(button.dataset.eval);
      if (!feeling) {
        return;
      }
      selected = feeling;
      syncUi();
    });
  }

  onGuardedClick(saveButton, () => {
    if (!isInteractive() || selected === null) {
      return;
    }
    lockUi();
    handlers.onSave(selected);
  });

  onGuardedClick(cancelButton, () => {
    if (!isInteractive()) {
      return;
    }
    lockUi();
    handlers.onCancel();
  });
}

function evaluationMarkup(setCount: number): string {
  const feelingButtons = SESSION_EVALUATION_CHOICES.map(
    (id) =>
      `<button type="button" class="cta" data-eval="${id}" aria-pressed="false" disabled>${sessionEvaluationLabel(id)}</button>`,
  ).join("");

  return `
    <main class="shell">
      <p class="eyebrow">Session</p>
      <h1>How was that?</h1>
      <p class="tagline">${setCount} sets logged. This feeds tomorrow's dose and next-level guesses.</p>
      <div class="row wrap" data-eval-actions>
        ${feelingButtons}
      </div>
      <div class="row wrap" data-eval-commit>
        <button type="button" class="cta" data-eval-save disabled>Save</button>
        <button type="button" class="btn-quiet" data-eval-cancel disabled>Cancel</button>
      </div>
      <p class="hint" data-eval-wait>Tap when ready — waiting a moment so the last set does not auto-pick.</p>
    </main>
  `;
}

function sessionEvaluationFromDataset(value: string | undefined): SessionEvaluation | null {
  return value && isSessionEvaluation(value) ? value : null;
}

function requireButton(root: ParentNode, selector: string): HTMLButtonElement {
  const button = root.querySelector<HTMLButtonElement>(selector);
  assert(button !== null, `evaluation view missing ${selector}`);
  return button;
}

function onGuardedClick(button: HTMLButtonElement, handle: () => void): void {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    handle();
  });
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
