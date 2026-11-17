import type { PlanQueue, SessionTemplate } from "../domain/program";
import type { SkillTier } from "../domain/types";
import { loadMemories, saveMemories } from "../session/history";
import {
  generateBlock,
  generateContinuationDay,
  type BlockInput,
  type ContinuationInput,
} from "./generateBlock";
import { generateJointCareDay } from "./jointCareDay";
import type { StepContext } from "./ladderSteps";
import { declareLevelForDays } from "./levelDeclare";
import { savePlanDays } from "./planDays";

/** Sessions left between the days of one block, so an area is not trained back to back. */
const BLOCK_SPACING = 2;

/**
 * Queue with a block's days inserted: the first at `index`, each later day
 * `BLOCK_SPACING` positions after the previous one (or at the end when the
 * queue is shorter). Nothing already queued is removed.
 */
export function placeBlock(queue: PlanQueue, dayIds: readonly string[], index: number): PlanQueue {
  if (!Number.isInteger(index) || index < 0 || index > queue.items.length) {
    throw new Error(`block index out of range: ${index}`);
  }
  const items = [...queue.items];
  let at = index;
  for (const dayId of dayIds) {
    const position = Math.min(at, items.length);
    items.splice(position, 0, dayId);
    at = position + BLOCK_SPACING;
  }
  return { items };
}

/** With a plan level set, record it on the generated moves so sessions are dosed at that level. */
function declarePlanLevel(days: readonly SessionTemplate[], level: SkillTier | undefined): void {
  if (level) {
    saveMemories(declareLevelForDays(loadMemories(), days, level, new Date()));
  }
}

function persistGeneratedDays(days: readonly SessionTemplate[], level: SkillTier | undefined): void {
  savePlanDays(days);
  declarePlanLevel(days, level);
}

export interface AddBlockResult {
  days: SessionTemplate[];
  /** The queue with the block placed; the caller saves it. */
  queue: PlanQueue;
}

/**
 * Generate a block, store its days, and return the queue with them placed
 * (first day at `index`). The days are saved here so the returned queue can
 * be saved without dangling ids.
 */
export function addBlockToPlan(input: BlockInput & { queue: PlanQueue; index: number }): AddBlockResult {
  const days = generateBlock(input);
  const queue = placeBlock(input.queue, days.map((day) => day.id), input.index);
  persistGeneratedDays(days, input.context.level);
  return { days, queue };
}

/**
 * Generate a Joint care day, store it, and return the queue with it at
 * `index` (the end by default). The caller saves the queue.
 */
export function addJointCareDay(input: { queue: PlanQueue; context: StepContext; index?: number; newId?: () => string }): AddBlockResult {
  const day = generateJointCareDay(input.context, input.newId);
  const queue = placeBlock(input.queue, [day.id], input.index ?? input.queue.items.length);
  persistGeneratedDays([day], undefined);
  return { days: [day], queue };
}

/**
 * After a generated block day finishes: append the next working/easier/focus
 * day at the end of the queue (same group/target). No-op when continuation
 * cannot be built. Saves the new day before returning the extended queue.
 */
export function replenishBlockOnQueue(input: ContinuationInput & { queue: PlanQueue }): PlanQueue {
  const continuation = generateContinuationDay(input);
  if (!continuation) {
    return input.queue;
  }
  persistGeneratedDays([continuation], input.context.level);
  return { items: [...input.queue.items, continuation.id] };
}
