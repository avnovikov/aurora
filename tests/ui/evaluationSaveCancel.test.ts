/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionEvaluation } from "../../src/domain/program";
import {
  EVALUATION_ARM_MS,
  renderEvaluationView,
  type EvaluationViewHandlers,
} from "../../src/ui/evaluationView";

describe("evaluation save / cancel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("selects a feeling without committing until Save", () => {
    const { root, onSave, onCancel } = mountEvaluation(2);
    armEvaluation();

    clickEval(root, "easy");
    expect(onSave).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();

    const easy = feelingButton(root, "easy");
    expect(easy.getAttribute("aria-pressed")).toBe("true");
    expect(easy.classList.contains("selected")).toBe(true);

    const save = commitButton(root, "save");
    expect(save.disabled).toBe(false);
    save.click();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith("easy" satisfies SessionEvaluation);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("keeps Save disabled until a feeling is selected", () => {
    const { root } = mountEvaluation(1);
    const save = commitButton(root, "save");
    expect(save.disabled).toBe(true);

    armEvaluation();
    expect(save.disabled).toBe(true);

    clickEval(root, "wiped");
    expect(save.disabled).toBe(false);
  });

  it("Cancel closes without saving even after a feeling is selected", () => {
    const { root, onSave, onCancel } = mountEvaluation(4);
    armEvaluation();

    clickEval(root, "difficult");
    commitButton(root, "cancel").click();

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("ignores feeling taps before the arm window", () => {
    const { root, onSave } = mountEvaluation(1);

    clickEval(root, "on_target");
    expect(feelingButton(root, "on_target").getAttribute("aria-pressed")).toBe("false");
    expect(commitButton(root, "save").disabled).toBe(true);
    expect(onSave).not.toHaveBeenCalled();
  });
});

function mountEvaluation(setCount: number): {
  root: HTMLElement;
  onSave: ReturnType<typeof vi.fn>;
  onCancel: ReturnType<typeof vi.fn>;
} {
  const root = document.createElement("div");
  const onSave = vi.fn();
  const onCancel = vi.fn();
  const handlers: EvaluationViewHandlers = { onSave, onCancel };
  renderEvaluationView(root, setCount, handlers);
  return { root, onSave, onCancel };
}

function armEvaluation(): void {
  vi.advanceTimersByTime(EVALUATION_ARM_MS);
}

function feelingButton(root: HTMLElement, id: SessionEvaluation): HTMLButtonElement {
  const button = root.querySelector<HTMLButtonElement>(`[data-eval="${id}"]`);
  expect(button).not.toBeNull();
  return button!;
}

function commitButton(root: HTMLElement, kind: "save" | "cancel"): HTMLButtonElement {
  const button = root.querySelector<HTMLButtonElement>(`[data-eval-${kind}]`);
  expect(button).not.toBeNull();
  return button!;
}

function clickEval(root: HTMLElement, id: SessionEvaluation): void {
  feelingButton(root, id).click();
}