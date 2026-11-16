import { doodleFor } from "../data/doodles";
import { EXERCISE_GRAPH } from "../data/exerciseGraph";
import type { SeedExercise } from "../data/seed";
import {
  WARMUP_STATION_BY_ID,
  WARMUP_STATIONS,
  type WarmupStation,
} from "../data/warmupStations";
import { chooseSuitableExercise } from "../safety/suitableExercise";
import {
  expandWarmupStations,
  warmupStepExerciseId,
  withWarmupGaps,
  type WarmupStep,
} from "./warmupPlan";

/**
 * Replace excluded warm-up stations with similar ones (same RAMP phase first,
 * then the work exclusion ladder). Drop a station when nothing fits; keep the
 * warm-up non-empty when the catalogue still has a usable Raise.
 */
export function resolveWarmupStations(
  stations: readonly WarmupStation[],
  excluded: readonly string[],
  catalogue: readonly WarmupStation[] = WARMUP_STATIONS,
): WarmupStation[] {
  if (stations.length === 0) {
    return [];
  }
  if (excluded.length === 0) {
    return [...stations];
  }

  const excludedIds = new Set(excluded);
  const resolved: WarmupStation[] = [];
  for (let index = 0; index < stations.length; index += 1) {
    const slot = stations[index]!;
    if (!excludedIds.has(slot.exerciseId)) {
      resolved.push(slot);
      continue;
    }
    const replacement = substituteFor(
      slot,
      blockedExerciseIds(stations, index, resolved, excludedIds),
      excluded,
      catalogue,
    );
    if (replacement) {
      resolved.push(replacement);
    }
  }

  return ensureNonEmpty(resolved, excludedIds, catalogue);
}

/**
 * After "Not for me" mid warm-up: keep the current step, rewrite the rest.
 * The warm-up may get shorter; that is fine.
 */
export function rewriteWarmupStepsAfterExclude(
  steps: readonly WarmupStep[],
  currentIndex: number,
  excluded: readonly string[],
): WarmupStep[] {
  if (currentIndex < -1 || currentIndex >= steps.length) {
    throw new Error(
      `currentIndex must be in [-1, ${steps.length - 1}]; got ${currentIndex}`,
    );
  }
  const head = steps.slice(0, currentIndex + 1);
  const tailSource = steps.slice(currentIndex + 1);
  if (tailSource.length === 0) {
    return withWarmupGaps(head);
  }
  return withWarmupGaps([...head, ...rebuildWarmupTail(head, tailSource, excluded)]);
}

/** Expanded steps from one station share an exercise id; treat each once. */
function groupStepsByExercise(steps: readonly WarmupStep[]): WarmupStep[][] {
  const groups: WarmupStep[][] = [];
  for (const step of steps) {
    const exerciseId = warmupStepExerciseId(step);
    const last = groups[groups.length - 1];
    if (last && warmupStepExerciseId(last[0]!) === exerciseId) {
      last.push(step);
      continue;
    }
    groups.push([step]);
  }
  return groups;
}

function rebuildWarmupTail(
  head: readonly WarmupStep[],
  tailSource: readonly WarmupStep[],
  excluded: readonly string[],
): WarmupStep[] {
  const excludedIds = new Set(excluded);
  const used = new Set(head.map(warmupStepExerciseId));
  const groups = groupStepsByExercise(tailSource);
  const rebuilt: WarmupStep[] = [];
  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index]!;
    const exerciseId = warmupStepExerciseId(group[0]!);
    if (!excludedIds.has(exerciseId)) {
      used.add(exerciseId);
      rebuilt.push(...group);
      continue;
    }
    const upcoming = groups.slice(index + 1).map((next) => warmupStepExerciseId(next[0]!));
    const blocked = new Set([...used, ...excludedIds, ...upcoming]);
    const replacement = substituteFor(
      stationFromStep(group[0]!),
      blocked,
      excluded,
      WARMUP_STATIONS,
    );
    if (!replacement) {
      continue;
    }
    used.add(replacement.exerciseId);
    rebuilt.push(...expandWarmupStations([replacement]));
  }
  return rebuilt;
}

