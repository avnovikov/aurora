import type { Readiness, SleepQuality } from "../domain/types";

const JOINTS = ["hip", "knee", "shoulder", "wrist", "lumbar"] as const;

export interface CheckInHandlers {
  onStart: (readiness: Readiness) => void;
}

export function renderCheckIn(root: HTMLElement, handlers: CheckInHandlers): void {
  let sleep: SleepQuality | undefined;
  const pain = new Set<string>();

  root.innerHTML = `
    <main class="shell check-in">
      <p class="eyebrow">Morning check-in</p>
      <h1>Aurora</h1>
      <p class="soul">Rassvet</p>
      <p class="tagline">How was sleep?</p>
      <div class="row" data-sleep>
        <button type="button" data-sleep-value="good">Good</button>
        <button type="button" data-sleep-value="fair">Fair</button>
        <button type="button" data-sleep-value="poor">Poor</button>
      </div>
      <p class="tagline">Any pain?</p>
      <div class="row wrap" data-pain>
        ${JOINTS.map((joint) => `<button type="button" data-joint="${joint}">${labelJoint(joint)}</button>`).join("")}
      </div>
      <button type="button" class="cta" data-start disabled>Start session</button>
      <p class="hint">Pulse strap optional for this POC. Voice unlocks on Start.</p>
    </main>
  `;

  const startBtn = root.querySelector<HTMLButtonElement>("[data-start]")!;
  root.querySelectorAll<HTMLButtonElement>("[data-sleep-value]").forEach((button) => {
    button.addEventListener("click", () => {
      sleep = button.dataset.sleepValue as SleepQuality;
      root.querySelectorAll("[data-sleep-value]").forEach((el) => el.classList.remove("selected"));
      button.classList.add("selected");
      startBtn.disabled = false;
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-joint]").forEach((button) => {
    button.addEventListener("click", () => {
      const joint = button.dataset.joint!;
      if (pain.has(joint)) {
        pain.delete(joint);
        button.classList.remove("selected");
      } else {
        pain.add(joint);
        button.classList.add("selected");
      }
    });
  });

  startBtn.addEventListener("click", () => {
    if (!sleep) {
      return;
    }
    handlers.onStart({
      sleepQuality: sleep,
      painJoints: [...pain],
    });
  });
}

function labelJoint(joint: string): string {
  return joint.charAt(0).toUpperCase() + joint.slice(1);
}
