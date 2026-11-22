/**
 * One-off history load (#291): a local build may bundle the athlete's own
 * `src/data/private/calisteniapp-history.json` (git-ignored). At start-up its
 * sessions are merged into history and levels once; applied keys are remembered.
 */
import { CALISTENIAPP_MAP } from "../data/import/calisteniappMap";
import { EXERCISE_GRAPH } from "../data/exerciseGraph";
import { loadHistory, loadMemories, mergeHistory, saveHistory, saveMemories } from "../session/history";
import { createKeyValueStore, readJson } from "../storage/keyValueStore";
import { IMPORTED_SESSIONS_KEY } from "../storage/storageKeys";
import {
  mergeImportedMemories,
  planCalisteniappImport,
  replayImportedLevels,
  type CalisteniappSession,
  type ImportSkip,
} from "./calisteniapp";

const appliedStore = createKeyValueStore(IMPORTED_SESSIONS_KEY);

export interface ApplyImportResult {
  added: number;
  sets: number;
  skipped: ImportSkip[];
}

export function applyCalisteniappImport(
  sessions: readonly CalisteniappSession[],
  now: Date = new Date(),
): ApplyImportResult {
  const applied = new Set(readJson(appliedStore, [] as string[]));
  const plan = planCalisteniappImport(sessions, CALISTENIAPP_MAP, EXERCISE_GRAPH);
  const fresh = plan.entries.filter((entry) => !applied.has(entry.source.key));
  if (fresh.length === 0) {
    return { added: 0, sets: 0, skipped: plan.skipped };
  }
  const merged = mergeHistory(loadHistory(), fresh.map(({ levelsSkip: _skip, ...entry }) => entry));
  saveHistory(merged.history);
  saveMemories(mergeImportedMemories(loadMemories(now), replayImportedLevels(fresh, now), now));
  for (const entry of fresh) {
    applied.add(entry.source.key);
  }
  appliedStore.write(JSON.stringify([...applied]));
  return { added: merged.added, sets: fresh.reduce((n, e) => n + e.setCount, 0), skipped: plan.skipped };
}

const bundled = import.meta.glob<CalisteniappSession[]>("../data/private/calisteniapp-history.json", {
  eager: true,
  import: "default",
});

/** Apply the bundled file if this build has one; no-op otherwise. */
export function applyBundledImport(now: Date = new Date()): ApplyImportResult | null {
  const sessions = Object.values(bundled)[0];
  return sessions ? applyCalisteniappImport(sessions, now) : null;
}
