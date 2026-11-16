import { EXERCISE_GRAPH } from "../data/exerciseGraph";
import {
  STARTER_PROGRAM,
  type SeedExercise,
  type SeedSlot,
  type StarterProgram,
} from "../data/seed";
import { stationsFor, type WarmupStation } from "../data/warmupStations";
import type {
  EquipmentId,
  HistoryEntry,
  JointHistoryEntry,
  SessionFocus,
  WarmupLevel,
} from "../domain/program";
import type {
  Dose,
  ExerciseMemory,
  Readiness,
  ResolveResult,
  RuleId,
} from "../domain/types";
import { chooseSuitableExercise, type SuitableChoice } from "../safety/suitableExercise";
import { emptyMemory } from "../session/history";
import {
  findSlotAlternate,
  lastConsecutiveSameZone,
  pickSlotExerciseForVariety,
} from "./consecutiveVariety";
import { resolveSlot } from "./resolveSlot";
import { warmupLevelFor } from "./warmupLevel";
import { buildCooldownView, buildWarmupView, type WarmupStep } from "./warmupPlan";

export interface PlannedWorkItem {
  slotId: string;
  label: string;
  exerciseId: string;
  exerciseName: string;
  dose: Dose;
  restSeconds: number;
  ruleIds: ResolveResult["ruleIds"];
  reason: string;
  doodlePath?: string;
  cues: string[];
  /** One-line description and how-to steps from the curated Library text. */
  summary?: string;
  steps?: string[];
  /** Past-injury notes to keep in mind on this move (may be empty). */
  cautions: string[];
}

export interface PlannedSession {
  programId: string;
  sessionLabel: string;
  readiness: Readiness;
  /**
   * One-tap warmup mini-session (own stations + timings).
   * Not work prescriptions; runs before `work`.
   */
  warmup: WarmupStep[];
  /** Level the warm-up was picked for (older persisted sessions may lack it). */
  warmupLevel?: WarmupLevel;
  work: PlannedWorkItem[];
  /**
   * Optional cool-down stretches offered after the last work item (may be empty).
   * Older persisted sessions may lack it.
   */
  cooldown?: WarmupStep[];
  lightDay: boolean;
  /** True when a manual deload week shaped this session. */
  deload: boolean;
}

export interface PlanSessionOptions {
  history?: readonly HistoryEntry[];
  focus?: SessionFocus;
  /** Manual deload week: light-day dose, no progression advance. */
  deloadActive?: boolean;
  /** Past joint injuries; unsafe moves are swapped, risky ones flagged. */
  jointHistory?: readonly JointHistoryEntry[];
  /** Gear the user owns; moves needing other gear are swapped out. */
  equipment?: readonly EquipmentId[];
  /** Exercise ids the user never wants planned; swapped for a substitute. */
  excluded?: readonly string[];
  /** Overrides the level derived from the athlete's tier in the target family. */
  warmupLevel?: WarmupLevel;
}

/** Inputs shared by every slot in one planned session. */
interface SlotContext {
  readiness: Readiness;
  memories: Record<string, ExerciseMemory>;
  deloadActive: boolean;
  jointHistory: readonly JointHistoryEntry[];
  equipment?: readonly EquipmentId[];
  excluded: readonly string[];
}

function warmupStationsFor(program: StarterProgram, level: WarmupLevel): WarmupStation[] {
  return stationsFor(program.warmupByLevel[level], program.warmupHoldSeconds);
}

function cooldownStationsFor(program: StarterProgram): WarmupStation[] {
  return stationsFor(program.cooldownStationIds ?? []);
}

const SWAP_RULE = {
  excluded: "excluded",
  gear: "equipment",
  joints: "joint_history",
} as const satisfies Record<NonNullable<SuitableChoice["cause"]>, RuleId>;

/** Caller's level, else the athlete's tier in the target family (unknown → beginner). */
function pickWarmupLevel(
  program: StarterProgram,
  memories: Record<string, ExerciseMemory>,
  override: WarmupLevel | undefined,
): WarmupLevel {
  return override ?? warmupLevelFor({ targetExerciseIds: program.targetExerciseIds ?? [], memories });
}


/** What joint, gear and exclusion care did to a resolved move: the final move, why, and notes. */
interface CareOutcome {
  chosen: SeedExercise;
  reason: string;
  ruleIds: RuleId[];
  cautions: string[];
}

function applyCare(
  resolved: ResolveResult,
  resolvedExercise: SeedExercise,
  varietyReason: string | undefined,
  context: SlotContext,
): CareOutcome {
  const care = chooseSuitableExercise(
    resolvedExercise,
    context.jointHistory,
    context.equipment,
    context.excluded,
  );
  const chosen = EXERCISE_GRAPH[care.id] ?? resolvedExercise;
  const baseReason = varietyReason ? `${resolved.reason} · ${varietyReason}` : resolved.reason;
  if (!care.swappedFrom) {
    return { chosen, reason: baseReason, ruleIds: resolved.ruleIds, cautions: care.cautions };
  }
  const swapRule = SWAP_RULE[care.cause ?? "joints"];
  return {
    chosen,
    reason: `${baseReason} · ${care.reason}`,
    ruleIds: [...resolved.ruleIds, swapRule],
    cautions: care.cautions,
  };
}

