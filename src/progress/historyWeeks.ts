import type { SessionEvaluation } from "../domain/program";
import { sessionEvaluationLabel } from "../session/history";
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
  /** Effort word of the hardest session; absent on rest days. */
  effortLabel?: string;
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
  effortLabel: string;
  strapWorn: boolean;
  legacy: boolean;
  /** Summary-only sessions: total sets stored on the session. */
  setsLogged?: number;
  exercises: HistoryCardExercise[];
}

export interface HistoryWeek {
  /** "w/c 17 Nov". */
  label: string;
  /** Long form for screen readers, e.g. "Week commencing 17 November". */
  longLabel: string;
  current: boolean;
  count: number;
  days: HistoryWeekDay[];
  sessions: HistorySessionCard[];
}

export interface HistoryWeeksModel {
  sessionCount: number;
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
  /** Stored personal best per exercise id (ExerciseMemory.bestReps); may lag history. */
  personalBests?: Readonly<Record<string, number | undefined>>;
}): HistoryWeeksModel {
  const personalBests = mergedPersonalBests(input.blocks, input.personalBests ?? {});
  const now = input.now ?? new Date();
  const dated = input.blocks
    .map((block) => ({ block, at: new Date(block.completedAt) }))
    .filter((row) => !Number.isNaN(row.at.getTime()))
    .sort((a, b) => b.at.getTime() - a.at.getTime());

  const currentWeekStart = weekStart(now).getTime();
  const weeks: HistoryWeek[] = [];
  let open: { start: number; rows: typeof dated } | null = null;
  const groups: { start: number; rows: typeof dated }[] = [];

  for (const row of dated) {
    const start = weekStart(row.at).getTime();
    if (!open || open.start !== start) {
      open = { start, rows: [] };
      groups.push(open);
    }
    open.rows.push(row);
  }

  const olderOf = (index: number) => dated.slice(index + 1).map((row) => row.block);
  let index = 0;
  for (const group of groups) {
    const start = new Date(group.start);
    const sessions = group.rows.map((row) => {
      const card = sessionCard(row.block, row.at, olderOf(index), personalBests);
      index += 1;
      return card;
    });
    weeks.push({
      label: `w/c ${start.getDate()} ${MONTH_SHORT[start.getMonth()]}`,
      longLabel: `Week commencing ${start.getDate()} ${MONTH_LONG[start.getMonth()]}`,
      current: group.start === currentWeekStart,
      count: group.rows.length,
      days: weekDays(start, group.rows),
      sessions,
    });
  }

  return { sessionCount: dated.length, weeks };
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
  const days: HistoryWeekDay[] = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset);
    const onDay = rows.filter((row) => sameLocalDay(row.at, day));
    const longLabel = `${DAY_SHORT[day.getDay()]} ${day.getDate()} ${MONTH_SHORT[day.getMonth()]}`;
    const label = `${DAY_SHORT[day.getDay()]!.charAt(0)} ${day.getDate()}`;
    if (onDay.length === 0) {
      days.push({ label, longLabel, level: 0 });
      continue;
    }
    // Rows are newest first, so the first one is the newest that day.
    const hardest = onDay.reduce((best, row) =>
      effortLevel(row.block.evaluation) > effortLevel(best.block.evaluation) ? row : best,
    );
    days.push({
      label,
      longLabel,
      level: effortLevel(hardest.block.evaluation),
      effortLabel: sessionEvaluationLabel(hardest.block.evaluation),
      sessionId: onDay[0]!.block.sessionId,
    });
  }
  return days;
}

function sessionCard(
  block: HistorySessionBlock,
  at: Date,
  older: readonly HistorySessionBlock[],
  personalBests: Readonly<Record<string, number | undefined>>,
): HistorySessionCard {
  const base = {
    sessionId: block.sessionId,
    title: `${dateLabel(at)} · ${pad2(at.getHours())}:${pad2(at.getMinutes())}`,
    templateName: block.templateName,
    evaluation: block.evaluation,
    effortLabel: sessionEvaluationLabel(block.evaluation),
    strapWorn: Boolean(block.pulse && block.pulse.series.length > 0),
    legacy: block.legacy,
  };

  if (block.legacy) {
    const setsLogged = block.legacyRows[0]?.sessionSetCount ?? 0;
    return {
      ...base,
      ...(setsLogged > 0 ? { setsLogged } : {}),
      exercises: block.legacyRows.map((row) => ({
        exerciseId: row.exerciseId,
        name: row.exerciseName,
      })),
    };
  }

  return {
    ...base,
    exercises: block.exercises.map((exercise): HistoryCardExercise => {
      const personalBest = personalBests[exercise.exerciseId];
      return {
        exerciseId: exercise.exerciseId,
        name: exercise.exerciseName,
        reps: exercise.completedRepsBySet,
        ...(exercise.averageBpm !== undefined ? { averageBpm: exercise.averageBpm } : {}),
        ...(personalBest !== undefined ? { personalBest } : {}),
        ...(beatsEarlierSets(exercise.exerciseId, exercise.completedRepsBySet, older)
          ? { newPersonalBest: true }
          : {}),
      };
    }),
  };
}

/**
 * PB shown on a row: the higher of the stored bestReps and the best stored set
 * in history, since bestReps can lag behind or be missing for seeded/old data.
 */
function mergedPersonalBests(
  blocks: readonly HistorySessionBlock[],
  stored: Readonly<Record<string, number | undefined>>,
): Record<string, number | undefined> {
  const merged: Record<string, number | undefined> = { ...stored };
  for (const block of blocks) {
    if (block.legacy) {
      continue;
    }
    for (const exercise of block.exercises) {
      if (exercise.completedRepsBySet.length === 0) {
        continue;
      }
      const top = Math.max(...exercise.completedRepsBySet);
      const current = merged[exercise.exerciseId];
      merged[exercise.exerciseId] = current === undefined ? top : Math.max(current, top);
    }
  }
  return merged;
}

/** True only when earlier stored sets exist and this session's top set beats them all. */
function beatsEarlierSets(
  exerciseId: string,
  reps: readonly number[],
  older: readonly HistorySessionBlock[],
): boolean {
  const earlier = older
    .filter((candidate) => !candidate.legacy)
    .flatMap(
      (candidate) =>
        candidate.exercises.find((row) => row.exerciseId === exerciseId)?.completedRepsBySet ?? [],
    );
  if (earlier.length === 0 || reps.length === 0) {
    return false;
  }
  return Math.max(...reps) > Math.max(...earlier);
}

function dateLabel(date: Date): string {
  return `${DAY_SHORT[date.getDay()]} ${date.getDate()} ${MONTH_SHORT[date.getMonth()]}`;
}

function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
