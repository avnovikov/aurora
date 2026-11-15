import type { Readiness, SleepQuality } from "../domain/types";
import { chipHtml, setChipPressed, toggleChipHtml } from "../library/chips";
import { JOINT_LABEL } from "../settings/jointHistory";

const JOINTS = ["hip", "knee", "shoulder", "wrist", "lumbar"] as const;
const SLEEP: ReadonlyArray<{ id: SleepQuality; label: string }> = [
  { id: "good", label: "Good" },
  { id: "fair", label: "Fair" },
  { id: "poor", label: "Poor" },
];

export interface CheckInHandlers {
  onStart: (readiness: Readiness) => void;
}

/**
 * The morning check-in: sleep (required), pain (optional), Start. It sits
 * in the Today panel, so it has no heading or branding of its own.
 */
export function checkInHtml(startLabel: string): string {
  const sleep = SLEEP.map((item) => chipHtml("sleep-value", item.id, item.label, false)).join("");
  const pain = JOINTS.map((joint) => toggleChipHtml("joint", joint, JOINT_LABEL[joint], false)).join("");
  return `
    <div class="check-in">
      <p class="chip-row-label">How did you sleep?</p>
      <div class="today-sleep" role="group" aria-label="How did you sleep?">${sleep}</div>
      <p class="chip-row-label">Any pain today? <span class="optional">Optional</span></p>
      <div class="today-pain" role="group" aria-label="Any pain today?">${pain}</div>
      <button type="button" class="cta today-start" aria-describedby="today-start-hint" data-start disabled>${startLabel}</button>
      <div class="today-hints">
        <p class="hint" id="today-start-hint" data-start-hint>Pick how you slept to start.</p>
        <p class="hint">Starting turns on the coach's voice, so keep the sound up.</p>
      </div>
    </div>
  `;
}

export function renderCheckIn(
  root: HTMLElement,
  handlers: CheckInHandlers,
  startLabel = "Start session",
): void {
  let sleep: SleepQuality | undefined;
  const pain = new Set<string>();
  root.innerHTML = checkInHtml(startLabel);

  const startBtn = root.querySelector<HTMLButtonElement>("[data-start]")!;
  const sleepChips = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-sleep-value]"));
  sleepChips.forEach((button) => {
    button.addEventListener("click", () => {
      sleep = button.dataset.sleepValue as SleepQuality;
      sleepChips.forEach((chip) => setChipPressed(chip, chip === button));
      startBtn.disabled = false;
      root.querySelector("[data-start-hint]")?.remove();
      startBtn.removeAttribute("aria-describedby");
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-joint]").forEach((button) => {
    button.addEventListener("click", () => {
      const joint = button.dataset.joint!;
      const on = !pain.has(joint);
      if (on) {
        pain.add(joint);
      } else {
        pain.delete(joint);
      }
      setChipPressed(button, on);
    });
  });

  startBtn.addEventListener("click", () => {
    if (!sleep) {
      return;
    }
    handlers.onStart({ sleepQuality: sleep, painJoints: [...pain] });
  });
}
