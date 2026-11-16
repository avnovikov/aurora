import { EXERCISE_GRAPH } from "../data/exerciseGraph";
import { resolveExerciseTiming } from "../domain/timing";
import { HOLD_REPEAT_REST_SECONDS, holdRepeats } from "../rules/doseCaps";
import type { PlannedWorkItem } from "../rules/planSession";

/**
 * One line under the reps on the work screen: how this set is done. Short
 * core holds run as a descending pyramid ("5 × 10 s holds"); other holds stop
 * before shaking; rep sets stop with the target reps in reserve.
 */
export function doseNoteHtml(item: PlannedWorkItem, setIndex: number, units: number): string {
  const exercise = EXERCISE_GRAPH[item.exerciseId];
  if (!exercise) {
    return "";
  }
  const repeats = holdRepeats(exercise, item.dose.sets, units);
  const count = repeats?.[setIndex - 1];
  if (count !== undefined) {
    const holds = count === 1 ? `1 × ${units} s hold` : `${count} × ${units} s holds, ${HOLD_REPEAT_REST_SECONDS} s breath between`;
    return `<p class="dose-note" data-dose-note>${holds}</p>`;
  }
  if (resolveExerciseTiming(exercise).effort === "hold") {
    return `<p class="dose-note" data-dose-note>Seconds · stop before your form breaks</p>`;
  }
  const rir = item.dose.targetRir;
  return `<p class="dose-note" data-dose-note>Stop with ${rir} rep${rir === 1 ? "" : "s"} left in reserve</p>`;
}
