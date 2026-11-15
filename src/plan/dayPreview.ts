import { EXERCISE_GRAPH } from "../data/exerciseGraph";
import { templateToStarter } from "../data/seed";
import type { EquipmentId, HistoryEntry, JointHistoryEntry, SessionTemplate } from "../domain/program";
import { resolveExerciseTiming } from "../domain/timing";
import type { ExerciseMemory, SkillTier } from "../domain/types";
import { planSession, type PlannedWorkItem } from "../rules/planSession";

/** Everything the planner reads besides the day itself and this morning's check-in. */
export interface AthleteState {
  memories: Record<string, ExerciseMemory>;
  history: readonly HistoryEntry[];
  jointHistory: readonly JointHistoryEntry[];
  equipment: readonly EquipmentId[];
  excluded: readonly string[];
  deloadActive: boolean;
  /** The plan's level for newly generated days; unset means "from my results". */
  level?: SkillTier;
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
  /** One-sentence description from the Library, shown when the row is opened. */
  summary?: string;
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
 * morning (good sleep, no pain), not the stored defaults. `history` is what
 * the planner will have seen by then, newest first; its existing variety
 * rule (a same-zone day after another rotates away from yesterday's moves)
 * reads it.
 */
export function previewDay(
  template: SessionTemplate,
  state: AthleteState,
  history: readonly HistoryEntry[] = state.history,
): PreviewItem[] {
  const planned = planSession(
    { painJoints: [], sleepQuality: "good" },
    templateToStarter(template),
    state.memories,
    {
      history,
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
    summary: item.summary,
    cautions: item.cautions,
  }));
}

/**
 * Previews for the whole queue, in order, each day seeing the days before it
 * as done. Nothing is generated or stored: it is the planner's own variety
 * rule applied to the sessions it will see, so three Legs days in a row show
 * the moves they will really get.
 */
export function previewQueue(templates: readonly SessionTemplate[], state: AthleteState): PreviewItem[][] {
  let history: readonly HistoryEntry[] = state.history;
  return templates.map((template, index) => {
    const items = previewDay(template, state, history);
    const assumedDone: HistoryEntry = {
      id: `preview-${index}`,
      completedAt: "",
      templateId: template.id,
      templateName: template.name,
      evaluation: "on_target",
      setCount: 0,
      exerciseIds: items.map((item) => item.exerciseId),
    };
    history = [assumedDone, ...history];
    return items;
  });
}
