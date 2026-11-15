import { PALETTES, applyPalette, isPaletteKey, type Palette } from "../brand/palettes";
import type { EquipmentId } from "../domain/program";
import { escapeHtml } from "../library/present";
import { setChipPressed } from "../library/chips";
import { mountJointHistoryEditor } from "./jointHistoryEditor";
import { loadDeloadActive, saveDeloadActive } from "../settings/deload";
import {
  ALL_EQUIPMENT,
  exportBackupJson,
  loadProfile,
  saveProfile,
} from "../settings/profile";

/** A pick-one palette chip: label, with the meaning as a small second line. */
function paletteChipHtml(palette: Palette, selected: boolean): string {
  return `<button type="button" class="palette-chip${selected ? " selected" : ""}" data-palette-key="${palette.key}" aria-pressed="${selected}"><span class="palette-label">${escapeHtml(palette.label)}</span><small class="palette-meaning">${escapeHtml(palette.meaning)}</small></button>`;
}

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
        <p class="tagline">Palette</p>
        <div class="palette-list" role="group" aria-label="Palette">
          ${PALETTES.map((palette) => paletteChipHtml(palette, palette.key === profile.palette)).join("")}
        </div>
        <p class="tagline">Past joint injuries</p>
        <div data-joint-editor></div>
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

    // Live preview and saved at once; only the palette is written, so other
    // unsaved edits on this page still wait for Save.
    const paletteChips = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-palette-key]"));
    paletteChips.forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.dataset.paletteKey;
        if (!isPaletteKey(key)) return;
        profile.palette = applyPalette(key);
        saveProfile({ ...loadProfile(), palette: profile.palette });
        paletteChips.forEach((chip) => setChipPressed(chip, chip === button));
      });
    });

    mountJointHistoryEditor(
      root.querySelector<HTMLElement>("[data-joint-editor]")!,
      profile.jointHistory,
      (next) => {
        profile.jointHistory = next;
      },
    );

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
