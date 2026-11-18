import { applyPalette, isPaletteKey } from "../brand/palettes";
import type { EquipmentId, UserProfile } from "../domain/program";
import { setChipPressed } from "../library/chips";
import { EXERCISE_GRAPH } from "../data/exerciseGraph";
import { clearLevelsToConfirm, loadLevelsToConfirm } from "../session/ensureMemoryMigrated";
import { loadDeloadActive, saveDeloadActive } from "../settings/deload";
import {
  exportBackupJson,
  isValidAddWeight,
  isValidBodyweight,
  isValidMaxHeartRate,
  isValidRestingHeartRate,
  loadProfile,
  MAX_ADD_WEIGHT_KG,
  MAX_MAX_HEART_RATE_BPM,
  MAX_RESTING_HEART_RATE_BPM,
  MIN_ADD_WEIGHT_KG,
  MIN_BODYWEIGHT_KG,
  MIN_MAX_HEART_RATE_BPM,
  MIN_RESTING_HEART_RATE_BPM,
  saveProfile,
} from "../settings/profile";
import { mountJointHistoryEditor } from "./jointHistoryEditor";
import { SETTINGS_TABS, isSettingsTab, settingsPageHtml, type SettingsTab } from "./settingsPage";

const BODYWEIGHT_HINT = `Enter your bodyweight as ${MIN_BODYWEIGHT_KG} kg or more.`;
const ADD_WEIGHT_HINT = `Enter a weight between ${MIN_ADD_WEIGHT_KG} and ${MAX_ADD_WEIGHT_KG} kg.`;

function wholeNumberRangeHint(min: number, max: number): string {
  return `Enter a whole number from ${min} to ${max}.`;
}

const RESTING_HEART_RATE_HINT = wholeNumberRangeHint(
  MIN_RESTING_HEART_RATE_BPM,
  MAX_RESTING_HEART_RATE_BPM,
);
const MAX_HEART_RATE_HINT = wholeNumberRangeHint(MIN_MAX_HEART_RATE_BPM, MAX_MAX_HEART_RATE_BPM);

/** The tab last open, kept while the app runs. */
let lastTab: SettingsTab = "you";

interface SettingsController {
  root: HTMLElement;
  profile: UserProfile;
  /** Save the profile and say so. */
  commit: (message?: string) => void;
  /** Put a short note in the status line ("" clears it). */
  say: (message: string) => void;
  paint: () => void;
}

/** A number field that saves when it holds a valid value, and says why when it does not. */
function wireNumber(
  { root, commit, say }: SettingsController,
  attr: string,
  isValid: (value: number) => boolean,
  apply: (value: number) => void,
  invalidHint: string,
): void {
  const input = root.querySelector<HTMLInputElement>(`[data-${attr}]`);
  const hint = root.querySelector<HTMLElement>(`[data-${attr}-hint]`);
  if (!input || !hint) {
    return;
  }
  const original = hint.textContent ?? "";
  input.addEventListener("change", () => {
    const value = Number(input.value);
    if (!isValid(value)) {
      say("");
      hint.textContent = invalidHint;
      hint.classList.add("is-error");
      input.setAttribute("aria-invalid", "true");
      return;
    }
    hint.textContent = original;
    hint.classList.remove("is-error");
    input.removeAttribute("aria-invalid");
    apply(value);
    commit();
  });
}

/** The tab an arrow, Home or End key moves to from tab `index`, wrapping at the ends; null for any other key. */
export function tabKeyTarget(key: string, index: number): SettingsTab | null {
  const count = SETTINGS_TABS.length;
  const steps: Record<string, number> = {
    ArrowRight: (index + 1) % count,
    ArrowLeft: (index - 1 + count) % count,
    Home: 0,
    End: count - 1,
  };
  const target = steps[key];
  return target === undefined ? null : SETTINGS_TABS[target].id;
}

function wireTabs({ root, paint }: SettingsController): void {
  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-settings-tab]"));
  // Repainting replaces the tabs; focus goes back to the chosen one (WCAG 2.4.3).
  const select = (id: string | undefined): void => {
    if (!isSettingsTab(id) || id === lastTab) {
      return;
    }
    lastTab = id;
    paint();
    root.querySelector<HTMLButtonElement>(`[data-settings-tab="${id}"]`)?.focus();
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => select(tab.dataset.settingsTab));
    tab.addEventListener("keydown", (event) => {
      const target = tabKeyTarget(event.key, index);
      if (target !== null) {
        event.preventDefault();
        select(target);
      }
    });
  });
}

function wireYou(controller: SettingsController): void {
  const { root, profile, commit } = controller;
  wireNumber(controller, "bw", isValidBodyweight, (kg) => (profile.bodyweightKg = kg), BODYWEIGHT_HINT);
  wireNumber(
    controller,
    "resting-hr",
    isValidRestingHeartRate,
    (bpm) => (profile.restingHeartRateBpm = bpm),
    RESTING_HEART_RATE_HINT,
  );
  wireNumber(
    controller,
    "max-hr",
    isValidMaxHeartRate,
    (bpm) => (profile.maxHeartRateBpm = bpm),
    MAX_HEART_RATE_HINT,
  );
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
  wireNumber(controller, "add-weight", isValidAddWeight, (kg) => (profile.addWeightKg = kg), ADD_WEIGHT_HINT);
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

export interface SettingsViewOptions {
  /** First-run: setup chrome + Continue; does not set setupDone. */
  onContinue?: () => void;
}

export function renderSettingsView(root: HTMLElement, options: SettingsViewOptions = {}): void {
  const { onContinue } = options;
  const profile = loadProfile();
  const setup = onContinue !== undefined;
  const say = (message: string): void => {
    const status = root.querySelector<HTMLElement>("[data-settings-status]");
    if (status) {
      status.textContent = message;
    }
  };
  const controller: SettingsController = {
    root,
    profile,
    say,
    commit: (message = "Saved.") => {
      saveProfile(profile);
      say(message);
    },
    paint: () => {
      root.innerHTML = settingsPageHtml({
        tab: lastTab,
        profile,
        deloadActive: loadDeloadActive(),
        setup,
        levelsToConfirm: loadLevelsToConfirm().map((id) => ({ id, name: EXERCISE_GRAPH[id]?.name ?? id })),
      });
      root.querySelector("[data-levels-confirm-done]")?.addEventListener("click", () => {
        clearLevelsToConfirm();
        root.querySelector("[data-levels-to-confirm]")?.remove();
      });
      wireTabs(controller);
      wireYou(controller);
      wireGear(controller);
      wireTraining(controller);
      wireApp(controller);
      if (onContinue) {
        root.querySelector("[data-setup-continue]")?.addEventListener("click", () => {
          saveProfile(profile);
          onContinue();
        });
      }
    },
  };
  controller.paint();
}
