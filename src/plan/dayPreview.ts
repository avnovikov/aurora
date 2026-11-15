import { EXERCISE_GRAPH } from "../data/exerciseGraph";
import { templateToStarter } from "../data/seed";
import type { EquipmentId, HistoryEntry, JointHistoryEntry, SessionTemplate } from "../domain/program";
import { resolveExerciseTiming } from "../domain/timing";
import type { ExerciseMemory } from "../domain/types";
import { planSession, type PlannedWorkItem } from "../rules/planSession";

/** Everything the planner reads besides the day itself and this morning's check-in. */
export interface AthleteState {
  memories: Record<string, ExerciseMemory>;
  history: readonly HistoryEntry[];
  jointHistory: readonly JointHistoryEntry[];
  equipment: readonly EquipmentId[];
  excluded: readonly string[];
  deloadActive: boolean;
}

export interface PreviewItem {
  slotId: string;
  label: string;
  /** The move the session would actually use (after level, joint, gear and exclusion rules). */
  exerciseId: string;
  name: string;
  /** "4 × 8" or "3 × 30 s". */
  dose: string;
  /** Why the planner changed the stored move, when it did. */
  note?: string;
  cautions: string[];
}

function doseLabel(item: PlannedWorkItem): string {
  const exercise = EXERCISE_GRAPH[item.exerciseId];
  const hold = exercise !== undefined && resolveExerciseTiming(exercise).effort === "hold";
  return `${item.dose.sets} × ${item.dose.reps}${hold ? " s" : ""}`;
}

const SWAP_RULES: ReadonlySet<string> = new Set(["joint_history", "equipment", "excluded", "advance", "stall_regress", "pain"]);

/** The parts of the planner's reason that say a move was changed (not its dose bookkeeping). */
const CHANGE_WORDS = /swapped|Advanced|Regressed/;

function changeNote(item: PlannedWorkItem): string | undefined {
  if (!item.ruleIds.some((rule) => SWAP_RULES.has(rule))) {
    return undefined;
  }
  const parts = item.reason.split(" · ").filter((part) => CHANGE_WORDS.test(part));
  return parts.length > 0 ? parts.join(" · ") : item.reason;
}

/**
 * What a day's session will contain: the planner's real output for a normal
 * morning (good sleep, no pain), not the stored defaults. `isToday` lets the
 * variety rotation look at yesterday's session; later days cannot know theirs.
 */
export function previewDay(template: SessionTemplate, state: AthleteState, isToday: boolean): PreviewItem[] {
  const planned = planSession(
    { painJoints: [], sleepQuality: "good" },
    templateToStarter(template),
    state.memories,
    {
      history: isToday ? state.history : [],
      focus: template.focus,
      deloadActive: state.deloadActive,
      jointHistory: state.jointHistory,
      equipment: state.equipment,
      excluded: state.excluded,
    },
  );
  return planned.work.map((item) => ({
    slotId: item.slotId,
    label: item.label,
    exerciseId: item.exerciseId,
    name: item.exerciseName,
    dose: doseLabel(item),
    note: changeNote(item),
    cautions: item.cautions,
  }));
}
