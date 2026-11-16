import { describe, expect, it } from "vitest";
import { EXERCISE_GRAPH } from "../../src/data/exerciseGraph";
import type { PlannedWorkItem } from "../../src/rules/planSession";
import { doseNoteHtml } from "../../src/ui/sessionDoseNote";

function item(name: string, targetRir = 3): PlannedWorkItem {
  const exercise = Object.values(EXERCISE_GRAPH).find((entry) => entry.name === name)!;
  return {
    slotId: "s",
    label: name,
    exerciseId: exercise.id,
    exerciseName: name,
    dose: { sets: 3, reps: 10, targetRir, addedLoadKg: 0 },
    restSeconds: 60,
    ruleIds: [],
    reason: "",
    cues: [],
  } as unknown as PlannedWorkItem;
}

describe("doseNoteHtml", () => {
  it("shows the pyramid hold count for each set of a short plank", () => {
    expect(doseNoteHtml(item("Forearm Plank"), 1, 10)).toContain("5 × 10 s holds");
    expect(doseNoteHtml(item("Forearm Plank"), 3, 10)).toContain("1 × 10 s hold");
  });

  it("shows reps in reserve on rep sets", () => {
    expect(doseNoteHtml(item("Prisoner Squat"), 1, 12)).toContain("Stop with 3 reps left in reserve");
  });
});
