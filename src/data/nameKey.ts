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

function singularise(word: string): string {
  if (/(ch|sh|x)es$/.test(word)) {
    return word.slice(0, -2);
  }
  if (word.length > 2 && word.endsWith("s") && !word.endsWith("ss")) {
    return word.slice(0, -1);
  }
  return word;
}
