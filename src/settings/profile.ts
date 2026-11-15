import type { EquipmentId, UserProfile } from "../domain/program";
import { loadDeloadActive } from "./deload";
import { isJointHistory } from "./jointHistory";
import { isCoachMuted, setCoachMuted } from "../voice/coachVoice";

const KEY = "aurora.poc.profile.v1";

const DEFAULT_PROFILE: UserProfile = {
  bodyweightKg: 78,
  equipment: ["body", "bar"],
  voiceMuted: false,
  jointHistory: [],
  setupDone: false,
};

function freshDefault(): UserProfile {
  return {
    ...DEFAULT_PROFILE,
    equipment: [...DEFAULT_PROFILE.equipment],
    jointHistory: [],
  };
}

export function loadProfile(): UserProfile {
  const raw = localStorage.getItem(KEY);
  if (!raw) {
    return freshDefault();
  }
  try {
    // Profiles saved before joint history existed lack the new fields.
    const parsed = { ...freshDefault(), ...JSON.parse(raw) } as UserProfile;
    assertProfile(parsed);
    setCoachMuted(parsed.voiceMuted);
    return parsed;
  } catch {
    return freshDefault();
  }
}

export function saveProfile(profile: UserProfile): void {
  assertProfile(profile);
  localStorage.setItem(KEY, JSON.stringify(profile));
  setCoachMuted(profile.voiceMuted);
}

export function exportBackupJson(): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      profile: loadProfile(),
      planQueue: localStorage.getItem("aurora.poc.planQueue.v1"),
      history: localStorage.getItem("aurora.poc.history.v1"),
      memory: localStorage.getItem("aurora.poc.memory.v1"),
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
  if (!Number.isFinite(profile.bodyweightKg) || profile.bodyweightKg < 30) {
    throw new Error(`bodyweightKg looks invalid: ${profile.bodyweightKg}`);
  }
  if (!Array.isArray(profile.equipment)) {
    throw new Error("equipment must be an array");
  }
  if (!isJointHistory(profile.jointHistory)) {
    throw new Error("jointHistory is invalid");
  }
}
