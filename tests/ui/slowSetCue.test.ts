import { describe, expect, it, vi } from "vitest";
import { FALLBACK_SLOW_SET_CUE_DELAY_SECONDS } from "../../src/session/setDuration";
import { createSlowSetCueController } from "../../src/ui/slowSetCue";
import type { PlannedWorkItem } from "../../src/rules/planSession";

function item(exerciseId: string): PlannedWorkItem {
  return {
    slotId: `slot_${exerciseId}`,
    exerciseId,
    doodlePath: "/d.svg",
    restSeconds: 60,
    dose: { sets: 3, reps: 8, addedLoadKg: 0 },
  } as PlannedWorkItem;
}

describe("createSlowSetCueController", () => {
  it("speaks once after the delay on the next matching rep set", () => {
    const speakPaceNudge = vi.fn();
    const timers = new Map<number, () => void>();
    let nextId = 1;
    const cue = createSlowSetCueController({
      speakPaceNudge,
      memoryFor: () => undefined,
      clock: {
        setTimeout: (handler) => {
          const id = nextId++;
          timers.set(id, handler);
          return id;
        },
        clearTimeout: (id) => {
          timers.delete(id);
        },
      },
    });

    cue.arm("bodyweight_squat");
    cue.scheduleIfNeeded({
      phase: "work",
      setIndex: 2,
      item: item("bodyweight_squat"),
      isRepWork: true,
    });
    expect(timers.size).toBe(1);
    expect(speakPaceNudge).not.toHaveBeenCalled();

    [...timers.values()][0]!();
    expect(speakPaceNudge).toHaveBeenCalledOnce();
  });

  it("cancels when the set ends before the delay", () => {
    const speakPaceNudge = vi.fn();
    const timers = new Map<number, () => void>();
    let nextId = 1;
    const cue = createSlowSetCueController({
      speakPaceNudge,
      memoryFor: () => undefined,
      clock: {
        setTimeout: (handler) => {
          const id = nextId++;
          timers.set(id, handler);
          return id;
        },
        clearTimeout: (id) => {
          timers.delete(id);
        },
      },
    });

    cue.arm("bodyweight_squat");
    cue.scheduleIfNeeded({
      phase: "work",
      setIndex: 2,
      item: item("bodyweight_squat"),
      isRepWork: true,
    });
    cue.cancelFor("bodyweight_squat");
    expect(timers.size).toBe(0);
    expect(speakPaceNudge).not.toHaveBeenCalled();
  });

  it("uses the fallback delay when memory is thin", () => {
    const delays: number[] = [];
    const cue = createSlowSetCueController({
      speakPaceNudge: () => undefined,
      memoryFor: () => undefined,
      clock: {
        setTimeout: (_handler, ms) => {
          delays.push(ms);
          return 1;
        },
        clearTimeout: () => undefined,
      },
    });
    cue.arm("bodyweight_squat");
    cue.scheduleIfNeeded({
      phase: "work",
      setIndex: 2,
      item: item("bodyweight_squat"),
      isRepWork: true,
    });
    expect(delays).toEqual([FALLBACK_SLOW_SET_CUE_DELAY_SECONDS * 1000]);
  });
});
