import { EXERCISE_GRAPH } from "../data/exerciseGraph";
import type { PlanQueue, SessionTemplate } from "../domain/program";
import { SKILL_TIER_LABELS, standardsFor, tierIndex } from "../domain/skillTier";
import type { Difficulty, ExerciseMemory, ExerciseStandards, SkillTier } from "../domain/types";
import {
  evaluatePlanLevelGate,
  PLAN_LEVEL_GATE_DAYS,
} from "../progress/planLevelGate";
import { loadMemories } from "../session/history";
import { createKeyValueStore } from "../storage/keyValueStore";
import { PLAN_LEVEL_RAISE_NOTICE_KEY } from "../storage/storageKeys";
import { loadPlanLevel, savePlanLevel, type PlanLevel } from "./planLevel";
import { peekUpcoming } from "./queue";

const noticeStore = createKeyValueStore(PLAN_LEVEL_RAISE_NOTICE_KEY);

export interface PlanLevelRaiseNotice {
  from: SkillTier;
  to: SkillTier;
  message: string;
}

export interface ApplyPlanLevelRaiseInput {
  days: readonly SessionTemplate[];
  memories: Readonly<Record<string, ExerciseMemory>>;
  standardsFor?: (exerciseId: string) => ExerciseStandards | null | undefined;
  /** Override loadPlanLevel for tests. */
  currentLevel?: PlanLevel;
}

export type ApplyPlanLevelRaiseResult =
  | { raised: false }
  | { raised: true; from: SkillTier; to: SkillTier };

/**
 * If the next three plan days clear the logged-performance gate, raise the
 * plan level one tier and store a Plan notice (#115).
 */
export function applyPlanLevelRaiseIfReady(
  input: ApplyPlanLevelRaiseInput,
): ApplyPlanLevelRaiseResult {
  const level = input.currentLevel ?? loadPlanLevel();
  const currentTier = resolveGateTier(level, input.days, input.memories);
  if (!currentTier) {
    return { raised: false };
  }

  const lookup = input.standardsFor ?? defaultStandardsFor;
  const gate = evaluatePlanLevelGate({
    days: input.days,
    memories: input.memories,
    currentTier,
    standardsFor: lookup,
  });
  if (!gate.shouldRaise || !gate.nextTier) {
    return { raised: false };
  }

  const next = gate.nextTier as Difficulty;
  savePlanLevel(next);
  writeRaiseNotice(currentTier, gate.nextTier);
  return { raised: true, from: currentTier, to: gate.nextTier };
}

export function loadPlanLevelRaiseNotice(): PlanLevelRaiseNotice | null {
  const raw = noticeStore.read();
  if (!raw) {
    return null;
  }
  try {
    return parseRaiseNotice(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeRaiseNotice(from: SkillTier, to: SkillTier): void {
  const notice: PlanLevelRaiseNotice = {
    from,
    to,
    message: `Plan level → ${SKILL_TIER_LABELS[to]} — 80%+ of your last 3 days are ready.`,
  };
  noticeStore.write(JSON.stringify(notice));
}

function parseRaiseNotice(value: unknown): PlanLevelRaiseNotice | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const parsed = value as Partial<PlanLevelRaiseNotice>;
  if (
    typeof parsed.from !== "string" ||
    typeof parsed.to !== "string" ||
    typeof parsed.message !== "string"
  ) {
    return null;
  }
  return { from: parsed.from, to: parsed.to, message: parsed.message };
}

export function clearPlanLevelRaiseNotice(): void {
  noticeStore.clear();
}

/** Evaluate the head of the plan queue and raise when the gate passes. */
export function maybeRaisePlanLevelForQueue(queue: PlanQueue): ApplyPlanLevelRaiseResult {
  if (queue.items.length < PLAN_LEVEL_GATE_DAYS) {
    return { raised: false };
  }
  try {
    const days = peekUpcoming(queue, PLAN_LEVEL_GATE_DAYS);
    return applyPlanLevelRaiseIfReady({ days, memories: loadMemories() });
  } catch {
    return { raised: false };
  }
}

function defaultStandardsFor(exerciseId: string): ExerciseStandards | null {
  const exercise = EXERCISE_GRAPH[exerciseId];
  return exercise ? standardsFor(exercise) : null;
}

/**
 * Fixed plan level → that tier. Auto → lowest logged tier in the window
 * (conservative); no logs → no raise.
 */
function resolveGateTier(
  level: PlanLevel,
  days: readonly SessionTemplate[],
  memories: Readonly<Record<string, ExerciseMemory>>,
): SkillTier | null {
  if (level !== "auto") {
    return level;
  }
  let lowest: SkillTier | undefined;
  for (const day of days.slice(0, PLAN_LEVEL_GATE_DAYS)) {
    for (const slot of day.slots) {
      if (slot.pinned) {
        continue;
      }
      const logged = memories[slot.exerciseId]?.loggedTier;
      if (!logged) {
        continue;
      }
      if (lowest === undefined || tierIndex(logged) < tierIndex(lowest)) {
        lowest = logged;
      }
    }
  }
  return lowest ?? null;
}
