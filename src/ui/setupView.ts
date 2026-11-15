import type { JointHistoryEntry } from "../domain/program";
import { loadProfile, saveProfile } from "../settings/profile";
import { mountJointHistoryEditor } from "./jointHistoryEditor";

/** First-run setup: ask about past joint injuries before the first session. */
export function renderSetupView(root: HTMLElement, onDone: () => void): void {
  let entries: JointHistoryEntry[] = loadProfile().jointHistory;
  root.innerHTML = `
    <main class="shell">
      <p class="eyebrow">Aurora · Rassvet · Setup</p>
      <h1>Before we start</h1>
      <p class="tagline">Any joints with a past injury — a dislocation, torn ligament, surgery, or a long-running niggle? Tap each one, then say which side and what happened. I will steer around the risky moves and flag the borderline ones.</p>
      <div data-joint-editor></div>
      <button type="button" class="cta" data-setup-done>Done</button>
      <p class="hint">Nothing to declare? Just tap Done. You can change this later in Settings. This is a training aid, not medical advice.</p>
    </main>
  `;
  mountJointHistoryEditor(
    root.querySelector<HTMLElement>("[data-joint-editor]")!,
    entries,
    (next) => {
      entries = next;
    },
  );
  root.querySelector("[data-setup-done]")?.addEventListener("click", () => {
    saveProfile({ ...loadProfile(), jointHistory: entries, setupDone: true });
    onDone();
  });
}
