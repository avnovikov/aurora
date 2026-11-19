/** True when the move is kettlebell work (name gate; no separate gear id yet). */
export function isKettlebellExercise(exercise: { name: string }): boolean {
  assertNonEmptyName(exercise.name);
  return /\bkettlebells?\b/i.test(exercise.name);
}

function assertNonEmptyName(name: string): void {
  if (typeof name !== "string" || name.trim() === "") {
    throw new Error(`exercise.name must be a non-empty string; got ${JSON.stringify(name)}`);
  }
}
