import type { SeedExercise } from "../../src/data/seed";
import type { HistoryEntry } from "../../src/domain/program";
import type { MuscleGroup, MuscleRole, Pattern } from "../../src/domain/types";

/** A finished session, one push move, 4 sets; override what the test cares about. */
export function entry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: "h",
    completedAt: "2026-11-19T08:00:00.000Z",
    templateId: "t",
    templateName: "T",
    evaluation: "on_target",
    setCount: 4,
    exerciseIds: ["push"],
    ...overrides,
  };
}

/** A library move with the given primary (and optional secondary) muscle areas. */
export function move(
  id: string,
  pattern: Pattern,
  primaries: MuscleGroup[],
  extra: Partial<SeedExercise> & { secondary?: MuscleGroup[] } = {},
): SeedExercise {
  const { secondary = [], ...rest } = extra;
  const muscles = [
    ...primaries.map((group) => ({ group, role: "primary" as MuscleRole })),
    ...secondary.map((group) => ({ group, role: "secondary" as MuscleRole })),
  ];
  return { id, name: id.replaceAll("_", " "), pattern, type: "dynamic", muscles, joints: [], regions: [], cues: [], ...rest };
}

/** A logged set log of `count` sets for one move. */
export function sets(exerciseId: string, count: number, stopReason = "completed", loggedAt = "2026-11-19T08:00:00.000Z") {
  return Array.from({ length: count }, (_, index) => ({
    exerciseId,
    setIndex: index + 1,
    prescribedReps: 8,
    completedReps: 8,
    loggedAt,
    stopReason,
  }));
}
