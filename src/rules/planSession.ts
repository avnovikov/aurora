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
import { emptyMemory } from "../session/history";
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
}

export interface PlanSessionOptions {
  history?: readonly HistoryEntry[];
  focus?: SessionFocus;
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
  readiness: Readiness,
  memories: Record<string, ExerciseMemory>,
  varietyReason?: string,
): PlannedWorkItem {
  const exercise = SEED_GRAPH[exerciseId];
  if (!exercise) {
    throw new Error(`Unknown exercise for slot ${slot.id}: ${exerciseId}`);
  }
  const resolved = resolveSlot({
    exercise,
    memory: memories[exerciseId] ?? emptyMemory(exerciseId),
    readiness,
    dose: { ...slot.dose },
    pinned: slot.pinned,
    weakLinks: [],
    graph: SEED_GRAPH,
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
  readiness: Readiness,
  memories: Record<string, ExerciseMemory>,
  previousExerciseIds: readonly string[] | null,
): PlannedWorkItem[] {
  if (!previousExerciseIds || previousExerciseIds.length === 0) {
    return program.slots.map((slot) =>
      planWorkItem(slot, slot.exerciseId, readiness, memories),
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
      readiness,
      memories,
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
  const work = planWorkWithVariety(
    program,
    readiness,
    memories,
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
  };
}
