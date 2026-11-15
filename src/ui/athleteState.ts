import type { AthleteState } from "../plan/dayPreview";
import { loadExcluded } from "../plan/exclusions";
import { loadHistory, loadMemories } from "../session/history";
import { loadDeloadActive } from "../settings/deload";
import { loadProfile } from "../settings/profile";

/** Everything the planner reads about the athlete, from storage. */
export function loadAthleteState(): AthleteState {
  const profile = loadProfile();
  return {
    memories: loadMemories(),
    history: loadHistory(),
    jointHistory: profile.jointHistory,
    equipment: profile.equipment,
    excluded: loadExcluded(),
    deloadActive: loadDeloadActive(),
  };
}
