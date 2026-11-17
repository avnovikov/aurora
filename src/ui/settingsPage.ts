import { PALETTES, type Palette } from "../brand/palettes";
import type { EquipmentId, UserProfile } from "../domain/program";
import { chipHtml } from "../library/chips";
import { escapeHtml } from "../library/present";
import {
  ALL_EQUIPMENT,
  MAX_ADD_WEIGHT_KG,
  MAX_MAX_HEART_RATE_BPM,
  MAX_RESTING_HEART_RATE_BPM,
  MIN_ADD_WEIGHT_KG,
  MIN_BODYWEIGHT_KG,
  MIN_MAX_HEART_RATE_BPM,
  MIN_RESTING_HEART_RATE_BPM,
} from "../settings/profile";

export const SETTINGS_TABS = [
  { id: "you", label: "You" },
  { id: "gear", label: "Gear" },
  { id: "training", label: "Training" },
  { id: "app", label: "App" },
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number]["id"];

export function isSettingsTab(value: string | undefined): value is SettingsTab {
  return SETTINGS_TABS.some((tab) => tab.id === value);
}

export const EQUIPMENT_LABEL: Record<EquipmentId, string> = {
  body: "Bodyweight",
  bar: "Pull-up bar",
  rings: "Rings",
  parallettes: "Parallettes",
  dumbbell: "Dumbbell or kettlebell",
  band: "Resistance band",
};

export interface SettingsPageModel {
  tab: SettingsTab;
  profile: UserProfile;
  deloadActive: boolean;
  /** First-run: hide Backup / Deload and show Continue. */
  setup?: boolean;
}

function tabBarHtml(active: SettingsTab): string {
  const tabs = SETTINGS_TABS.map((tab) => {
    const on = tab.id === active;
    return `<button type="button" role="tab" id="settings-tab-${tab.id}" aria-controls="settings-panel" aria-selected="${on}" tabindex="${on ? 0 : -1}" class="settings-tab${on ? " selected" : ""}" data-settings-tab="${tab.id}">${tab.label}</button>`;
  }).join("");
  return `<div class="settings-tabs" role="tablist" aria-label="Settings sections">${tabs}</div>`;
}

function numberFieldHtml(attr: string, label: string, value: number, hint: string, limits: string): string {
  return `
    <label class="field">${label}
      <input type="number" inputmode="decimal" ${limits} value="${value}" data-${attr} aria-describedby="${attr}-hint" />
    </label>
    <p class="hint" id="${attr}-hint" aria-live="polite" data-${attr}-hint>${hint}</p>`;
}

function wholeBpmLimits(min: number, max: number): string {
  return `min="${min}" max="${max}" step="1"`;
}

function heartRateFieldsHtml(profile: UserProfile): string {
  return `
    ${numberFieldHtml(
      "resting-hr",
      "Resting heart rate (bpm)",
      profile.restingHeartRateBpm,
      "Your pulse sitting still. The bottom of your training bands.",
      wholeBpmLimits(MIN_RESTING_HEART_RATE_BPM, MAX_RESTING_HEART_RATE_BPM),
    )}
    ${numberFieldHtml(
      "max-hr",
      "Max heart rate (bpm)",
      profile.maxHeartRateBpm,
      "The highest pulse you reach. The top of your training bands.",
      wholeBpmLimits(MIN_MAX_HEART_RATE_BPM, MAX_MAX_HEART_RATE_BPM),
    )}`;
}

function youHtml(profile: UserProfile): string {
  return `
    ${numberFieldHtml("bw", "Bodyweight (kg)", profile.bodyweightKg, "Used for pull-up and dip load.", `min="${MIN_BODYWEIGHT_KG}" step="0.5"`)}
    ${heartRateFieldsHtml(profile)}
    <p class="eyebrow">Past injuries</p>
    <p class="hint">Moves that load these joints are skipped or eased.</p>
    <div data-joint-editor></div>`;
}

function gearHtml(profile: UserProfile): string {
  const chips = ALL_EQUIPMENT.map((item) =>
    chipHtml("eq", item, EQUIPMENT_LABEL[item], profile.equipment.includes(item)),
  ).join("");
  return `
    <p class="eyebrow">Equipment you have</p>
    <p class="hint">Sessions only plan moves you have the gear for.</p>
    <div class="row wrap">${chips}</div>
    <p class="eyebrow">Added weight</p>
    ${numberFieldHtml(
      "add-weight",
      "Weight you can add (kg)",
      profile.addWeightKg,
      "A dumbbell, kettlebell or vest. Sessions offer it on moves that take load.",
      `min="${MIN_ADD_WEIGHT_KG}" max="${MAX_ADD_WEIGHT_KG}" step="0.5"`,
    )}`;
}

function deloadFieldHtml(deloadActive: boolean): string {
  const checked = deloadActive ? "checked" : "";
  return `
    <label class="field row">
      <input type="checkbox" data-deload ${checked} />
      Deload week
    </label>
    <p class="hint">Lighter sessions for a week, with no moves up a level.</p>`;
}

function trainingHtml(profile: UserProfile, deloadActive: boolean, setup: boolean): string {
  const deload = setup ? "" : deloadFieldHtml(deloadActive);
  const muted = profile.voiceMuted ? "checked" : "";
  return `
    ${deload}
    <label class="field row">
      <input type="checkbox" data-mute ${muted} />
      Mute coach voice
    </label>`;
}

/** A pick-one palette chip: label, with the meaning as a small second line. */
function paletteChipHtml(palette: Palette, selected: boolean): string {
  return `<button type="button" class="palette-chip${selected ? " selected" : ""}" data-palette-key="${palette.key}" aria-pressed="${selected}"><span class="palette-label">${escapeHtml(palette.label)}</span><small class="palette-meaning">${escapeHtml(palette.meaning)}</small></button>`;
}

function appHtml(profile: UserProfile, setup: boolean): string {
  const backup = setup
    ? ""
    : `
    <p class="eyebrow">Backup</p>
    <p class="hint">Everything stays on this phone. Export a copy to keep it safe.</p>
    <button type="button" data-export>Export backup</button>
    <pre class="export" data-export-out hidden></pre>`;
  return `
    <p class="eyebrow">Palette</p>
    <div class="palette-list" role="group" aria-label="Palette">
      ${PALETTES.map((palette) => paletteChipHtml(palette, palette.key === profile.palette)).join("")}
    </div>
    ${backup}`;
}

function inSetupMode(model: SettingsPageModel): boolean {
  return Boolean(model.setup);
}

function panelHtml(model: SettingsPageModel): string {
  const setup = inSetupMode(model);
  switch (model.tab) {
    case "you":
      return youHtml(model.profile);
    case "gear":
      return gearHtml(model.profile);
    case "training":
      return trainingHtml(model.profile, model.deloadActive, setup);
    case "app":
      return appHtml(model.profile, setup);
  }
}

export function settingsPageHtml(model: SettingsPageModel): string {
  const setup = inSetupMode(model);
  const continueCta = setup
    ? `<button type="button" class="cta" data-setup-continue>Continue</button>`
    : "";
  return `
    <main class="shell settings">
      <p class="eyebrow">${setup ? "Setup" : "Settings"}</p>
      <h1>Your setup</h1>
      ${tabBarHtml(model.tab)}
      <p class="settings-status" role="status" data-settings-status></p>
      <section class="settings-panel" id="settings-panel" role="tabpanel" aria-labelledby="settings-tab-${model.tab}">
        ${panelHtml(model)}
      </section>
      <p class="hint settings-autosave">Changes save as you make them.</p>
      ${continueCta}
    </main>`;
}