function planWorkItem(
  slot: SeedSlot,
  exerciseId: string,
  context: SlotContext,
  varietyReason?: string,
): PlannedWorkItem {
  const exercise = EXERCISE_GRAPH[exerciseId];
  if (!exercise) {
    throw new Error(`Unknown exercise for slot ${slot.id}: ${exerciseId}`);
  }
  const resolved = resolveSlot({
    exercise,
    memory: context.memories[exerciseId] ?? emptyMemory(exerciseId),
    readiness: context.readiness,
    dose: { ...slot.dose },
    pinned: slot.pinned,
    weakLinks: [],
    graph: EXERCISE_GRAPH,
    deloadActive: context.deloadActive,
  });
  const resolvedExercise = EXERCISE_GRAPH[resolved.exerciseId] ?? exercise;
  const { chosen, reason, ruleIds, cautions } = applyCare(
    resolved,
    resolvedExercise,
    varietyReason,
    context,
  );
  return {
    slotId: slot.id,
    label: slot.label,
    exerciseId: chosen.id,
    exerciseName: chosen.name,
    dose: resolved.dose,
    restSeconds: slot.restSeconds,
    ruleIds,
    reason,
    doodlePath: chosen.doodlePath,
    cues: chosen.cues,
    summary: chosen.description,
    steps: chosen.steps,
    cautions,
  };
}

/** True when this slot may repeat a move already used earlier today. */
function allowsSameDayRepeat(slot: SeedSlot): boolean {
  return slot.allowConsecutiveRepeat === true || slot.pinned === true;
}

/**
 * Plan each slot, then if resolve/care landed on a move already used today,
 * swap the later slot to another valid move (unless the slot may repeat).
 */
function planWorkWithVariety(
  program: StarterProgram,
  context: SlotContext,
  previousExerciseIds: readonly string[] | null,
): PlannedWorkItem[] {
  const usedToday = new Set<string>();
  const previous = previousExerciseIds ?? [];
  const hasPrevious = previous.length > 0;

  return program.slots.map((slot) => {
    let startId = slot.exerciseId;
    let varietyReason: string | undefined;

    if (hasPrevious) {
      const pick = pickSlotExerciseForVariety(slot, previous, usedToday);
      startId = pick.exerciseId;
      if (pick.swapped) {
        varietyReason = pick.reason;
      }
    }

    let item = planWorkItem(slot, startId, context, varietyReason);

    if (usedToday.has(item.exerciseId) && !allowsSameDayRepeat(slot)) {
      item = swapAwayDuplicate(slot, item, context, usedToday, previous);
    }

    usedToday.add(item.exerciseId);
    return item;
  });
}

/** Replace a colliding move with another valid one; keeps the original if none fit. */
function swapAwayDuplicate(
  slot: SeedSlot,
  item: PlannedWorkItem,
  context: SlotContext,
  usedToday: ReadonlySet<string>,
  previous: readonly string[],
): PlannedWorkItem {
  const yesterday = new Set(previous);
  // Prefer an alternate for the slot's pattern; if resolve lands on another
  // used id, try once more from that landing point.
  let preferredId = slot.exerciseId;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const alternate = findSlotAlternate(
      { pattern: slot.pattern, exerciseId: preferredId },
      usedToday,
      yesterday,
    );
    if (!alternate) {
      return item;
    }
    const swapped = planWorkItem(
      slot,
      alternate.id,
      context,
      `Same-day duplicate · ${alternate.name}`,
    );
    if (!usedToday.has(swapped.exerciseId)) {
      return {
        ...swapped,
        ruleIds: swapped.ruleIds.includes("same_day_duplicate")
          ? swapped.ruleIds
          : [...swapped.ruleIds, "same_day_duplicate"],
      };
    }
    preferredId = swapped.exerciseId;
  }
  return item;
}

/**
 * Freezes today's session: warmup + resolved working slots.
 * When the last completed session was the same zone, non-anchor slots rotate.
 */
export function planSession(
  readiness: Readiness,
  program: StarterProgram = STARTER_PROGRAM,
  memories: Record<string, ExerciseMemory> = {},
  options: PlanSessionOptions = {},
): PlannedSession {
  const focus = options.focus;
  const previous =
    focus && options.history
      ? lastConsecutiveSameZone(options.history, focus)
      : null;
  const deloadActive = options.deloadActive === true;
  const work = planWorkWithVariety(
    program,
    {
      readiness,
      memories,
      deloadActive,
      jointHistory: options.jointHistory ?? [],
      equipment: options.equipment,
      excluded: options.excluded ?? [],
    },
    previous?.exerciseIds ?? null,
  );
  const warmupLevel = pickWarmupLevel(program, memories, options.warmupLevel);
  const warmup = buildWarmupView(warmupStationsFor(program, warmupLevel));
  const cooldown = buildCooldownView(cooldownStationsFor(program));
  return {
    programId: program.id,
    sessionLabel: program.sessionLabel,
    readiness,
    warmup,
    warmupLevel,
    work,
    cooldown,
    lightDay: work.some((item) => item.ruleIds.includes("light_day")),
    deload: deloadActive,
  };
}
