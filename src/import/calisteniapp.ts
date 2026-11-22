/**
 * Calisteniapp sessions → Aurora history and levels (#291).
 * See docs/superpowers/specs/2026-11-22-import-calisteniapp-history-design.md.
 */
import { sessionAgeWeight } from "../body/aggregate";
import type { CalisteniappMapping } from "../data/import/calisteniappMap";
import type { HistoryEntry, HistorySetRecord, SessionEvaluation } from "../domain/program";
import type { Exercise, ExerciseMemory } from "../domain/types";
import { maxOf, ageInDays, refreshSkillTier } from "../progress/levelEvidence";
import { applySetLogToMemory, recordBestReps } from "../session/history";
import type { SetLogEntry } from "../session/setLog";

export const IMPORT_TEMPLATE_ID = "import:calisteniapp";

export interface CalisteniappSet {
  set: number;
  result: string | null;
  weight: string | null;
  effort: string | null;
}

export interface CalisteniappExercise {
  name: string;
  target: string;
  sets: CalisteniappSet[];
}

export interface CalisteniappSession {
  title: string;
  /** YYYY-MM-DD, estimated from the app's relative date. */
  date_estimated: string;
  summary?: Record<string, string>;
  exercises: CalisteniappExercise[];
}

export type ImportedEntry = Omit<HistoryEntry, "id"> & { source: NonNullable<HistoryEntry["source"]> };

export interface ImportSkip {
  name: string;
  reason: "unmapped" | "kind_mismatch" | "no_result";
  sets: number;
}

export interface ImportPlan {
  entries: ImportedEntry[];
  skipped: ImportSkip[];
}

export interface ParsedResult {
  kind: "reps" | "hold";
  value: number;
}

