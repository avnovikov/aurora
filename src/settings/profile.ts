import type { EquipmentId, UserProfile } from "../domain/program";
import { loadDeloadActive } from "./deload";
import { isCoachMuted, setCoachMuted } from "../voice/coachVoice";

const KEY = "aurora.poc.profile.v1";

const DEFAULT_PROFILE: UserProfile = {
  bodyweightKg: 78,
  equipment: ["body", "bar"],
  voiceMuted: false,
};

export function loadProfile(): UserProfile {
  const raw = localStorage.getItem(KEY);
  if (!raw) {
    return { ...DEFAULT_PROFILE, equipment: [...DEFAULT_PROFILE.equipment] };
  }
  try {
    const parsed = JSON.parse(raw) as UserProfile;
    assertProfile(parsed);
    setCoachMuted(parsed.voiceMuted);
    return parsed;
  } catch {
    return { ...DEFAULT_PROFILE, equipment: [...DEFAULT_PROFILE.equipment] };
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
];

function assertProfile(profile: UserProfile): void {
  if (!Number.isFinite(profile.bodyweightKg) || profile.bodyweightKg < 30) {
    throw new Error(`bodyweightKg looks invalid: ${profile.bodyweightKg}`);
  }
  if (!Array.isArray(profile.equipment)) {
    throw new Error("equipment must be an array");
  }
}
