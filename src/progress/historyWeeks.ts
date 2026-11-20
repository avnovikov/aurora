import type { SessionEvaluation } from "../domain/program";
import type { HistorySessionBlock } from "./historySessionBlocks";

/** Effort bar height: easy 1, on target 2, difficult 3, wiped 4; 0 is a rest day. */
export type EffortLevel = 0 | 1 | 2 | 3 | 4;

const EFFORT_LEVELS: Record<SessionEvaluation, Exclude<EffortLevel, 0>> = {
  easy: 1,
  on_target: 2,
  difficult: 3,
  wiped: 4,
};

export function effortLevel(evaluation: SessionEvaluation): Exclude<EffortLevel, 0> {
  return EFFORT_LEVELS[evaluation];
}

export interface HistoryWeekDay {
  /** Strip label, e.g. "M 17". */
  label: string;
  /** Long form for screen readers, e.g. "Mon 17 Nov". */
  longLabel: string;
  /** Hardest session that day; 0 when no session. */
  level: EffortLevel;
  /** Newest session that day; absent on rest days. */
  sessionId?: string;
}

export interface HistoryCardExercise {
  exerciseId: string;
  name: string;
  /** Reps per set as stored; absent on summary-only sessions. */
  reps?: number[];
  averageBpm?: number;
  /** The athlete's personal best (ExerciseMemory.bestReps); absent when none. */
  personalBest?: number;
  /** This session's top set beats every set stored for it in earlier sessions. */
  newPersonalBest?: boolean;
}

export interface HistorySessionCard {
  sessionId: string;
  /** "Wed 19 Nov · 18:10" in local time. */
  title: string;
  templateName: string;
  evaluation: SessionEvaluation;
  strapWorn: boolean;
  /** Summary-only (legacy) sessions only: total sets stored on the session, 0 when unknown. */
  setsLogged?: number;
  exercises: HistoryCardExercise[];
}

export interface HistoryWeek {
  /** "w/c 17 Nov". */
  label: string;
  /** Long form for screen readers, e.g. "Week commencing 17 November". */
  longLabel: string;
  current: boolean;
  days: HistoryWeekDay[];
  sessions: HistorySessionCard[];
}

export interface HistoryWeeksModel {
  weeks: HistoryWeek[];
}

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;
const MONTH_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

/**
 * Group session blocks into Monday-start local weeks, newest first, with a
 * Mon–Sun effort strip and session cards. "new PB" is claimed only against
 * real stored sets of earlier sessions; nothing is invented.
 */
export function buildHistoryWeeks(input: {
  blocks: readonly HistorySessionBlock[];
  now?: Date;
  /** Stored memory per exercise id (loadMemories shape); bestReps may lag history. */
  memories?: Readonly<Record<string, { bestReps?: number }>>;
}): HistoryWeeksModel {
  const now = input.now ?? new Date();
  const dated = input.blocks
    .map((block) => ({ block, at: new Date(block.completedAt) }))
    .filter((row) => !Number.isNaN(row.at.getTime()))
    .sort((a, b) => b.at.getTime() - a.at.getTime());
  const { personalBests, newPersonalBests } = personalBestsFor(dated, input.memories ?? {});

  // Rows are newest first, so Map insertion order keeps weeks newest first.
  const groups = new Map<number, typeof dated>();
  for (const row of dated) {
    const start = weekStart(row.at).getTime();
    const group = groups.get(start);
    if (group) {
      group.push(row);
    } else {
      groups.set(start, [row]);
    }
  }

  const currentWeekStart = weekStart(now).getTime();
  const weeks = [...groups].map(([startMs, rows]): HistoryWeek => {
    const start = new Date(startMs);
    return {
      label: `w/c ${start.getDate()} ${MONTH_SHORT[start.getMonth()]}`,
      longLabel: `Week commencing ${start.getDate()} ${MONTH_LONG[start.getMonth()]}`,
      current: startMs === currentWeekStart,
      days: weekDays(start, rows),
      sessions: rows.map((row) => sessionCard(row.block, row.at, personalBests, newPersonalBests)),
    };
  });

  return { weeks };
}

/** Monday 00:00 local time of the week containing `date`. */
export function weekStart(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const sinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - sinceMonday);
  return start;
}