/** "12 reps" → reps 12; `20"` → hold 20; `1' 30"` → hold 90. */
export function parseResult(text: string | null): ParsedResult | null {
  const value = text?.trim() ?? "";
  const reps = /^(\d+) ?reps?$/i.exec(value);
  if (reps) {
    return { kind: "reps", value: Number(reps[1]) };
  }
  const minutes = /^(\d+)['′]/.exec(value);
  const seconds = /(?:^|\D)(\d{1,4})["″]$/.exec(value);
  if (!minutes && !seconds) {
    return null;
  }
  return { kind: "hold", value: Number(minutes?.[1] ?? 0) * 60 + Number(seconds?.[1] ?? 0) };
}

/** The dose number in a target such as "5 sets · 18–20 reps · 12.0 kg" (low end) or `5 sets · 20"`. */
export function targetNumber(target: string): number | undefined {
  for (const part of target.split("·").slice(1)) {
    const trimmed = part.trim();
    if (/reps?$|["″]$/.test(trimmed)) {
      const first = /^\d+/.exec(trimmed);
      if (first) {
        return Number(first[0]);
      }
    }
  }
  return undefined;
}

function hasAddedWeight(weight: string | null): boolean {
  const match = weight ? /^(\d+(?:\.\d+)?) ?kg$/i.exec(weight.trim()) : null;
  return match !== null && Number(match[1]) > 0;
}

const EFFORT_TO_EVALUATION: Record<string, SessionEvaluation> = {
  easy: "easy",
  moderate: "on_target",
  medium: "on_target",
  demanding: "difficult",
  hard: "difficult",
  "very hard": "wiped",
};

function evaluationFor(session: CalisteniappSession): SessionEvaluation {
  return EFFORT_TO_EVALUATION[(session.summary?.Effort ?? "").trim().toLowerCase()] ?? "on_target";
}

function addSkip(skips: Map<string, ImportSkip>, name: string, reason: ImportSkip["reason"]): void {
  const key = `${name}|${reason}`;
  const current = skips.get(key) ?? { name, reason, sets: 0 };
  skips.set(key, { ...current, sets: current.sets + 1 });
}

type SetOutcome = HistorySetRecord | ImportSkip["reason"];

function mapSet(
  baseId: string | null,
  set: CalisteniappSet,
  prescribed: number | undefined,
  completedAt: string,
  graph: Readonly<Record<string, Exercise>>,
): SetOutcome {
  if (!baseId || !graph[baseId]) {
    return "unmapped";
  }
  const result = parseResult(set.result);
  if (!result) {
    return "no_result";
  }
  const exerciseId = hasAddedWeight(set.weight) ? (graph[baseId]!.weightedId ?? baseId) : baseId;
  if ((graph[exerciseId]?.type === "isometric") !== (result.kind === "hold")) {
    return "kind_mismatch";
  }
  return {
    exerciseId,
    setIndex: set.set,
    prescribedReps: prescribed ?? result.value,
    completedReps: result.value,
    loggedAt: completedAt,
    stopReason: "completed",
  };
}

function sessionSets(
  session: CalisteniappSession,
  completedAt: string,
  map: Readonly<Record<string, CalisteniappMapping>>,
  graph: Readonly<Record<string, Exercise>>,
  skips: Map<string, ImportSkip>,
): HistorySetRecord[] {
  const sets: HistorySetRecord[] = [];
  for (const exercise of session.exercises) {
    const baseId = map[exercise.name]?.id ?? null;
    const prescribed = targetNumber(exercise.target);
    for (const set of exercise.sets) {
      const outcome = mapSet(baseId, set, prescribed, completedAt, graph);
      if (typeof outcome === "string") {
        addSkip(skips, exercise.name, outcome);
      } else {
        sets.push(outcome);
      }
    }
  }
  return sets;
}

/** Map sessions to history entries; nothing is saved here. */
export function planCalisteniappImport(
  sessions: readonly CalisteniappSession[],
  map: Readonly<Record<string, CalisteniappMapping>>,
  graph: Readonly<Record<string, Exercise>>,
): ImportPlan {
  const skips = new Map<string, ImportSkip>();
  const entries: ImportedEntry[] = [];
  const keyCounts = new Map<string, number>();
  for (const session of sessions) {
    const completedAt = `${session.date_estimated}T12:00:00.000Z`;
    const sets = sessionSets(session, completedAt, map, graph, skips);
    if (sets.length === 0) {
      continue;
    }
    const baseKey = `${session.date_estimated}|${session.title}`;
    const seen = (keyCounts.get(baseKey) ?? 0) + 1;
    keyCounts.set(baseKey, seen);
    entries.push({
      completedAt,
      templateId: IMPORT_TEMPLATE_ID,
      templateName: session.title,
      evaluation: evaluationFor(session),
      setCount: sets.length,
      exerciseIds: [...new Set(sets.map((s) => s.exerciseId))],
      sets,
      source: { app: "calisteniapp", key: seen === 1 ? baseKey : `${baseKey}#${seen}` },
    });
  }
  return { entries, skipped: [...skips.values()] };
}

/** Library ids whose imported sets count only in history (every mapping to them says `levels: false`). */
export function historyOnlyIds(map: Readonly<Record<string, CalisteniappMapping>>): Set<string> {
  const counted = new Set<string>();
  const historyOnly = new Set<string>();
  for (const mapping of Object.values(map)) {
    if (mapping.id) {
      (mapping.levels === false ? historyOnly : counted).add(mapping.id);
    }
  }
  return new Set([...historyOnly].filter((id) => !counted.has(id)));
}

/**
 * Replay imported sessions oldest first through the live level path into a fresh
 * memory map. Each result is scaled by the detraining curve for its age, and
 * evidence is stamped with the session date.
 */
export function replayImportedLevels(
  entries: ReadonlyArray<Omit<HistoryEntry, "id">>,
  now: Date,
  skipIds: ReadonlySet<string> = new Set(),
): Record<string, ExerciseMemory> {
  let memories: Record<string, ExerciseMemory> = {};
  const ordered = [...entries].sort((a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt));
  for (const entry of ordered) {
    const at = new Date(entry.completedAt);
    const weight = sessionAgeWeight(ageInDays(entry.completedAt, now));
    const log: SetLogEntry[] = [];
    for (const set of (entry.sets ?? []).filter((s) => !skipIds.has(s.exerciseId))) {
      const counted = Math.floor(set.completedReps * weight);
      if (counted > 0) {
        memories = recordBestReps(memories, set.exerciseId, counted, undefined, at);
      }
      log.push({
        id: `${entry.completedAt}-${set.exerciseId}-${set.setIndex}`,
        slotId: set.exerciseId,
        exerciseId: set.exerciseId,
        setIndex: set.setIndex,
        prescribedReps: set.prescribedReps,
        completedReps: counted,
        addedLoadKg: 0,
        stopReason: "completed",
        loggedAt: entry.completedAt,
      });
    }
    memories = applySetLogToMemory(memories, { entries: log }, { now: at });
  }
  return memories;
}

function laterIso(a: string | undefined, b: string | undefined): string | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return Date.parse(a) >= Date.parse(b) ? a : b;
}

/**
 * Merge replayed imported memories into the live ones: a move without a live row
 * takes the imported row; a live row keeps its state and only takes the higher
 * best and logged tier.
 */
export function mergeImportedMemories(
  live: Readonly<Record<string, ExerciseMemory>>,
  imported: Readonly<Record<string, ExerciseMemory>>,
  now: Date,
): Record<string, ExerciseMemory> {
  const next: Record<string, ExerciseMemory> = { ...live };
  for (const [id, row] of Object.entries(imported)) {
    const current = live[id];
    if (!current) {
      next[id] = refreshSkillTier(row, now);
      continue;
    }
    const bestReps = Math.max(current.bestReps ?? 0, row.bestReps ?? 0);
    next[id] = refreshSkillTier(
      {
        ...current,
        ...(bestReps > 0 ? { bestReps } : {}),
        ...(maxOf([current.loggedTier, row.loggedTier]) ? { loggedTier: maxOf([current.loggedTier, row.loggedTier]) } : {}),
        ...(laterIso(current.lastSessionAt, row.lastSessionAt) ? { lastSessionAt: laterIso(current.lastSessionAt, row.lastSessionAt) } : {}),
      },
      now,
    );
  }
  return next;
}