/** Exercises already picked or still ahead in the template (do not steal them). */
function blockedExerciseIds(
  stations: readonly WarmupStation[],
  index: number,
  resolved: readonly WarmupStation[],
  excludedIds: ReadonlySet<string>,
): ReadonlySet<string> {
  const blocked = new Set(excludedIds);
  for (const station of resolved) {
    blocked.add(station.exerciseId);
  }
  for (let ahead = index + 1; ahead < stations.length; ahead += 1) {
    blocked.add(stations[ahead]!.exerciseId);
  }
  return blocked;
}

function stationFromStep(step: WarmupStep): WarmupStation {
  const exerciseId = warmupStepExerciseId(step);
  const known = WARMUP_STATION_BY_ID[step.stationId];
  if (known && known.exerciseId === exerciseId) {
    return {
      ...known,
      holdSeconds: step.holdSeconds,
      name: step.name,
      cues: [...step.cues],
      doodlePath: step.doodlePath,
      perSide: step.perSide === true,
      phase: step.phase ?? known.phase,
      source: step.source ?? known.source,
    };
  }
  return {
    id: step.stationId,
    exerciseId,
    name: step.name,
    phase: step.phase ?? "mobilise",
    regions: [step.region],
    holdSeconds: step.holdSeconds,
    source: step.source ?? "",
    difficulty: "beginner",
    doodlePath: step.doodlePath,
    cues: [...step.cues],
    perSide: step.perSide === true,
  };
}

function substituteFor(
  slot: WarmupStation,
  blocked: ReadonlySet<string>,
  excluded: readonly string[],
  catalogue: readonly WarmupStation[],
): WarmupStation | null {
  const samePhase = catalogue.find(
    (candidate) =>
      candidate.phase === slot.phase && !blocked.has(candidate.exerciseId),
  );
  if (samePhase) {
    return takeSlotDose(samePhase, slot);
  }

  const exercise = EXERCISE_GRAPH[slot.exerciseId];
  if (!exercise) {
    return null;
  }
  const care = chooseSuitableExercise(exercise, [], undefined, excluded);
  // chooseSuitableExercise returns the original when nothing swaps; blocked
  // already includes excluded ids, so a blocked pick is unusable.
  if (!care.swappedFrom || blocked.has(care.id)) {
    return null;
  }
  const fromCatalogue = catalogue.find((candidate) => candidate.exerciseId === care.id);
  if (fromCatalogue) {
    return takeSlotDose(fromCatalogue, slot);
  }
  const chosen = EXERCISE_GRAPH[care.id];
  return chosen ? stationFromExercise(chosen, slot) : null;
}

/** Keep the template slot's dose; take the substitute's move identity. */
function takeSlotDose(from: WarmupStation, slot: WarmupStation): WarmupStation {
  return {
    ...from,
    holdSeconds: slot.holdSeconds,
    prescription: slot.prescription,
    phase: slot.phase,
  };
}

function stationFromExercise(exercise: SeedExercise, slot: WarmupStation): WarmupStation {
  return {
    id: exercise.id,
    exerciseId: exercise.id,
    name: exercise.name,
    phase: slot.phase,
    regions: slot.regions,
    holdSeconds: slot.holdSeconds,
    source: slot.source,
    difficulty: slot.difficulty,
    doodlePath: doodleFor(exercise.id, exercise.doodlePath),
    cues: [...exercise.cues],
    perSide: slot.perSide,
    prescription: slot.prescription,
  };
}

function ensureNonEmpty(
  resolved: WarmupStation[],
  excludedIds: ReadonlySet<string>,
  catalogue: readonly WarmupStation[],
): WarmupStation[] {
  if (resolved.length > 0) {
    return resolved;
  }
  const raise = catalogue.find(
    (station) => station.phase === "raise" && !excludedIds.has(station.exerciseId),
  );
  if (raise) {
    return [raise];
  }
  const any = catalogue.find((station) => !excludedIds.has(station.exerciseId));
  return any ? [any] : [];
}
