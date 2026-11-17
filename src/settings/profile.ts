import type { EquipmentId, UserProfile } from "../domain/program";
import { DEFAULT_PALETTE, isPaletteKey } from "../brand/palettes";
import { DEFAULT_ADDED_LOAD_KG } from "../session/setLog";
import { createKeyValueStore } from "../storage/keyValueStore";
import {
  HISTORY_KEY,
  MEMORY_KEY,
  PLAN_QUEUE_KEY,
  PROFILE_KEY,
} from "../storage/storageKeys";
import { loadDeloadActive } from "./deload";
import { isJointHistory } from "./jointHistory";
import { isCoachMuted, setCoachMuted } from "../voice/coachVoice";

const store = createKeyValueStore(PROFILE_KEY);
const planQueueStore = createKeyValueStore(PLAN_QUEUE_KEY);
const historyStore = createKeyValueStore(HISTORY_KEY);
const memoryStore = createKeyValueStore(MEMORY_KEY);

/** Whole bpm Settings accepts for a resting pulse. */
export const MIN_RESTING_HEART_RATE_BPM = 30;
export const MAX_RESTING_HEART_RATE_BPM = 100;

/**
 * Whole bpm Settings accepts for a max pulse.
 * The floor sits 40 above the highest resting value, so the five bands cannot collapse.
 */
export const MIN_MAX_HEART_RATE_BPM = 140;
export const MAX_MAX_HEART_RATE_BPM = 220;

/** Starting bands when the athlete has not entered their own. */
export const DEFAULT_RESTING_HEART_RATE_BPM = 60;
export const DEFAULT_MAX_HEART_RATE_BPM = 185;

const DEFAULT_PROFILE: UserProfile = {
  bodyweightKg: 78,
  equipment: ["body", "bar"],
  voiceMuted: false,
  jointHistory: [],
  setupDone: false,
  palette: DEFAULT_PALETTE,
  addWeightKg: DEFAULT_ADDED_LOAD_KG,
  restingHeartRateBpm: DEFAULT_RESTING_HEART_RATE_BPM,
  maxHeartRateBpm: DEFAULT_MAX_HEART_RATE_BPM,
};

/** The lightest and heaviest added weight Settings accepts. */
export const MIN_ADD_WEIGHT_KG = 0.5;
export const MAX_ADD_WEIGHT_KG = 100;

/** The lightest bodyweight Settings accepts. */
export const MIN_BODYWEIGHT_KG = 30;

/** A usable added weight: MIN_ADD_WEIGHT_KG to MAX_ADD_WEIGHT_KG. */
export function isValidAddWeight(kg: number): boolean {
  return Number.isFinite(kg) && kg >= MIN_ADD_WEIGHT_KG && kg <= MAX_ADD_WEIGHT_KG;
}

/** A usable bodyweight in kg: MIN_BODYWEIGHT_KG or more. */
export function isValidBodyweight(kg: number): boolean {
  return Number.isFinite(kg) && kg >= MIN_BODYWEIGHT_KG;
}

function isWholeBpmInRange(bpm: number, min: number, max: number): boolean {
  return Number.isInteger(bpm) && bpm >= min && bpm <= max;
}

/** A whole resting pulse inside the settings range. */
export function isValidRestingHeartRate(bpm: number): boolean {
  return isWholeBpmInRange(bpm, MIN_RESTING_HEART_RATE_BPM, MAX_RESTING_HEART_RATE_BPM);
}

/** A whole max pulse inside the settings range. */
export function isValidMaxHeartRate(bpm: number): boolean {
  return isWholeBpmInRange(bpm, MIN_MAX_HEART_RATE_BPM, MAX_MAX_HEART_RATE_BPM);
}

/** Missing or out-of-range bands fall back together so the five zones stay usable. */
function restoreDefaultHeartRates(profile: UserProfile): void {
  if (isValidRestingHeartRate(profile.restingHeartRateBpm) && isValidMaxHeartRate(profile.maxHeartRateBpm)) {
    return;
  }
  profile.restingHeartRateBpm = DEFAULT_RESTING_HEART_RATE_BPM;
  profile.maxHeartRateBpm = DEFAULT_MAX_HEART_RATE_BPM;
}

function freshDefault(): UserProfile {
  return {
    ...DEFAULT_PROFILE,
    equipment: [...DEFAULT_PROFILE.equipment],
    jointHistory: [],
  };
}

export function loadProfile(): UserProfile {
  const raw = store.read();
  if (!raw) {
    return freshDefault();
  }
  try {
    // Profiles saved before joint history existed lack the new fields.
    const parsed = { ...freshDefault(), ...JSON.parse(raw) } as UserProfile;
    // An unknown palette (renamed or removed) falls back rather than losing the profile.
    if (!isPaletteKey(parsed.palette)) {
      parsed.palette = DEFAULT_PALETTE;
    }
    // A missing or nonsense pair must not wipe the rest of the profile.
    restoreDefaultHeartRates(parsed);
    assertProfile(parsed);
    setCoachMuted(parsed.voiceMuted);
    return parsed;
  } catch {
    return freshDefault();
  }
}

export function saveProfile(profile: UserProfile): void {
  assertProfile(profile);
  store.write(JSON.stringify(profile));
  setCoachMuted(profile.voiceMuted);
}

export function exportBackupJson(): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      profile: loadProfile(),
      planQueue: planQueueStore.read(),
      history: historyStore.read(),
      memory: memoryStore.read(),
      muted: isCoachMuted(),
      deloadActive: loadDeloadActive(),
    },
    null,
    2,
  );
}

export const ALL_EQUIPMENT: EquipmentId[] = [
  "body",
  "bar",
  "rings",
  "parallettes",
  "dumbbell",
  "band",
];

function assertProfile(profile: UserProfile): void {
  if (!isValidBodyweight(profile.bodyweightKg)) {
    throw new Error(`bodyweightKg looks invalid: ${profile.bodyweightKg}`);
  }
  if (!isValidAddWeight(profile.addWeightKg)) {
    throw new Error(`addWeightKg looks invalid: ${profile.addWeightKg}`);
  }
  if (!Array.isArray(profile.equipment)) {
    throw new Error("equipment must be an array");
  }
  if (!isJointHistory(profile.jointHistory)) {
    throw new Error("jointHistory is invalid");
  }
  if (!isPaletteKey(profile.palette)) {
    throw new Error(`palette is unknown: ${String(profile.palette)}`);
  }
  if (!isValidRestingHeartRate(profile.restingHeartRateBpm)) {
    throw new Error(
      `restingHeartRateBpm must be a whole number from ${MIN_RESTING_HEART_RATE_BPM} to ${MAX_RESTING_HEART_RATE_BPM}; got ${profile.restingHeartRateBpm}`,
    );
  }
  if (!isValidMaxHeartRate(profile.maxHeartRateBpm)) {
    throw new Error(
      `maxHeartRateBpm must be a whole number from ${MIN_MAX_HEART_RATE_BPM} to ${MAX_MAX_HEART_RATE_BPM}; got ${profile.maxHeartRateBpm}`,
    );
  }
}
