import { applyPalette, isPaletteKey } from "../brand/palettes";
import type { EquipmentId, UserProfile } from "../domain/program";
import { setChipPressed } from "../library/chips";
import { loadDeloadActive, saveDeloadActive } from "../settings/deload";
import {
  exportBackupJson,
  isValidAddWeight,
  isValidBodyweight,
  loadProfile,
  saveProfile,
} from "../settings/profile";
import { mountJointHistoryEditor } from "./jointHistoryEditor";
import { SETTINGS_TABS, isSettingsTab, settingsPageHtml, type SettingsTab } from "./settingsPage";

/** The tab last open, kept while the app runs. */
let lastTab: SettingsTab = "you";

interface SettingsController {
  root: HTMLElement;
  profile: UserProfile;
  /** Save the profile and say so. */
  commit: (message?: string) => void;
  paint: () => void;
}

/** A number field that saves when it holds a valid value, and says why when it does not. */
function wireNumber(
  { root, commit }: SettingsController,
  attr: string,
  isValid: (kg: number) => boolean,
  apply: (kg: number) => void,
  invalidHint: string,
): void {
  const input = root.querySelector<HTMLInputElement>(`[data-${attr}]`);
  const hint = root.querySelector<HTMLElement>(`[data-${attr}-hint]`);
  if (!input || !hint) {
    return;
  }
  const original = hint.textContent ?? "";
  input.addEventListener("change", () => {
    const kg = Number(input.value);
    if (!isValid(kg)) {
      const status = root.querySelector<HTMLElement>("[data-settings-status]");
      if (status) {
        status.textContent = "";
      }
      hint.textContent = invalidHint;
      hint.classList.add("is-error");
      input.setAttribute("aria-invalid", "true");
      return;
    }
    hint.textContent = original;
    hint.classList.remove("is-error");
    input.removeAttribute("aria-invalid");
    apply(kg);
    commit();
  });
}

function wireTabs({ root, paint }: SettingsController): void {
  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-settings-tab]"));
  const select = (id: string | undefined, focus = false): void => {
    if (!isSettingsTab(id) || id === lastTab) {
      return;
    }
    lastTab = id;
    paint();
    if (focus) {
      root.querySelector<HTMLButtonElement>(`[data-settings-tab="${id}"]`)?.focus();
    }
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => select(tab.dataset.settingsTab));
    tab.addEventListener("keydown", (event) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      if (step) {
        event.preventDefault();
        select(SETTINGS_TABS[(index + step + tabs.length) % tabs.length]!.id, true);
      }
    });
  });
}

function wireYou(controller: SettingsController): void {
  const { root, profile, commit } = controller;
  wireNumber(controller, "bw", isValidBodyweight, (kg) => (profile.bodyweightKg = kg), "Enter 30 kg or more.");
  const editor = root.querySelector<HTMLElement>("[data-joint-editor]");
  if (editor) {
    mountJointHistoryEditor(editor, profile.jointHistory, (next) => {
      profile.jointHistory = next;
      commit();
    });
  }
}

function wireGear(controller: SettingsController): void {
  const { root, profile, commit } = controller;
  root.querySelectorAll<HTMLButtonElement>("[data-eq]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.eq as EquipmentId;
      const has = profile.equipment.includes(id);
      profile.equipment = has ? profile.equipment.filter((item) => item !== id) : [...profile.equipment, id];
      setChipPressed(button, !has);
      commit();
    });
  });
  wireNumber(controller, "add-weight", isValidAddWeight, (kg) => (profile.addWeightKg = kg), "Enter a weight from 0.5 to 100 kg.");
}

function wireTraining({ root, profile, commit }: SettingsController): void {
  root.querySelector<HTMLInputElement>("[data-deload]")?.addEventListener("change", (event) => {
    const on = (event.target as HTMLInputElement).checked;
    saveDeloadActive(on);
    commit(on ? "Deload week on." : "Deload week off.");
  });
  root.querySelector<HTMLInputElement>("[data-mute]")?.addEventListener("change", (event) => {
    profile.voiceMuted = (event.target as HTMLInputElement).checked;
    commit();
  });
}

function wireApp({ root, profile, commit }: SettingsController): void {
  const chips = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-palette-key]"));
  chips.forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.paletteKey;
      if (!isPaletteKey(key)) {
        return;
      }
      profile.palette = applyPalette(key);
      chips.forEach((chip) => setChipPressed(chip, chip === button));
      commit();
    });
  });
  root.querySelector("[data-export]")?.addEventListener("click", () => {
    const out = root.querySelector<HTMLElement>("[data-export-out]")!;
    out.hidden = false;
    out.textContent = exportBackupJson();
  });
}

export function renderSettingsView(root: HTMLElement): void {
  const profile = loadProfile();
  const controller: SettingsController = {
    root,
    profile,
    commit: (message = "Saved.") => {
      saveProfile(profile);
      const status = root.querySelector<HTMLElement>("[data-settings-status]");
      if (status) {
        status.textContent = message;
      }
    },
    paint: () => {
      root.innerHTML = settingsPageHtml({ tab: lastTab, profile, deloadActive: loadDeloadActive() });
      wireTabs(controller);
      wireYou(controller);
      wireGear(controller);
      wireTraining(controller);
      wireApp(controller);
    },
  };
  controller.paint();
}
