import { createKeyValueStore } from "../storage/keyValueStore";

const store = createKeyValueStore("aurora.poc.excludedExercises.v1");

/**
 * Exercises the athlete never wants planned ("not for me"). One list for the
 * whole app: work slots and warm-up stations swap or drop these; the Library
 * shows them.
 */
export function loadExcluded(): string[] {
  const raw = store.read();
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return [...new Set(parsed.filter((id): id is string => typeof id === "string" && id !== ""))];
  } catch {
    return [];
  }
}

export function isExcluded(exerciseId: string): boolean {
  return loadExcluded().includes(exerciseId);
}

function save(ids: readonly string[]): string[] {
  if (ids.length === 0) {
    store.clear();
    return [];
  }
  store.write(JSON.stringify(ids));
  return [...ids];
}

export function excludeExercise(exerciseId: string): string[] {
  if (!exerciseId.trim()) {
    throw new Error("exerciseId must be non-empty");
  }
  const current = loadExcluded();
  return current.includes(exerciseId) ? current : save([...current, exerciseId]);
}

export function restoreExercise(exerciseId: string): string[] {
  return save(loadExcluded().filter((id) => id !== exerciseId));
}
