import type { ExerciseMemory } from "../domain/types";
import { EXERCISE_GRAPH } from "../data/exerciseGraph";
import { levelForMove } from "../plan/levelDeclare";
import { loadPlanLevel } from "../plan/planLevel";
import { createKeyValueStore } from "../storage/keyValueStore";
import { LEVELS_TO_CONFIRM_KEY, MEMORY_KEY, MEMORY_V2_KEY } from "../storage/storageKeys";
import { migrateMemoriesV1 } from "./memoryMigration";

const v1Store = createKeyValueStore(MEMORY_KEY);
const v2Store = createKeyValueStore(MEMORY_V2_KEY);
const confirmStore = createKeyValueStore(LEVELS_TO_CONFIRM_KEY);

/** Tolerant parse: only a plain object counts; anything else leaves v1 untouched and unmigrated. */
function parseV1(raw: string): Record<string, ExerciseMemory> | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    const isPlainObject = typeof parsed === "object" && parsed !== null && !Array.isArray(parsed);
    return isPlainObject ? (parsed as Record<string, ExerciseMemory>) : null;
  } catch {
    return null;
  }
}

/** Run once at boot, before anything loads memory: build memory v2 from the raw v1 store if v2 does not exist yet. */
export function ensureMemoryMigrated(now: Date = new Date()): void {
  if (v2Store.read()) {
    return;
  }
  const raw = v1Store.read();
  if (!raw) {
    return;
  }
  const v1 = parseV1(raw);
  if (!v1) {
    console.warn("Aurora: memory v1 unreadable; migration skipped");
    return;
  }
  const planLevel = loadPlanLevel();
  const { memories, levelsToConfirm } = migrateMemoriesV1(v1, {
    now,
    planLevelFor: (id) => {
      const exercise = EXERCISE_GRAPH[id];
      return exercise && planLevel !== "auto" ? levelForMove(exercise, planLevel) : undefined;
    },
    standardsOf: (id) => EXERCISE_GRAPH[id]?.standards ?? null,
  });
  v2Store.write(JSON.stringify(memories));
  confirmStore.write(JSON.stringify(levelsToConfirm));
}

export function loadLevelsToConfirm(): string[] {
  try {
    const raw = confirmStore.read();
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function clearLevelsToConfirm(): void {
  confirmStore.write("[]");
}
