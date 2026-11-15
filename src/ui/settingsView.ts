import type { EquipmentId } from "../domain/program";
import { loadDeloadActive, saveDeloadActive } from "../settings/deload";
import {
  ALL_EQUIPMENT,
  exportBackupJson,
  loadProfile,
  saveProfile,
} from "../settings/profile";

export function renderSettingsView(root: HTMLElement): void {
  const profile = loadProfile();

  const paint = (): void => {
    const deloadActive = loadDeloadActive();
    root.innerHTML = `
      <main class="shell">
        <p class="eyebrow">Settings</p>
        <h1>Profile</h1>
        <label class="field">Bodyweight (kg)
          <input type="number" min="30" step="0.5" value="${profile.bodyweightKg}" data-bw />
        </label>
        <p class="tagline">Equipment you have</p>
        <div class="row wrap">
          ${ALL_EQUIPMENT.map(
            (item) =>
              `<button type="button" data-eq="${item}" class="${profile.equipment.includes(item) ? "selected" : ""}">${item}</button>`,
          ).join("")}
        </div>
        <label class="field row">
          <input type="checkbox" data-mute ${profile.voiceMuted ? "checked" : ""} />
          Mute coach voice
        </label>
        <label class="field row">
          <input type="checkbox" data-deload ${deloadActive ? "checked" : ""} />
          Deload week (light dose, no level-ups)
        </label>
        <button type="button" class="cta" data-save>Save</button>
        <button type="button" data-export>Export backup JSON</button>
        <pre class="export" data-export-out hidden></pre>
      </main>
    `;

    root.querySelectorAll<HTMLButtonElement>("[data-eq]").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.dataset.eq as EquipmentId;
        if (profile.equipment.includes(id)) {
          profile.equipment = profile.equipment.filter((item) => item !== id);
        } else {
          profile.equipment = [...profile.equipment, id];
        }
        paint();
      });
    });

    root.querySelector("[data-save]")?.addEventListener("click", () => {
      const bw = root.querySelector<HTMLInputElement>("[data-bw]")!;
      const mute = root.querySelector<HTMLInputElement>("[data-mute]")!;
      profile.bodyweightKg = Number(bw.value);
      profile.voiceMuted = mute.checked;
      saveProfile(profile);
    });

    root.querySelector<HTMLInputElement>("[data-deload]")?.addEventListener(
      "change",
      (event) => saveDeloadActive((event.target as HTMLInputElement).checked),
    );

    root.querySelector("[data-export]")?.addEventListener("click", () => {
      const out = root.querySelector<HTMLElement>("[data-export-out]")!;
      out.hidden = false;
      out.textContent = exportBackupJson();
    });
  };

  paint();
}
