import type { SeedExercise } from "../seed";
import { hfExerciseId, normaliseExerciseName } from "./normalise";
import type { HfExerciseRecord } from "./types";

export function wireHfProgressionLinks(
  records: HfExerciseRecord[],
  exercises: SeedExercise[],
): SeedExercise[] {
  const byId = new Map(exercises.map((item) => [item.id, { ...item }]));
  const nameToId = buildNameToIdMap(records);

  for (const record of records) {
    const exerciseId = hfExerciseId(record.id);
    const exercise = byId.get(exerciseId);
    if (!exercise) {
      continue;
    }
    const context = findProgressionContext(records, record);
    if (!context) {
      continue;
    }
    const easierName =
      context.step > 1 ? progressionName(context.record, context.step - 1) : undefined;
    const harderName =
      context.step < 3 ? progressionName(context.record, context.step + 1) : undefined;
    exercise.easierId = resolveNameToId(easierName, nameToId, exerciseId);
    exercise.harderId = resolveNameToId(harderName, nameToId, exerciseId);
  }

  return [...byId.values()];
}

function buildNameToIdMap(records: HfExerciseRecord[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const record of records) {
    map.set(normaliseExerciseName(record.name), hfExerciseId(record.id));
  }
  return map;
}

function findProgressionContext(
  records: HfExerciseRecord[],
  record: HfExerciseRecord,
): { record: HfExerciseRecord; step: number } | undefined {
  const selfKey = normaliseExerciseName(record.name);
  const ownStep = findProgressionStepInRecord(record, selfKey);
  if (ownStep !== undefined) {
    return { record, step: ownStep };
  }

  for (const candidate of records) {
    const step = findProgressionStepInRecord(candidate, selfKey);
    if (step !== undefined) {
      return { record: candidate, step };
    }
  }
  return undefined;
}

function findProgressionStepInRecord(
  record: HfExerciseRecord,
  selfKey: string,
): number | undefined {
  const steps = progressionSteps(record);
  const exact = steps.indexOf(selfKey);
  if (exact >= 0) {
    return exact + 1;
  }

  for (let index = 0; index < steps.length; index += 1) {
    if (stepMatchesExercise(steps[index], selfKey)) {
      return index + 1;
    }
  }
  return undefined;
}

function progressionSteps(record: HfExerciseRecord): string[] {
  return [
    normaliseExerciseName(record.progression_1),
    normaliseExerciseName(record.progression_2),
    normaliseExerciseName(record.progression_3),
  ];
}

function stepMatchesExercise(stepKey: string, exerciseKey: string): boolean {
  if (!stepKey || !exerciseKey) {
    return false;
  }
  return stepKey.startsWith(exerciseKey) || exerciseKey.startsWith(stepKey);
}

function progressionName(record: HfExerciseRecord, step: number): string | undefined {
  if (step === 1) {
    return record.progression_1;
  }
  if (step === 2) {
    return record.progression_2;
  }
  if (step === 3) {
    return record.progression_3;
  }
  return undefined;
}

function resolveNameToId(
  name: string | undefined,
  nameToId: Map<string, string>,
  currentId: string,
): string | undefined {
  if (!name?.trim()) {
    return undefined;
  }
  const key = normaliseExerciseName(name);
  const direct = nameToId.get(key);
  if (direct && direct !== currentId) {
    return direct;
  }
  return undefined;
}