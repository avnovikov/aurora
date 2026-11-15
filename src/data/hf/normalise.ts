export function normaliseExerciseName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replaceAll(/\s+/g, " ");
}

export function hfExerciseId(numericId: number): string {
  if (!Number.isInteger(numericId) || numericId < 1) {
    throw new Error(`Invalid HF exercise id: ${numericId}`);
  }
  return `hf_${numericId}`;
}