import {
  SEED_GRAPH,
  STARTER_PROGRAM,
  type LoadRegion,
  type SeedExercise,
  type StarterProgram,
} from "../data/seed";
import type {
  Dose,
  ExerciseMemory,
  Readiness,
  ResolveResult,
} from "../domain/types";
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
  slot: StarterProgram["slots"][number],
  readiness: Readiness,
  memories: Record<string, ExerciseMemory>,
): PlannedWorkItem {
  const exercise = SEED_GRAPH[slot.exerciseId];
  if (!exercise) {
    throw new Error(`Unknown exercise for slot ${slot.id}: ${slot.exerciseId}`);
  }
  const resolved = resolveSlot({
    exercise,
    memory: memories[slot.exerciseId] ?? emptyMemory(slot.exerciseId),
    readiness,
    dose: { ...slot.dose },
    pinned: slot.pinned,
    weakLinks: [],
    graph: SEED_GRAPH,
  });
  const chosen = SEED_GRAPH[resolved.exerciseId] ?? exercise;
  return {
    slotId: slot.id,
    label: slot.label,
    exerciseId: chosen.id,
    exerciseName: chosen.name,
    dose: resolved.dose,
    restSeconds: slot.restSeconds,
    ruleIds: resolved.ruleIds,
    reason: resolved.reason,
    doodlePath: chosen.doodlePath,
    cues: chosen.cues,
  };
}

/**
 * Freezes today's session: warmup + resolved working slots.
 */
export function planSession(
  readiness: Readiness,
  program: StarterProgram = STARTER_PROGRAM,
  memories: Record<string, ExerciseMemory> = {},
): PlannedSession {
  const work = program.slots.map((slot) => planWorkItem(slot, readiness, memories));
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