function weekDays(
  start: Date,
  rows: readonly { block: HistorySessionBlock; at: Date }[],
): HistoryWeekDay[] {
  // Rows are newest first: the first row seen for a day is its newest session,
  // and only a strictly harder one displaces the hardest.
  const newest: ({ block: HistorySessionBlock } | undefined)[] = Array(7).fill(undefined);
  const hardest: ({ block: HistorySessionBlock } | undefined)[] = Array(7).fill(undefined);
  for (const row of rows) {
    const i = (row.at.getDay() + 6) % 7;
    newest[i] ??= row;
    const best = hardest[i];
    if (!best || effortLevel(row.block.evaluation) > effortLevel(best.block.evaluation)) {
      hardest[i] = row;
    }
  }

  return newest.map((row, i): HistoryWeekDay => {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const label = `${DAY_SHORT[day.getDay()]!.charAt(0)} ${day.getDate()}`;
    const longLabel = dateLabel(day);
    if (!row) {
      return { label, longLabel, level: 0 };
    }
    return {
      label,
      longLabel,
      level: effortLevel(hardest[i]!.block.evaluation),
      sessionId: row.block.sessionId,
    };
  });
}

function sessionCard(
  block: HistorySessionBlock,
  at: Date,
  personalBests: ReadonlyMap<string, number>,
  newPersonalBests: ReadonlyMap<string, ReadonlySet<string>>,
): HistorySessionCard {
  const base = {
    sessionId: block.sessionId,
    title: `${dateLabel(at)} · ${pad2(at.getHours())}:${pad2(at.getMinutes())}`,
    templateName: block.templateName,
    evaluation: block.evaluation,
    strapWorn: Boolean(block.pulse && block.pulse.series.length > 0),
  };

  if (block.legacy) {
    return {
      ...base,
      setsLogged: block.legacyRows[0]?.sessionSetCount ?? 0,
      exercises: block.legacyRows.map((row) => ({
        exerciseId: row.exerciseId,
        name: row.exerciseName,
      })),
    };
  }

  return {
    ...base,
    exercises: block.exercises.map((exercise): HistoryCardExercise => {
      const personalBest = personalBests.get(exercise.exerciseId);
      return {
        exerciseId: exercise.exerciseId,
        name: exercise.exerciseName,
        reps: exercise.completedRepsBySet,
        ...(exercise.averageBpm !== undefined ? { averageBpm: exercise.averageBpm } : {}),
        ...(personalBest !== undefined ? { personalBest } : {}),
        ...(newPersonalBests.get(block.sessionId)?.has(exercise.exerciseId)
          ? { newPersonalBest: true }
          : {}),
      };
    }),
  };
}

/**
 * One oldest-first pass over stored sets. PB shown on a row is the higher of
 * the stored bestReps and the best stored set in history, since bestReps can
 * lag behind or be missing for seeded/old data. "new PB" is claimed only when
 * earlier stored sets exist and this session's top set beats them all.
 */
function personalBestsFor(
  newestFirst: readonly { block: HistorySessionBlock }[],
  memories: Readonly<Record<string, { bestReps?: number }>>,
): { personalBests: Map<string, number>; newPersonalBests: Map<string, Set<string>> } {
  const personalBests = new Map<string, number>();
  const newPersonalBests = new Map<string, Set<string>>();
  for (let i = newestFirst.length - 1; i >= 0; i -= 1) {
    const { block } = newestFirst[i]!;
    if (block.legacy) {
      continue;
    }
    for (const exercise of block.exercises) {
      if (exercise.completedRepsBySet.length === 0) {
        continue;
      }
      const top = Math.max(...exercise.completedRepsBySet);
      const earlier = personalBests.get(exercise.exerciseId);
      if (earlier !== undefined && top > earlier) {
        addToSet(newPersonalBests, block.sessionId, exercise.exerciseId);
      }
      personalBests.set(exercise.exerciseId, Math.max(earlier ?? top, top));
    }
  }

  raiseToStoredBests(personalBests, memories);
  return { personalBests, newPersonalBests };
}

function raiseToStoredBests(
  personalBests: Map<string, number>,
  memories: Readonly<Record<string, { bestReps?: number }>>,
): void {
  for (const [exerciseId, { bestReps }] of Object.entries(memories)) {
    if (bestReps !== undefined) {
      personalBests.set(exerciseId, Math.max(bestReps, personalBests.get(exerciseId) ?? bestReps));
    }
  }
}

function addToSet(sets: Map<string, Set<string>>, key: string, value: string): void {
  const set = sets.get(key) ?? new Set<string>();
  set.add(value);
  sets.set(key, set);
}

function dateLabel(date: Date): string {
  return `${DAY_SHORT[date.getDay()]} ${date.getDate()} ${MONTH_SHORT[date.getMonth()]}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
