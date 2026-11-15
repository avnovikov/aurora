import {
  SEED_GRAPH,
  STARTER_PROGRAM,
  type LoadRegion,
  type SeedExercise,
  type SeedSlot,
  type StarterProgram,
} from "../data/seed";
import type { HistoryEntry, SessionFocus } from "../domain/program";
import type {
  Dose,
  ExerciseMemory,
  Readiness,
  ResolveResult,
} from "../domain/types";
import {
  lastConsecutiveSameZone,
  pickSlotExerciseForVariety,
} from "./consecutiveVariety";
import { resolveSlot } from "./resolveSlot";
import { planWarmup, type WarmupStep } from "./warmupPlan";

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
}

export interface PlannedSession {
  programId: string;
  sessionLabel: string;
  readiness: Readiness;
  warmup: WarmupStep[];
  work: PlannedWorkItem[];
  lightDay: boolean;
  /** True when a manual deload week shaped this session. */
  deload: boolean;
}

export interface PlanSessionOptions {
  history?: readonly HistoryEntry[];
  focus?: SessionFocus;
  /** Manual deload week: light-day dose, no progression advance. */
  deloadActive?: boolean;
}

/** Inputs shared by every slot in one planned session. */
interface SlotContext {
  readiness: Readiness;
  memories: Record<string, ExerciseMemory>;
  deloadActive: boolean;
}

function emptyMemory(exerciseId: string): ExerciseMemory {
  return {
    exerciseId,
    sessionsAtStandard: 0,
    sessionsBelowFloor: 0,
    lastAddedLoadKg: 0,
    weakLinkSessionsRemaining: 0,
    skillTier: "beginner",
  };
}

function focusRegionsFromSlots(program: StarterProgram): LoadRegion[] {
  const regions = new Set<LoadRegion>();
  for (const slot of program.slots) {
    const exercise = SEED_GRAPH[slot.exerciseId];
    exercise?.regions.forEach((region) => {
      if (region !== "general") {
        regions.add(region);
      }
    });
  }
  return [...regions];
}

function warmupPool(program: StarterProgram): SeedExercise[] {
  return program.warmupExerciseIds
    .map((id) => SEED_GRAPH[id])
    .filter((item): item is SeedExercise => Boolean(item));
}

function planWorkItem(
  slot: SeedSlot,
  exerciseId: string,
  context: SlotContext,
  varietyReason?: string,
): PlannedWorkItem {
  const exercise = SEED_GRAPH[exerciseId];
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
    graph: SEED_GRAPH,
    deloadActive: context.deloadActive,
  });
  const chosen = SEED_GRAPH[resolved.exerciseId] ?? exercise;
  const reason = varietyReason
    ? `${resolved.reason} · ${varietyReason}`
    : resolved.reason;
  return {
    slotId: slot.id,
    label: slot.label,
    exerciseId: chosen.id,
    exerciseName: chosen.name,
    dose: resolved.dose,
    restSeconds: slot.restSeconds,
    ruleIds: resolved.ruleIds,
    reason,
    doodlePath: chosen.doodlePath,
    cues: chosen.cues,
  };
}

function planWorkWithVariety(
  program: StarterProgram,
  context: SlotContext,
  previousExerciseIds: readonly string[] | null,
): PlannedWorkItem[] {
  if (!previousExerciseIds || previousExerciseIds.length === 0) {
    return program.slots.map((slot) =>
      planWorkItem(slot, slot.exerciseId, context),
    );
  }

  const chosenToday = new Set<string>();
  return program.slots.map((slot) => {
    const pick = pickSlotExerciseForVariety(
      slot,
      previousExerciseIds,
      chosenToday,
    );
    chosenToday.add(pick.exerciseId);
    return planWorkItem(
      slot,
      pick.exerciseId,
      context,
      pick.swapped ? pick.reason : undefined,
    );
  });
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
    { readiness, memories, deloadActive },
    previous?.exerciseIds ?? null,
  );
  const warmup = planWarmup({
    pool: warmupPool(program),
    focusRegions: focusRegionsFromSlots(program),
  });
  return {
    programId: program.id,
    sessionLabel: program.sessionLabel,
    readiness,
    warmup,
    work,
    lightDay: work.some((item) => item.ruleIds.includes("light_day")),
    deload: deloadActive,
  };
}
