import type { ExerciseMemory } from "../domain/types";
import type { PlannedWorkItem } from "../rules/planSession";
import { slowSetCueDelaySeconds } from "../session/setDuration";

export interface SlowSetCueClock {
  setTimeout: (handler: () => void, ms: number) => number;
  clearTimeout: (id: number) => void;
}

export interface SlowSetCueDeps {
  speakPaceNudge: () => void;
  memoryFor: (exerciseId: string) => ExerciseMemory | undefined;
  clock?: SlowSetCueClock;
}

export interface SlowSetCueScheduleInput {
  phase: string;
  setIndex: number;
  item: PlannedWorkItem | null;
  isRepWork: boolean;
}

/**
 * One mid-next-set pace nudge after a slow rep set.
 * Arm on the slow finish; schedule when that exercise's next work set paints;
 * cancel if the athlete finishes before the delay.
 */
export function createSlowSetCueController(deps: SlowSetCueDeps) {
  const clock = deps.clock ?? {
    setTimeout: (handler, ms) => window.setTimeout(handler, ms),
    clearTimeout: (id) => window.clearTimeout(id),
  };

  let pendingExerciseId: string | null = null;
  let timerId: number | null = null;
  let scheduledFor: { exerciseId: string; setIndex: number } | null = null;

  const clearTimer = (): void => {
    if (timerId === null) {
      return;
    }
    clock.clearTimeout(timerId);
    timerId = null;
  };

  const clearArmed = (): void => {
    clearTimer();
    pendingExerciseId = null;
    scheduledFor = null;
  };

  const arm = (exerciseId: string): void => {
    if (!exerciseId) {
      throw new Error("slow-set cue arm requires a non-empty exerciseId");
    }
    pendingExerciseId = exerciseId;
    scheduledFor = null;
  };

  const cancelFor = (exerciseId: string): void => {
    if (pendingExerciseId !== exerciseId) {
      return;
    }
    clearArmed();
  };

  const scheduleIfNeeded = (input: SlowSetCueScheduleInput): void => {
    const { phase, item, isRepWork, setIndex } = input;
    if (phase !== "work" || !pendingExerciseId || !item || !isRepWork) {
      return;
    }
    if (item.exerciseId !== pendingExerciseId) {
      return;
    }
    if (
      scheduledFor?.exerciseId === item.exerciseId &&
      scheduledFor.setIndex === setIndex
    ) {
      return;
    }
    clearTimer();
    scheduledFor = { exerciseId: item.exerciseId, setIndex };
    const delayMs = slowSetCueDelaySeconds(deps.memoryFor(item.exerciseId)) * 1000;
    const armedId = item.exerciseId;
    timerId = clock.setTimeout(() => {
      timerId = null;
      if (pendingExerciseId !== armedId) {
        return;
      }
      pendingExerciseId = null;
      scheduledFor = null;
      deps.speakPaceNudge();
    }, delayMs);
  };

  return { arm, cancelFor, clear: clearArmed, scheduleIfNeeded };
}

export type SlowSetCueController = ReturnType<typeof createSlowSetCueController>;
