import type { Exercise, ExerciseTiming, Pattern } from "./types";

/** Controlled strength tempo ≈ 2s concentric + 1.5s eccentric (ACSM moderate). */
const DEFAULT_REP_SECONDS = 3.5;
const DEFAULT_ECCENTRIC_REP_SECONDS = 5;

const REST_BY_PATTERN: Record<Pattern, number> = {
  vertical_pull: 120,
  vertical_push: 120,
  horizontal_pull: 90,
  horizontal_push: 90,
  squat: 90,
  hinge: 90,
  skill: 60,
  core_compression: 60,
  core_anti_extension: 45,
  conditioning: 30,
  mobility: 30,
};

/**
 * Fills effort / tempo / default rest from exercise type + pattern
 * when the library row omits explicit timing (HF imports).
 */
export function resolveExerciseTiming(exercise: Exercise): ExerciseTiming {
  const effort = exercise.effort ?? defaultEffort(exercise.type);
  const secondsPerRep =
    exercise.secondsPerRep ?? defaultSecondsPerRep(effort, exercise.type);
  const defaultRestSeconds =
    exercise.defaultRestSeconds ?? REST_BY_PATTERN[exercise.pattern] ?? 90;

  assertTiming(exercise.id, effort, secondsPerRep, defaultRestSeconds);
  return { effort, secondsPerRep, defaultRestSeconds };
}

function defaultEffort(
  type: Exercise["type"],
): ExerciseTiming["effort"] {
  if (type === "isometric") {
    return "hold";
  }
  return "reps";
}

function defaultSecondsPerRep(
  effort: ExerciseTiming["effort"],
  type: Exercise["type"],
): number {
  if (effort === "hold") {
    return 1;
  }
  if (type === "eccentric") {
    return DEFAULT_ECCENTRIC_REP_SECONDS;
  }
  return DEFAULT_REP_SECONDS;
}

function assertTiming(
  exerciseId: string,
  effort: ExerciseTiming["effort"],
  secondsPerRep: number,
  defaultRestSeconds: number,
): void {
  if (secondsPerRep <= 0) {
    throw new Error(
      `secondsPerRep must be positive for ${exerciseId}; got ${secondsPerRep}`,
    );
  }
  if (defaultRestSeconds < 0) {
    throw new Error(
      `defaultRestSeconds must be non-negative for ${exerciseId}; got ${defaultRestSeconds}`,
    );
  }
  if (effort !== "reps" && effort !== "hold") {
    throw new Error(`Unknown effort for ${exerciseId}: ${effort}`);
  }
}
