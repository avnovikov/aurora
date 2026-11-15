/**
 * Loose identity key for exercise names across sources, so "Push-Ups",
 * "Pushups" and "push up" collide. Used for cross-catalogue de-duplication.
 */
export function exerciseNameKey(name: string): string {
  return name
    .toLowerCase()
    .replaceAll(/['’]/g, "")
    .replaceAll(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((word) => word.length > 0)
    .map(singularise)
    .join("");
}

export interface DuplicateCheck {
  duplicate: boolean;
  /** The existing move this row folds into, when it is already in the catalogue. */
  intoId?: string;
}

/**
 * Whether a source row duplicates a move already taken. `alias` names a move
 * the row is known to be the same as; the row is skipped even if that move
 * is not in the catalogue (it was dropped on purpose).
 */
export function checkDuplicate(
  taken: ReadonlyMap<string, string>,
  key: string,
  alias?: string,
): DuplicateCheck {
  const intoId = alias ? taken.get(exerciseNameKey(alias)) : taken.get(key);
  return { duplicate: Boolean(alias || intoId), intoId };
}

function singularise(word: string): string {
  if (/(ch|sh|x)es$/.test(word)) {
    return word.slice(0, -2);
  }
  if (word.length > 2 && word.endsWith("s") && !word.endsWith("ss")) {
    return word.slice(0, -1);
  }
  return word;
}
